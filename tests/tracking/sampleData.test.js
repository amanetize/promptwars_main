import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createSampleDataHandlers } from '../../src/tracking/sampleDataRoute.js';
import { computeState } from '../../src/tracking/stateRepo.js';
import { listIntentions } from '../../src/intentions/intentionsRepo.js';

function setup() {
  const db = openTestDatabase();
  runMigrations(db);
  return { db, handlers: createSampleDataHandlers({ db }) };
}

function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('seeds a full demo dataset scoped to the userId', () => {
  const { db, handlers } = setup();
  const res = mockRes();
  handlers.postSeed({ userId: 'demo-user' }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  const { seeded } = res.body;
  assert.ok(seeded.events > 100, 'should seed many habit events across 30 days');
  assert.ok(seeded.intentions >= 3, 'should seed several if-then plans');
  assert.ok(seeded.habitStates === 7, 'one state row per habit type');
  assert.ok(seeded.telemetryEvents > 0, 'should seed telemetry');
  assert.ok(seeded.messages >= 2, 'should seed a coaching conversation');

  // Data must be scoped: another user sees nothing.
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM habit_events WHERE user_id = ?').get('other').n, 0);
  db.close();
});

test('seeded events drive a non-empty computed state', () => {
  const { db, handlers } = setup();
  handlers.postSeed({ userId: 'demo-user' }, mockRes());

  const state = computeState(db, 'demo-user', 'screen_time');
  assert.ok(state.completionRate, 'screen_time has a numeric goal');
  assert.ok(state.topTriggers.length > 0, 'top triggers should be derived from seeded events');
  assert.ok(state.moodTrend.length > 0, 'mood trend should be populated');
  db.close();
});

test('seeded intentions include both active and completed plans', () => {
  const { db, handlers } = setup();
  handlers.postSeed({ userId: 'demo-user' }, mockRes());

  const active = listIntentions(db, 'demo-user', { active: true });
  const inactive = listIntentions(db, 'demo-user', { active: false });
  assert.ok(active.length > 0, 'should seed at least one active plan');
  assert.ok(inactive.length > 0, 'should seed at least one completed plan');
  db.close();
});

test('re-seeding clears existing data (no accumulation)', () => {
  const { db, handlers } = setup();
  handlers.postSeed({ userId: 'demo-user' }, mockRes());

  // Simulate pre-existing data the user had logged before clicking "Load
  // sample data" again — it must be wiped, not stacked on top.
  db.prepare(
    `INSERT INTO habit_events (user_id, habit_type, source, occurred_at, trigger_tag, value)
     VALUES ('demo-user', 'screen_time', 'manual', strftime('%Y-%m-%dT%H:%M:%fZ','now'), 'MARKER_SHOULD_BE_CLEARED', 1)`
  ).run();
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM habit_events WHERE user_id = 'demo-user' AND trigger_tag = 'MARKER_SHOULD_BE_CLEARED'").get().n,
    1
  );

  handlers.postSeed({ userId: 'demo-user' }, mockRes());
  const markerRows = db
    .prepare("SELECT COUNT(*) AS n FROM habit_events WHERE user_id = 'demo-user' AND trigger_tag = 'MARKER_SHOULD_BE_CLEARED'")
    .get().n;
  assert.equal(markerRows, 0, 'a second seed must clear the user’s prior rows first');
  db.close();
});
