import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createCoachHandlers } from '../../src/coaching/coachRoute.js';

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

function setup(requestCompletion) {
  const db = openTestDatabase();
  runMigrations(db);
  const handlers = createCoachHandlers({ db, apiKey: 'test', model: 'test-model', requestCompletion });
  return { db, handlers };
}

test('rejects an empty message', async () => {
  const { handlers } = setup(async () => ({}));
  const res = mockRes();
  await handlers.postMessage({ userId: 'u1', body: { message: '   ' } }, res);
  assert.equal(res.statusCode, 400);
});

test('normal turn returns the therapeutic response to the client', async () => {
  const { handlers } = setup(async () => ({
    therapeutic_response: 'That sounds tough — want to tell me more?',
    detected_primary_emotion: 'stressed',
    stage_transition: 'none',
    crisis_flag: false,
  }));
  const res = mockRes();
  await handlers.postMessage({ userId: 'u1', body: { message: 'I had a hard day' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.crisis, false);
  assert.equal(res.body.message, 'That sounds tough — want to tell me more?');
});

test('crisis_flag from the model suppresses the raw reply and returns static resources', async () => {
  const { db, handlers } = setup(async () => ({
    therapeutic_response: 'this should never reach the client',
    detected_primary_emotion: 'sad',
    stage_transition: 'none',
    crisis_flag: true,
  }));
  const res = mockRes();
  await handlers.postMessage({ userId: 'u1', body: { message: 'I feel awful' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.crisis, true);
  assert.ok(Array.isArray(res.body.resources));
  assert.equal(res.body.message, undefined, 'raw model text must not be sent to the client');

  const stored = db.prepare("SELECT * FROM coaching_messages WHERE role = 'assistant'").get();
  assert.equal(stored.content, 'this should never reach the client', 'real output is still persisted for audit');
  assert.equal(stored.crisis_flag, 1);
});

test('deterministic keyword safety-net fires even when the model claims crisis_flag:false', async () => {
  const { handlers } = setup(async () => ({
    therapeutic_response: 'a normal-sounding reply the model produced anyway',
    detected_primary_emotion: 'sad',
    stage_transition: 'none',
    crisis_flag: false,
  }));
  const res = mockRes();
  await handlers.postMessage({ userId: 'u1', body: { message: 'I want to kill myself' } }, res);
  assert.equal(res.body.crisis, true, 'keyword safety-net must override a false-negative model classification');
});

test('a non-null stage_transition updates user_habit_state for the focused habit', async () => {
  const { db, handlers } = setup(async () => ({
    therapeutic_response: 'Great progress, sounds like you are ready to act.',
    detected_primary_emotion: 'hopeful',
    stage_transition: 'action',
    crisis_flag: false,
  }));
  const res = mockRes();
  await handlers.postMessage({ userId: 'u1', body: { message: 'I feel ready to change', habitTypeContext: 'screen_time' } }, res);
  assert.equal(res.body.stageTransition, 'action');

  const state = db.prepare("SELECT * FROM user_habit_state WHERE user_id = 'u1' AND habit_type = 'screen_time'").get();
  assert.equal(state.stage_of_change, 'action');
});

test('getHistory never resurfaces suppressed crisis-turn text', async () => {
  const { handlers } = setup(async () => ({
    therapeutic_response: 'should stay hidden',
    detected_primary_emotion: 'sad',
    stage_transition: 'none',
    crisis_flag: true,
  }));
  await handlers.postMessage({ userId: 'u1', body: { message: 'I want to end my life' } }, mockRes());

  const res = mockRes();
  handlers.getHistory({ userId: 'u1' }, res);
  const assistantTurn = res.body.messages.find((m) => m.role === 'assistant');
  assert.equal(assistantTurn.content, null);
  assert.equal(assistantTurn.crisis, true);
});
