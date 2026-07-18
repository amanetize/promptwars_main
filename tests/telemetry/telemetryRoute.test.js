import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createTelemetryHandlers } from '../../src/telemetry/telemetryRoute.js';

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

function setup() {
  const db = openTestDatabase();
  runMigrations(db);
  return createTelemetryHandlers({ db });
}

test('postSync rejects an event type not on the allow-list', () => {
  const handlers = setup();
  const res = mockRes();
  handlers.postSync(
    {
      userId: 'u1',
      body: {
        deviceId: 'sim-1',
        events: [{ eventType: 'raw_gps_trace', value: 1, recordedAt: new Date().toISOString(), recordedTz: 'UTC' }],
      },
    },
    res
  );
  assert.equal(res.statusCode, 400);
});

test('postSync rejects a naive timestamp with no explicit UTC offset', () => {
  const handlers = setup();
  const res = mockRes();
  handlers.postSync(
    {
      userId: 'u1',
      body: {
        deviceId: 'sim-1',
        events: [{ eventType: 'app_usage_summary', value: 10, recordedAt: '2026-07-18T07:00:00', recordedTz: 'UTC' }],
      },
    },
    res
  );
  assert.equal(res.statusCode, 400);
});

test('postSync accepts a valid batch and reports derived habit events', () => {
  const handlers = setup();
  const res = mockRes();
  handlers.postSync(
    {
      userId: 'u1',
      body: {
        deviceId: 'sim-1',
        events: [
          { eventType: 'app_usage_summary', value: 40, recordedAt: new Date().toISOString(), recordedTz: 'UTC' },
        ],
      },
    },
    res
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.insertedCount, 1);
  assert.equal(res.body.derivedHabitEvents, 1);
});

test('postBrowserTime validates and stores real, unsimulated time-in-app data', () => {
  const handlers = setup();
  const badRes = mockRes();
  handlers.postBrowserTime({ userId: 'u1', body: { minutes: -5, recordedAt: new Date().toISOString(), recordedTz: 'UTC' } }, badRes);
  assert.equal(badRes.statusCode, 400);

  const res = mockRes();
  handlers.postBrowserTime({ userId: 'u1', body: { minutes: 8, recordedAt: new Date().toISOString(), recordedTz: 'UTC' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.event.source, 'browser_telemetry');
});
