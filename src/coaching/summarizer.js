import { getSummary, upsertSummary } from './summaryRepo.js';
import { listMessagesSince } from './messagesRepo.js';
import { requestWithModelFallback } from '../llm/openrouter.js';

const SUMMARY_THRESHOLD = 8;

const summarySchema = {
  name: 'coaching_summary',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Updated dense summary of the coaching relationship so far' },
    },
    required: ['summary'],
    additionalProperties: false,
  },
};

// Runs a small background LLM call once enough unsummarized turns have
// accumulated, folding them into one evolving summary so future coaching
// calls send a compact summary instead of an ever-growing raw transcript.
export async function maybeRefreshSummary(db, userId, { apiKey, models, requestCompletion = requestWithModelFallback }) {
  const summaryRow = getSummary(db, userId) ?? { summary_text: '', covers_through_message_id: 0 };
  const newMessages = listMessagesSince(db, userId, summaryRow.covers_through_message_id);
  if (newMessages.length < SUMMARY_THRESHOLD) return null;

  const transcript = newMessages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const messages = [
    {
      role: 'system',
      content:
        'Update the running summary of this behavioral-coaching relationship. Be dense and factual: note triggers, ' +
        'progress, emotional patterns, and plans discussed. Do not include therapy jargon or invented details.',
    },
    {
      role: 'user',
      content: `Previous summary:\n${summaryRow.summary_text || '(none yet)'}\n\nNew messages:\n${transcript}`,
    },
  ];

  const result = await requestCompletion({ apiKey, models, messages, jsonSchema: summarySchema });
  const lastId = newMessages[newMessages.length - 1].id;
  return upsertSummary(db, userId, { summaryText: result.summary, coversThroughMessageId: lastId });
}
