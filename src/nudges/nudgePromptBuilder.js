import { getHabitType } from '../habitTypes.js';

function timeOfDayBucket(date = new Date()) {
  const hour = date.getUTCHours();
  if (hour < 5) return 'late-night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'late-night';
}

// Assembles a compact, role-structured, facts-only context for the nudge
// writer — never a static string array. If the user has no data yet, the
// prompt says so explicitly so the model invites a first log instead of
// inventing history.
export function buildNudgeMessages({ habitType, state, recentEvents, hasData }) {
  const habitTypeConfig = getHabitType(habitType);
  const bucket = timeOfDayBucket();

  const contextLines = hasData
    ? [
        `Habit: ${habitTypeConfig.label} (${
          habitTypeConfig.goalDirection === 'abstinence'
            ? 'goal: abstain'
            : `goal: stay under ${state.dailyGoalValue} ${habitTypeConfig.valueUnit}/day`
        }).`,
        state.completionRate
          ? `Completion rate: ${state.completionRate.label}.`
          : 'No numeric goal tracked for this custom habit.',
        `Current successful run: ${state.currentRunDays} day(s).`,
        state.topTriggers.length
          ? `Frequent triggers: ${state.topTriggers.map((t) => t.trigger).join(', ')}.`
          : 'No trigger data logged yet.',
        `Recent entries: ${
          recentEvents
            .map((e) => `${e.occurred_at.slice(0, 10)} — ${e.value}${e.trigger_tag ? ` (${e.trigger_tag})` : ''}`)
            .join('; ') || 'none'
        }.`,
        `Time of day: ${bucket}.`,
      ]
    : [`Habit: ${habitTypeConfig.label}. No entries logged yet.`, `Time of day: ${bucket}.`];

  return [
    {
      role: 'system',
      content:
        "You're the user's habit bro — write ONE short, casual nudge (max 2 sentences) like a friend checking in, not a wellness app. " +
        'Contractions, second person, present tense; a casual word like "bro/dude/man" is fine but don\'t force it every time. ' +
        'Never lecture, never shame — a slip is just data. ' +
        'Base it strictly on the real data given below — never invent numbers, streaks, or events not present in the context. ' +
        'If no data is present, invite the user to log their first entry rather than referencing fake history. ' +
        'Vary tone and phrasing naturally each time; never fall back to a generic template. ' +
        'Optionally suggest one small, concrete micro-action.',
    },
    { role: 'user', content: contextLines.join('\n') },
  ];
}
