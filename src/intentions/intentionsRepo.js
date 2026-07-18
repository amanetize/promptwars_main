export function insertIntention(db, userId, { habitType, ifTrigger, thenAction }) {
  const info = db
    .prepare(
      `INSERT INTO implementation_intentions (user_id, habit_type, if_trigger, then_action)
       VALUES (?, ?, ?, ?)`
    )
    .run(userId, habitType ?? null, ifTrigger, thenAction);
  return getIntentionById(db, info.lastInsertRowid);
}

export function getIntentionById(db, id) {
  return db.prepare('SELECT * FROM implementation_intentions WHERE id = ?').get(id);
}

export function listIntentions(db, userId, { habitType, active } = {}) {
  const clauses = ['user_id = ?'];
  const params = [userId];
  if (habitType) {
    clauses.push('habit_type = ?');
    params.push(habitType);
  }
  if (active !== undefined) {
    clauses.push('active = ?');
    params.push(active ? 1 : 0);
  }
  const sql = `SELECT * FROM implementation_intentions WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`;
  return db.prepare(sql).all(...params);
}

// Scoped by userId so one user can never deactivate another's intention.
export function setIntentionActive(db, userId, id, active) {
  const info = db
    .prepare('UPDATE implementation_intentions SET active = ? WHERE id = ? AND user_id = ?')
    .run(active ? 1 : 0, id, userId);
  if (info.changes === 0) return null;
  return getIntentionById(db, id);
}
