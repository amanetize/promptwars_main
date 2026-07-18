// Idempotent batch insert: (user_id, sync_batch_id, batch_seq) has a unique
// index, so retried syncs (e.g. after a dropped connection) don't duplicate
// rows — INSERT OR IGNORE silently skips ones already recorded.
export function insertTelemetryBatch(db, userId, { deviceId, syncBatchId, events }) {
  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO telemetry_events
       (user_id, device_id, event_type, value_numeric, value_json, unit, recorded_at, recorded_tz, source, sync_batch_id, batch_seq)
     VALUES (@userId, @deviceId, @eventType, @valueNumeric, @valueJson, @unit, @recordedAt, @recordedTz, 'device_sync', @syncBatchId, @batchSeq)`
  );

  const insertMany = db.transaction((rows) => {
    let inserted = 0;
    for (const row of rows) {
      const info = insertStmt.run(row);
      if (info.changes > 0) inserted += 1;
    }
    return inserted;
  });

  const rows = events.map((event, index) => ({
    userId,
    deviceId,
    eventType: event.eventType,
    valueNumeric: event.valueNumeric,
    valueJson: event.metadata ? JSON.stringify(event.metadata) : null,
    unit: event.unit,
    recordedAt: event.recordedAt,
    recordedTz: event.recordedTz,
    syncBatchId,
    batchSeq: syncBatchId ? index : null,
  }));

  return insertMany(rows);
}

// The one genuinely-real, unsimulated telemetry source (Page Visibility API
// in-app time) — labeled distinctly with source='browser_telemetry', never
// standing in for a phone/wearable.
export function insertBrowserTimeEvent(db, userId, { minutes, recordedAt, recordedTz }) {
  const deviceId = `browser:${userId}`;
  const info = db
    .prepare(
      `INSERT INTO telemetry_events (user_id, device_id, event_type, value_numeric, unit, recorded_at, recorded_tz, source)
       VALUES (?, ?, 'browser_time_in_app', ?, 'minutes', ?, ?, 'browser_telemetry')`
    )
    .run(userId, deviceId, minutes, recordedAt, recordedTz);
  return db.prepare('SELECT * FROM telemetry_events WHERE id = ?').get(info.lastInsertRowid);
}

export function summarizeTelemetry(db, userId, { eventType, sinceDays = 30 } = {}) {
  const clauses = ['user_id = ?', "recorded_at >= date('now', ?)"];
  const params = [userId, `-${sinceDays} days`];
  if (eventType) {
    clauses.push('event_type = ?');
    params.push(eventType);
  }
  const sql = `
    SELECT event_type, date(recorded_at) AS day, SUM(value_numeric) AS total, COUNT(*) AS count
    FROM telemetry_events
    WHERE ${clauses.join(' AND ')}
    GROUP BY event_type, day
    ORDER BY day DESC
  `;
  return db.prepare(sql).all(...params);
}
