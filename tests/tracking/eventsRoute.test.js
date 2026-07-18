import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createEventsHandlers } from '../../src/tracking/eventsRoute.js';

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
  return createEventsHandlers({ db });
}

test('postEvent returns 400 on invalid body', () => {
  const handlers = setup();
  const res = mockRes();
  handlers.postEvent({ userId: 'u1', body: { habitType: 'not_real', value: 1 } }, res);
  assert.equal(res.statusCode, 400);
});

test('postEvent stores and returns the event on valid input', () => {
  const handlers = setup();
  const res = mockRes();
  handlers.postEvent({ userId: 'u1', body: { habitType: 'screen_time', value: 45, mood: 'bored' } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.event.habit_type, 'screen_time');
  assert.equal(res.body.event.user_id, 'u1');
});

test('getEvents only returns the requesting user\'s events', () => {
  const handlers = setup();
  handlers.postEvent({ userId: 'u1', body: { habitType: 'screen_time', value: 10 } }, mockRes());
  handlers.postEvent({ userId: 'u2', body: { habitType: 'screen_time', value: 20 } }, mockRes());

  const res = mockRes();
  handlers.getEvents({ userId: 'u1', query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.events.length, 1);
  assert.equal(res.body.events[0].user_id, 'u1');
});
