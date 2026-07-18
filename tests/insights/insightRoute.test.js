import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { createInsightHandler } from '../../src/insights/insightRoute.js';
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

test('rejects an invalid habitType', async () => {
  const db = openTestDatabase();
  runMigrations(db);
  const handler = createInsightHandler({ db, apiKey: 'test', model: 'test-model' });
  const res = mockRes();
  await handler({ userId: 'u1', query: { habitType: 'not_real' } }, res);
  assert.equal(res.statusCode, 400);
});

test('returns 503 when apiKey is missing', async () => {
  const db = openTestDatabase();
  runMigrations(db);
  const handler = createInsightHandler({ db, apiKey: '', model: 'test-model' });
  const res = mockRes();
  await handler({ userId: 'u1', query: { habitType: 'screen_time' } }, res);
  assert.equal(res.statusCode, 503);
});

test('returns an insight generated from real aggregated data', async () => {
  const db = openTestDatabase();
  runMigrations(db);
  insertEvent(db, 'u1', { habitType: 'screen_time', source: 'manual', occurredAt: new Date().toISOString(), triggerTag: 'boredom', mood: 'bored', value: 90, label: null, notes: null });

  let capturedMessages;
  const requestCompletion = async ({ messages }) => {
    capturedMessages = messages;
    return { insightText: 'You tend to use your phone most when bored.', referencedStat: 'boredom (1x)', confidence: 'low' };
  };
  const handler = createInsightHandler({ db, apiKey: 'test', model: 'test-model', requestCompletion });
  const res = mockRes();
  await handler({ userId: 'u1', query: { habitType: 'screen_time' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.hasEnoughData, true);
  assert.match(capturedMessages[1].content, /boredom/);
});
