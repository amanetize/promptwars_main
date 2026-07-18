import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createNudgeHandler } from '../../src/nudges/nudgeRoute.js';
import { OpenRouterError } from '../../src/llm/openrouter.js';
import { insertEvent } from '../../src/tracking/eventsRepo.js';

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
  return db;
}

test('returns 400 for an unknown habitType', async () => {
  const db = setup();
  const handler = createNudgeHandler({ db, apiKey: 'test', model: 'test-model' });
  const res = mockRes();
  await handler({ userId: 'u1', query: { habitType: 'not_real' } }, res);
  assert.equal(res.statusCode, 400);
});

test('returns 503 when apiKey is missing', async () => {
  const db = setup();
  const handler = createNudgeHandler({ db, apiKey: '', model: 'test-model' });
  const res = mockRes();
  await handler({ userId: 'u1', query: {} }, res);
  assert.equal(res.statusCode, 503);
});

test('returns a nudge built from real stored data via the injected LLM client', async () => {
  const db = setup();
  insertEvent(db, 'u1', {
    habitType: 'screen_time',
    source: 'manual',
    occurredAt: new Date().toISOString(),
    triggerTag: 'boredom',
    mood: 'bored',
    value: 90,
    label: null,
    notes: null,
  });

  let capturedMessages;
  const requestCompletion = async ({ messages }) => {
    capturedMessages = messages;
    return { nudgeText: 'Nice work today.', tone: 'encouraging', suggestedMicroAction: 'Try a 5 minute walk.' };
  };
  const handler = createNudgeHandler({ db, apiKey: 'test', model: 'test-model', requestCompletion });
  const res = mockRes();
  await handler({ userId: 'u1', query: { habitType: 'screen_time' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.habitType, 'screen_time');
  assert.equal(res.body.tone, 'encouraging');
  assert.match(capturedMessages[1].content, /boredom/, 'the real trigger data should reach the prompt');
});

test('maps OpenRouterError to its status code', async () => {
  const db = setup();
  const requestCompletion = async () => {
    throw new OpenRouterError('rate limited', 429);
  };
  const handler = createNudgeHandler({ db, apiKey: 'test', model: 'test-model', requestCompletion });
  const res = mockRes();
  await handler({ userId: 'u1', query: {} }, res);
  assert.equal(res.statusCode, 429);
});
