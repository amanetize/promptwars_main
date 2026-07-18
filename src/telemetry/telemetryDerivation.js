import { insertEvent } from '../tracking/eventsRepo.js';

// Which telemetry event types promote into a real habit_events row, and
// which habit type they represent. Only telemetry that maps to a habit the
// coaching/nudge/insight engine actually reasons over gets promoted —
// everything else stays in telemetry_events as raw substrate.
const DERIVABLE_EVENT_TYPES = {
  app_usage_summary: 'screen_time',
};

// Idempotent: re-running for the same user/day updates the existing derived
// row instead of duplicating it, so repeated syncs stay in sync with the
// latest telemetry total for that day.
export function deriveHabitEventsFromTelemetry(db, userId, { sinceDays = 7 } = {}) {
  const eventTypes = Object.keys(DERIVABLE_EVENT_TYPES);
  const placeholders = eventTypes.map(() => '?').join(',');

  const rows = db
    .prepare(
      `SELECT event_type, date(recorded_at) AS day, SUM(value_numeric) AS total
       FROM telemetry_events
       WHERE user_id = ? AND recorded_at >= date('now', ?) AND event_type IN (${placeholders})
       GROUP BY event_type, day`
    )
    .all(userId, `-${sinceDays} days`, ...eventTypes);

  const derived = [];
  for (const row of rows) {
    const habitType = DERIVABLE_EVENT_TYPES[row.event_type];
    const roundedValue = Math.round(row.total);

    const existing = db
      .prepare(
        `SELECT id FROM habit_events
         WHERE user_id = ? AND habit_type = ? AND source = 'device_sync' AND date(occurred_at) = ?`
      )
      .get(userId, habitType, row.day);

    if (existing) {
      db.prepare('UPDATE habit_events SET value = ? WHERE id = ?').run(roundedValue, existing.id);
      derived.push({ id: existing.id, habitType, day: row.day, value: roundedValue, updated: true });
      continue;
    }

    const event = insertEvent(db, userId, {
      habitType,
      source: 'device_sync',
      occurredAt: `${row.day}T12:00:00.000Z`,
      triggerTag: null,
      mood: null,
      value: roundedValue,
      label: null,
      notes: 'Derived from device sync telemetry',
    });
    derived.push({ ...event, updated: false });
  }
  return derived;
}
