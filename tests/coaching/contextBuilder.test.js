import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';
import { buildCoachMessages } from '../../src/coaching/contextBuilder.js';
import { insertMessage } from '../../src/coaching/messagesRepo.js';
import { upsertSummary } from '../../src/coaching/summaryRepo.js';
import { insertEvent } from '../../src/tracking/eventsRepo.js';
import { upsertUserHabitState } from '../../src/tracking/stateRepo.js';
import { insertIntention } from '../../src/intentions/intentionsRepo.js';
import { STATIC_SYSTEM_PROMPT } from '../../src/coaching/systemPrompt.js';

function setup() {
  const db = openTestDatabase();
  runMigrations(db);
  return db;
}

test('static system prompt is always the first message', () => {
  const db = setup();
  const messages = buildCoachMessages(db, 'u1', 'hello', null);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, new RegExp(STATIC_SYSTEM_PROMPT.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('new user message is always the trailing entry, isolated from prior turns', () => {
  const db = setup();
  insertMessage(db, 'u1', { role: 'user', content: 'earlier turn' });
  insertMessage(db, 'u1', { role: 'assistant', content: 'earlier reply' });

  const messages = buildCoachMessages(db, 'u1', 'brand new message', null);
  const last = messages[messages.length - 1];
  assert.equal(last.role, 'user');
  assert.equal(last.content, 'brand new message');
});

test('state block reflects seeded habit state for the focused habit', () => {
  const db = setup();
  insertEvent(db, 'u1', {
    habitType: 'screen_time',
    source: 'manual',
    occurredAt: new Date().toISOString(),
    triggerTag: 'boredom',
    mood: 'bored',
    value: 40,
    label: null,
    notes: null,
  });
  upsertUserHabitState(db, 'u1', 'screen_time', { stageOfChange: 'action' });

  const messages = buildCoachMessages(db, 'u1', 'how am I doing?', 'screen_time');
  const stateMessage = messages.find((m) => m.content.includes('Current state:'));
  assert.match(stateMessage.content, /FOCUS HABIT/);
  assert.match(stateMessage.content, /stage of change: action/);
  assert.match(stateMessage.content, /boredom/);
});

test('includes the conversation summary when one exists', () => {
  const db = setup();
  upsertSummary(db, 'u1', { summaryText: 'User struggles most on weeknights.', coversThroughMessageId: 0 });
  const messages = buildCoachMessages(db, 'u1', 'hi again', null);
  assert.ok(messages.some((m) => m.content.includes('User struggles most on weeknights.')));
});

test('active implementation intentions are surfaced in context', () => {
  const db = setup();
  insertIntention(db, 'u1', { habitType: 'screen_time', ifTrigger: 'phone buzzes at night', thenAction: 'leave it in the kitchen' });
  const messages = buildCoachMessages(db, 'u1', 'hi', 'screen_time');
  assert.ok(messages.some((m) => m.content.includes('phone buzzes at night')));
});

test('only includes the last N raw turns, not the full history', () => {
  const db = setup();
  for (let i = 0; i < 20; i += 1) {
    insertMessage(db, 'u1', { role: i % 2 === 0 ? 'user' : 'assistant', content: `turn ${i}` });
  }
  const messages = buildCoachMessages(db, 'u1', 'latest', null);
  const turnMessages = messages.filter((m) => /^turn \d+$/.test(m.content));
  assert.ok(turnMessages.length <= 6, 'should cap raw verbatim turns, not send full history');
});
