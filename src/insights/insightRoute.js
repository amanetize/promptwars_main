import { getHabitType } from '../habitTypes.js';
import { buildAggregatedSummary } from './insightAggregator.js';
import { insightSchema } from './insightSchema.js';
import { requestWithModelFallback, OpenRouterError } from '../llm/openrouter.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildInsightMessages(summary, habitTypeConfig) {
  const lines = [
    `Habit: ${habitTypeConfig.label}.`,
    summary.topTriggers.length
      ? `Top triggers: ${summary.topTriggers.map((t) => `${t.trigger} (${t.count}x)`).join(', ')}.`
      : 'No trigger data.',
    summary.hourHistogram.length
      ? `Most common hours logged: ${summary.hourHistogram.map((h) => `${h.hour}:00 (${h.count}x)`).join(', ')}.`
      : 'No hour-of-day data.',
    summary.dayOfWeekDistribution.length
      ? `Day-of-week distribution: ${summary.dayOfWeekDistribution.map((d) => `${DAY_NAMES[d.weekday]}: ${d.count}`).join(', ')}.`
      : 'No day-of-week data.',
    summary.moodCorrelation.length
      ? `Average value by mood: ${summary.moodCorrelation.map((m) => `${m.mood}: ${m.avgValue}`).join(', ')}.`
      : 'No mood data.',
    `Trailing 30-day total: ${summary.trend.recentTotal}. Prior 30-day total: ${summary.trend.priorTotal}.`,
  ];
  return [
    {
      role: 'system',
      content:
        "You're the user's habit bro, breaking down their own data for them in plain, casual language — like a friend " +
        'pointing out a pattern, not a clinical report. Produce one short, specific, data-grounded insight. Reference an ' +
        'actual number from the input data in referencedStat. Never invent statistics not present in the input. If the ' +
        'data is too sparse to find a real pattern, say so honestly instead of fabricating one.',
    },
    { role: 'user', content: lines.join('\n') },
  ];
}

export function createInsightHandler({ db, apiKey, models, requestCompletion = requestWithModelFallback }) {
  return async function getInsight(req, res) {
    const { habitType } = req.query;
    const habitTypeConfig = getHabitType(habitType);
    if (!habitTypeConfig) {
      return res.status(400).json({ error: 'A valid habitType is required.' });
    }
    if (!apiKey) {
      return res.status(503).json({ error: 'Server is missing OPENROUTER_API_KEY configuration.' });
    }

    const summary = buildAggregatedSummary(db, req.userId, habitType);
    const messages = buildInsightMessages(summary, habitTypeConfig);

    try {
      const insight = await requestCompletion({ apiKey, models, messages, jsonSchema: insightSchema });
      return res.status(200).json({ habitType, hasEnoughData: summary.hasEnoughData, ...insight });
    } catch (err) {
      if (err instanceof OpenRouterError) {
        const status = err.status >= 400 && err.status < 600 ? err.status : 502;
        return res.status(status).json({ error: err.message });
      }
      console.error('Unexpected error in getInsight:', err);
      return res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  };
}
