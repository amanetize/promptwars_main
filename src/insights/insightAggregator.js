import { getHabitType } from '../habitTypes.js';

// Targeted aggregate queries only — never a raw event dump — so the
// insight-generating LLM call stays token-efficient regardless of how much
// history a user accumulates.
export function buildAggregatedSummary(db, userId, habitType) {
  const habitTypeConfig = getHabitType(habitType);
  if (!habitTypeConfig) return null;

  const topTriggers = db
    .prepare(
      `SELECT trigger_tag AS trigger, COUNT(*) AS count
       FROM habit_events
       WHERE user_id = ? AND habit_type = ? AND trigger_tag IS NOT NULL
       GROUP BY trigger_tag ORDER BY count DESC LIMIT 5`
    )
    .all(userId, habitType);

  const hourHistogram = db
    .prepare(
      `SELECT CAST(strftime('%H', occurred_at) AS INTEGER) AS hour, COUNT(*) AS count
       FROM habit_events
       WHERE user_id = ? AND habit_type = ?
       GROUP BY hour ORDER BY count DESC LIMIT 5`
    )
    .all(userId, habitType);

  const dayOfWeekDistribution = db
    .prepare(
      `SELECT CAST(strftime('%w', occurred_at) AS INTEGER) AS weekday, COUNT(*) AS count
       FROM habit_events
       WHERE user_id = ? AND habit_type = ?
       GROUP BY weekday ORDER BY count DESC`
    )
    .all(userId, habitType);

  const moodCorrelationRaw = db
    .prepare(
      `SELECT mood, AVG(value) AS avgValue, COUNT(*) AS count
       FROM habit_events
       WHERE user_id = ? AND habit_type = ? AND mood IS NOT NULL
       GROUP BY mood ORDER BY avgValue DESC`
    )
    .all(userId, habitType);

  const trend = db
    .prepare(
      `SELECT
         SUM(CASE WHEN occurred_at >= date('now','-29 days') THEN value ELSE 0 END) AS recentTotal,
         SUM(CASE WHEN occurred_at < date('now','-29 days') AND occurred_at >= date('now','-59 days') THEN value ELSE 0 END) AS priorTotal
       FROM habit_events
       WHERE user_id = ? AND habit_type = ?`
    )
    .get(userId, habitType);

  const moodCorrelation = moodCorrelationRaw.map((m) => ({
    mood: m.mood,
    avgValue: Math.round((m.avgValue ?? 0) * 10) / 10,
    count: m.count,
  }));

  const recentTotal = trend?.recentTotal ?? 0;
  const priorTotal = trend?.priorTotal ?? 0;
  const hasEnoughData = topTriggers.length > 0 || hourHistogram.length > 0 || recentTotal > 0 || priorTotal > 0;

  return {
    habitType,
    hasEnoughData,
    topTriggers,
    hourHistogram,
    dayOfWeekDistribution,
    moodCorrelation,
    trend: { recentTotal, priorTotal },
  };
}
