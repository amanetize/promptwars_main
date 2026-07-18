import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { insertTelemetryBatch, insertBrowserTimeEvent, summarizeTelemetry } from '../../src/telemetry/telemetryRepo.js';

function setup() {
  const db = openTestDatabase();
  runMigrations(db);
  return db;
}

test('insertTelemetryBatch is idempotent on retried sync_batch_id/batch_seq', () => {
  const db = setup();
  const payload = {
    deviceId: 'sim-1',
    syncBatchId: 'batch-abc',
    events: [
      { eventType: 'app_usage_summary', valueNumeric: 42, unit: 'minutes', recordedAt: '2026-07-18T07:00:00Z', recordedTz: 'UTC' },
    ],
  };
  const firstCount = insertTelemetryBatch(db, 'u1', payload);
  const retryCount = insertTelemetryBatch(db, 'u1', payload); // simulate a retried sync
  assert.equal(firstCount, 1);
  assert.equal(retryCount, 0, 'retried batch must not duplicate rows');

  const rows = db.prepare('SELECT * FROM telemetry_events WHERE user_id = ?').all('u1');
  assert.equal(rows.length, 1);
  db.close();
});

test('insertBrowserTimeEvent tags source as browser_telemetry, distinct from device_sync', () => {
  const db = setup();
  const event = insertBrowserTimeEvent(db, 'u1', {
    minutes: 12,
    recordedAt: new Date().toISOString(),
    recordedTz: 'UTC',
  });
  assert.equal(event.source, 'browser_telemetry');
  assert.equal(event.event_type, 'browser_time_in_app');
  db.close();
});

test('summarizeTelemetry aggregates by event type and day, scoped to the user', () => {
  const db = setup();
  insertTelemetryBatch(db, 'u1', {
    deviceId: 'sim-1',
    syncBatchId: null,
    events: [
      { eventType: 'app_usage_summary', valueNumeric: 30, unit: 'minutes', recordedAt: new Date().toISOString(), recordedTz: 'UTC' },
      { eventType: 'app_usage_summary', valueNumeric: 15, unit: 'minutes', recordedAt: new Date().toISOString(), recordedTz: 'UTC' },
    ],
  });
  insertTelemetryBatch(db, 'u2', {
    deviceId: 'sim-2',
    syncBatchId: null,
    events: [{ eventType: 'app_usage_summary', valueNumeric: 999, unit: 'minutes', recordedAt: new Date().toISOString(), recordedTz: 'UTC' }],
  });

  const summary = summarizeTelemetry(db, 'u1', { eventType: 'app_usage_summary' });
  assert.equal(summary.length, 1);
  assert.equal(summary[0].total, 45);
  assert.equal(summary[0].count, 2);
  db.close();
});
