export function insertEvent(db, userId, event) {
  const stmt = db.prepare(`
    INSERT INTO habit_events (user_id, habit_type, source, occurred_at, trigger_tag, mood, value, label, notes)
    VALUES (@userId, @habitType, @source, @occurredAt, @triggerTag, @mood, @value, @label, @notes)
  `);
  const info = stmt.run({ userId, ...event });
  return getEventById(db, info.lastInsertRowid);
}

export function getEventById(db, id) {
  return db.prepare('SELECT * FROM habit_events WHERE id = ?').get(id);
}

// Always scoped by userId — never accepts a caller-supplied user id.
export function listEvents(db, userId, { habitType, limit = 50, before } = {}) {
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (habitType) {
    clauses.push('habit_type = ?');
    params.push(habitType);
  }
  if (before) {
    clauses.push('occurred_at < ?');
    params.push(before);
  }
  const sql = `SELECT * FROM habit_events WHERE ${clauses.join(' AND ')} ORDER BY occurred_at DESC LIMIT ?`;
  params.push(Math.min(limit, 200));
  return db.prepare(sql).all(...params);
}
