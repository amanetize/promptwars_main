import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createIntentionsHandlers } from '../../src/intentions/intentionsRoute.js';

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
  return createIntentionsHandlers({ db });
}

test('postIntention validates required fields', () => {
  const handlers = setup();
  const res = mockRes();
  handlers.postIntention({ userId: 'u1', body: { ifTrigger: '', thenAction: 'walk outside' } }, res);
  assert.equal(res.statusCode, 400);
});

test('postIntention creates a global (habit-less) or habit-scoped plan', () => {
  const handlers = setup();
  const res = mockRes();
  handlers.postIntention(
    { userId: 'u1', body: { habitType: 'screen_time', ifTrigger: 'notification at night', thenAction: 'put phone in another room' } },
    res
  );
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.intention.habit_type, 'screen_time');
  assert.equal(res.body.intention.active, 1);
});

test('getIntentions filters by active and scopes by user', () => {
  const handlers = setup();
  handlers.postIntention({ userId: 'u1', body: { ifTrigger: 'a', thenAction: 'b' } }, mockRes());
  handlers.postIntention({ userId: 'u2', body: { ifTrigger: 'c', thenAction: 'd' } }, mockRes());

  const res = mockRes();
  handlers.getIntentions({ userId: 'u1', query: {} }, res);
  assert.equal(res.body.intentions.length, 1);
});

test('patchIntention deactivates only the owning user\'s intention', () => {
  const handlers = setup();
  const createRes = mockRes();
  handlers.postIntention({ userId: 'u1', body: { ifTrigger: 'a', thenAction: 'b' } }, createRes);
  const id = createRes.body.intention.id;

  const wrongUserRes = mockRes();
  handlers.patchIntention({ userId: 'u2', params: { id }, body: { active: false } }, wrongUserRes);
  assert.equal(wrongUserRes.statusCode, 404);

  const res = mockRes();
  handlers.patchIntention({ userId: 'u1', params: { id }, body: { active: false } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.intention.active, 0);
});
