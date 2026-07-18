import { getHabitType } from '../habitTypes.js';
import { computeState, getCrossHabitSummary } from '../tracking/stateRepo.js';
import { listEvents } from '../tracking/eventsRepo.js';
import { buildNudgeMessages } from './nudgePromptBuilder.js';
import { nudgeSchema } from './nudgeSchema.js';
import { requestWithModelFallback, OpenRouterError } from '../llm/openrouter.js';

// The "neediest" tracked habit: the one with the shortest current
// successful run. Falls back to null if the user has no data at all.
function pickFocusHabit(db, userId) {
  const summaries = getCrossHabitSummary(db, userId);
  if (summaries.length === 0) return null;
  return summaries.reduce((worst, current) => (current.currentRunDays < worst.currentRunDays ? current : worst))
    .habitType;
}

export function createNudgeHandler({ db, apiKey, models, requestCompletion = requestWithModelFallback }) {
  return async function getNudge(req, res) {
    const requestedHabitType = req.query.habitType;
    if (requestedHabitType && !getHabitType(requestedHabitType)) {
      return res.status(400).json({ error: `Unknown habitType "${requestedHabitType}".` });
    }

    const habitType = requestedHabitType || pickFocusHabit(db, req.userId) || 'screen_time';
    const state = computeState(db, req.userId, habitType);
    const recentEvents = listEvents(db, req.userId, { habitType, limit: 5 });
    const hasData = recentEvents.length > 0;

    if (!apiKey) {
      return res.status(503).json({ error: 'Server is missing OPENROUTER_API_KEY configuration.' });
    }

    const messages = buildNudgeMessages({ habitType, state, recentEvents, hasData });

    try {
      const nudge = await requestCompletion({ apiKey, models, messages, jsonSchema: nudgeSchema });
      return res.status(200).json({ habitType, ...nudge });
    } catch (err) {
      if (err instanceof OpenRouterError) {
        const status = err.status >= 400 && err.status < 600 ? err.status : 502;
        return res.status(status).json({ error: err.message });
      }
      console.error('Unexpected error in getNudge:', err);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}
