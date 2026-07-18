import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { insertTelemetryBatch } from '../../src/telemetry/telemetryRepo.js';
import { deriveHabitEventsFromTelemetry } from '../../src/telemetry/telemetryDerivation.js';

function setup() {
  const db = openTestDatabase();
  runMigrations(db);
  return db;
}

test('promotes app_usage_summary telemetry into a real habit_events row', () => {
  const db = setup();
  const today = new Date().toISOString();
  insertTelemetryBatch(db, 'u1', {
    deviceId: 'sim-1',
    syncBatchId: null,
    events: [{ eventType: 'app_usage_summary', valueNumeric: 55, unit: 'minutes', recordedAt: today, recordedTz: 'UTC' }],
  });

  const derived = deriveHabitEventsFromTelemetry(db, 'u1');
  assert.equal(derived.length, 1);

  const habitEvents = db.prepare("SELECT * FROM habit_events WHERE user_id = 'u1'").all();
  assert.equal(habitEvents.length, 1);
  assert.equal(habitEvents[0].habit_type, 'screen_time');
  assert.equal(habitEvents[0].source, 'device_sync');
  assert.equal(habitEvents[0].value, 55);
});

test('re-running derivation updates the existing row instead of duplicating it', () => {
  const db = setup();
  const today = new Date().toISOString();
  insertTelemetryBatch(db, 'u1', {
    deviceId: 'sim-1',
    syncBatchId: 'b1',
    events: [{ eventType: 'app_usage_summary', valueNumeric: 20, unit: 'minutes', recordedAt: today, recordedTz: 'UTC' }],
  });
  deriveHabitEventsFromTelemetry(db, 'u1');

  // more usage synced later the same day
  insertTelemetryBatch(db, 'u1', {
    deviceId: 'sim-1',
    syncBatchId: 'b2',
    events: [{ eventType: 'app_usage_summary', valueNumeric: 25, unit: 'minutes', recordedAt: today, recordedTz: 'UTC' }],
  });
  deriveHabitEventsFromTelemetry(db, 'u1');

  const habitEvents = db.prepare("SELECT * FROM habit_events WHERE user_id = 'u1'").all();
  assert.equal(habitEvents.length, 1, 'must update in place, not duplicate');
  assert.equal(habitEvents[0].value, 45);
});
