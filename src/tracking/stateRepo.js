import { getHabitType } from '../habitTypes.js';

const WINDOW_DAYS = 30;

// Streak/completion-rate must not be a fragile all-or-nothing consecutive
// counter, and must not miss "success" days that have zero logged events
// (e.g. an abstinence day). A recursive CTE scaffolds every calendar day
// in the trailing window first, then LEFT JOINs actual events, so absent
// days are visible as zero-occurrence rather than absent rows.
function computeDailyTotals(db, userId, habitType) {
  return db
    .prepare(
      `
      WITH RECURSIVE d(day) AS (
        SELECT date('now', ?)
        UNION ALL
        SELECT date(day, '+1 day') FROM d WHERE day < date('now')
      )
      SELECT
        d.day AS day,
        COALESCE(SUM(e.value), 0) AS total_value,
        COUNT(e.id) AS occurrences
      FROM d
      LEFT JOIN habit_events e
        ON e.user_id = ? AND e.habit_type = ? AND date(e.occurred_at) = d.day
      GROUP BY d.day
      ORDER BY d.day
      `
    )
    .all(`-${WINDOW_DAYS - 1} days`, userId, habitType);
}

export function computeState(db, userId, habitType) {
  const habitTypeConfig = getHabitType(habitType);
  if (!habitTypeConfig) return null;

  const stateRow = db
    .prepare('SELECT * FROM user_habit_state WHERE user_id = ? AND habit_type = ?')
    .get(userId, habitType);

  const dailyGoalValue = stateRow?.daily_goal_value ?? habitTypeConfig.defaultDailyGoal;
  const stageOfChange = stateRow?.stage_of_change ?? 'contemplation';

  const dailyTotals = computeDailyTotals(db, userId, habitType);

  let successDays = 0;
  const dayResults = dailyTotals.map((row) => {
    let success = null;
    // custom habit types have no numeric goal — report logged/not-logged only, no ratio.
    if (dailyGoalValue !== null) {
      success =
        habitTypeConfig.goalDirection === 'abstinence'
          ? row.occurrences === 0
          : row.total_value <= dailyGoalValue;
      if (success) successDays += 1;
    }
    return { day: row.day, occurrences: row.occurrences, totalValue: row.total_value, success };
  });

  let currentRunDays = 0;
  for (let i = dayResults.length - 1; i >= 0; i -= 1) {
    if (dayResults[i].success === true) {
      currentRunDays += 1;
    } else {
      break;
    }
  }

  const completionRate =
    dailyGoalValue === null
      ? null
      : { successDays, totalDays: WINDOW_DAYS, label: `${successDays}/${WINDOW_DAYS} days` };

  const topTriggers = db
    .prepare(
      `SELECT trigger_tag AS trigger, COUNT(*) AS count
       FROM habit_events
       WHERE user_id = ? AND habit_type = ? AND trigger_tag IS NOT NULL
       GROUP BY trigger_tag
       ORDER BY count DESC
       LIMIT 5`
    )
    .all(userId, habitType);

  const moodTrend = db
    .prepare(
      `SELECT date(occurred_at) AS day, mood
       FROM habit_events
       WHERE user_id = ? AND habit_type = ? AND mood IS NOT NULL
       ORDER BY occurred_at DESC
       LIMIT 14`
    )
    .all(userId, habitType);

  return {
    habitType,
    stageOfChange,
    dailyGoalValue,
    completionRate,
    currentRunDays,
    topTriggers,
    moodTrend,
  };
}

export function getCrossHabitSummary(db, userId) {
  const habitTypes = db
    .prepare('SELECT DISTINCT habit_type FROM habit_events WHERE user_id = ?')
    .all(userId)
    .map((row) => row.habit_type);
  return habitTypes.map((habitType) => computeState(db, userId, habitType));
}

export function upsertUserHabitState(db, userId, habitType, { stageOfChange, dailyGoalValue } = {}) {
  const existing = db
    .prepare('SELECT * FROM user_habit_state WHERE user_id = ? AND habit_type = ?')
    .get(userId, habitType);

  if (existing) {
    db.prepare(
      `UPDATE user_habit_state
       SET stage_of_change = COALESCE(?, stage_of_change),
           daily_goal_value = COALESCE(?, daily_goal_value),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE user_id = ? AND habit_type = ?`
    ).run(stageOfChange ?? null, dailyGoalValue ?? null, userId, habitType);
  } else {
    db.prepare(
      `INSERT INTO user_habit_state (user_id, habit_type, stage_of_change, daily_goal_value)
       VALUES (?, ?, ?, ?)`
    ).run(userId, habitType, stageOfChange ?? 'contemplation', dailyGoalValue ?? null);
  }

  return db.prepare('SELECT * FROM user_habit_state WHERE user_id = ? AND habit_type = ?').get(userId, habitType);
}
