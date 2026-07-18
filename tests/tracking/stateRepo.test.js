import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { computeState, upsertUserHabitState } from '../../src/tracking/stateRepo.js';

function seedEvent(db, { userId, habitType, value, occurredAt, triggerTag = null, mood = null }) {
  db.prepare(
    `INSERT INTO habit_events (user_id, habit_type, source, occurred_at, trigger_tag, mood, value)
     VALUES (?, ?, 'manual', ?, ?, ?, ?)`
  ).run(userId, habitType, occurredAt, triggerTag, mood, value);
}

function setup() {
  const db = openTestDatabase();
  runMigrations(db);
  return db;
}

test('reduce_below_threshold habit: a day over the goal fails, days with no logs succeed', () => {
  const db = setup();
  const today = new Date().toISOString();
  // screen_time default goal is 120 minutes; log 200 today (over goal).
  seedEvent(db, { userId: 'u1', habitType: 'screen_time', value: 200, occurredAt: today });

  const state = computeState(db, 'u1', 'screen_time');
  assert.equal(state.completionRate.totalDays, 30);
  assert.equal(state.completionRate.successDays, 29, 'only today should fail');
  assert.equal(state.currentRunDays, 0, 'today (the most recent day) failed, so the run is broken');
  db.close();
});

test('abstinence habit: any logged occurrence fails that day', () => {
  const db = setup();
  const today = new Date().toISOString();
  seedEvent(db, { userId: 'u1', habitType: 'smoking', value: 1, occurredAt: today });

  const state = computeState(db, 'u1', 'smoking');
  assert.equal(state.completionRate.successDays, 29);
  assert.equal(state.currentRunDays, 0);
  db.close();
});

test('abstinence habit with no logged events at all: full completion, full run', () => {
  const db = setup();
  const state = computeState(db, 'u1', 'alcohol');
  assert.equal(state.completionRate.successDays, 30);
  assert.equal(state.currentRunDays, 30);
  db.close();
});

test('custom habit type has no numeric completion rate (null goal guard)', () => {
  const db = setup();
  seedEvent(db, { userId: 'u1', habitType: 'custom', value: 1, occurredAt: new Date().toISOString() });
  const state = computeState(db, 'u1', 'custom');
  assert.equal(state.completionRate, null);
  db.close();
});

test('top triggers and mood trend are scoped to the requested user and habit', () => {
  const db = setup();
  const now = new Date().toISOString();
  seedEvent(db, { userId: 'u1', habitType: 'screen_time', value: 10, occurredAt: now, triggerTag: 'boredom', mood: 'bored' });
  seedEvent(db, { userId: 'u1', habitType: 'screen_time', value: 10, occurredAt: now, triggerTag: 'boredom', mood: 'bored' });
  seedEvent(db, { userId: 'u2', habitType: 'screen_time', value: 999, occurredAt: now, triggerTag: 'other-user', mood: 'sad' });

  const state = computeState(db, 'u1', 'screen_time');
  assert.equal(state.topTriggers[0].trigger, 'boredom');
  assert.equal(state.topTriggers[0].count, 2);
  assert.ok(!state.topTriggers.some((t) => t.trigger === 'other-user'), 'must not leak another user\'s data');
  db.close();
});

test('upsertUserHabitState creates then updates, and computeState reflects the stored daily goal', () => {
  const db = setup();
  let row = upsertUserHabitState(db, 'u1', 'screen_time', { stageOfChange: 'action', dailyGoalValue: 30 });
  assert.equal(row.stage_of_change, 'action');
  assert.equal(row.daily_goal_value, 30);

  row = upsertUserHabitState(db, 'u1', 'screen_time', { stageOfChange: 'maintenance' });
  assert.equal(row.stage_of_change, 'maintenance');
  assert.equal(row.daily_goal_value, 30, 'omitted field should be preserved, not cleared');

  const state = computeState(db, 'u1', 'screen_time');
  assert.equal(state.dailyGoalValue, 30);
  assert.equal(state.stageOfChange, 'maintenance');
  db.close();
});
