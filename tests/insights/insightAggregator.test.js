import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { buildAggregatedSummary } from '../../src/insights/insightAggregator.js';
import { insertEvent } from '../../src/tracking/eventsRepo.js';

function setup() {
  const db = openTestDatabase();
  runMigrations(db);
  return db;
}

test('reports hasEnoughData=false and empty aggregates when nothing is logged', () => {
  const db = setup();
  const summary = buildAggregatedSummary(db, 'u1', 'screen_time');
  assert.equal(summary.hasEnoughData, false);
  assert.deepEqual(summary.topTriggers, []);
});

test('aggregates trigger frequency and mood correlation correctly', () => {
  const db = setup();
  const now = new Date().toISOString();
  insertEvent(db, 'u1', { habitType: 'screen_time', source: 'manual', occurredAt: now, triggerTag: 'boredom', mood: 'bored', value: 60, label: null, notes: null });
  insertEvent(db, 'u1', { habitType: 'screen_time', source: 'manual', occurredAt: now, triggerTag: 'boredom', mood: 'bored', value: 40, label: null, notes: null });
  insertEvent(db, 'u1', { habitType: 'screen_time', source: 'manual', occurredAt: now, triggerTag: 'stress', mood: 'stressed', value: 20, label: null, notes: null });

  const summary = buildAggregatedSummary(db, 'u1', 'screen_time');
  assert.equal(summary.hasEnoughData, true);
  assert.equal(summary.topTriggers[0].trigger, 'boredom');
  assert.equal(summary.topTriggers[0].count, 2);

  const boredMood = summary.moodCorrelation.find((m) => m.mood === 'bored');
  assert.equal(boredMood.avgValue, 50);
});

test('does not leak another user\'s data into the aggregation', () => {
  const db = setup();
  insertEvent(db, 'u2', { habitType: 'screen_time', source: 'manual', occurredAt: new Date().toISOString(), triggerTag: 'other', mood: null, value: 500, label: null, notes: null });
  const summary = buildAggregatedSummary(db, 'u1', 'screen_time');
  assert.equal(summary.hasEnoughData, false);
});
