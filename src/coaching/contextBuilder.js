import { STATIC_SYSTEM_PROMPT, STAGE_GUIDANCE } from './systemPrompt.js';
import { getHabitType } from '../habitTypes.js';
import { computeState, getCrossHabitSummary } from '../tracking/stateRepo.js';
import { listIntentions } from '../intentions/intentionsRepo.js';
import { listRecentMessages } from './messagesRepo.js';
import { getSummary } from './summaryRepo.js';

const RAW_TURN_COUNT = 6;

// Full detail only for the focused habit; one-line summaries for the rest,
// so token cost doesn't grow unbounded as a user tracks more habit types.
function buildStateBlock(db, userId, habitTypeContext) {
  const summaries = getCrossHabitSummary(db, userId);
  if (summaries.length === 0) {
    return 'No habit data logged yet.';
  }
  return summaries
    .map((s) => {
      const habitTypeConfig = getHabitType(s.habitType);
      if (s.habitType !== habitTypeContext) {
        return `${habitTypeConfig.label}: stage=${s.stageOfChange}${s.completionRate ? `, ${s.completionRate.label}` : ''}.`;
      }
      return [
        `FOCUS HABIT — ${habitTypeConfig.label}:`,
        `  stage of change: ${s.stageOfChange}`,
        s.completionRate ? `  completion rate: ${s.completionRate.label}` : '  no numeric goal tracked',
        `  current successful run: ${s.currentRunDays} day(s)`,
        s.topTriggers.length ? `  top triggers: ${s.topTriggers.map((t) => t.trigger).join(', ')}` : '  no trigger data yet',
      ].join('\n');
    })
    .join('\n');
}

function buildIntentionsBlock(db, userId, habitTypeContext) {
  const intentions = listIntentions(db, userId, { active: true }).filter(
    (i) => !habitTypeContext || !i.habit_type || i.habit_type === habitTypeContext
  );
  if (intentions.length === 0) return 'No active implementation intentions yet.';
  return intentions.map((i) => `If ${i.if_trigger}, then ${i.then_action}.`).join('\n');
}

// Server-managed context: reconstructed from the DB every turn, never from
// client-supplied history. Role-structured throughout — the new user
// message is always its own trailing entry, never string-concatenated.
export function buildCoachMessages(db, userId, newUserMessage, habitTypeContext) {
  const stageOfChange = habitTypeContext
    ? computeState(db, userId, habitTypeContext)?.stageOfChange ?? 'contemplation'
    : 'contemplation';

  const systemPrefix = `${STATIC_SYSTEM_PROMPT}\n\n${STAGE_GUIDANCE[stageOfChange] ?? ''}`;
  const stateBlock = buildStateBlock(db, userId, habitTypeContext);
  const intentionsBlock = buildIntentionsBlock(db, userId, habitTypeContext);
  const summaryRow = getSummary(db, userId);
  const recentMessages = listRecentMessages(db, userId, RAW_TURN_COUNT);

  const messages = [
    { role: 'system', content: systemPrefix },
    { role: 'system', content: `Current state:\n${stateBlock}\n\nActive implementation intentions:\n${intentionsBlock}` },
  ];

  if (summaryRow?.summary_text) {
    messages.push({ role: 'system', content: `Summary of earlier conversation:\n${summaryRow.summary_text}` });
  }

  for (const msg of recentMessages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: 'user', content: newUserMessage });

  return messages;
}
