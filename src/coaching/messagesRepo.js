export function insertMessage(
  db,
  userId,
  { role, content, habitTypeContext, detectedPrimaryEmotion, stageTransition, crisisFlag }
) {
  const info = db
    .prepare(
      `INSERT INTO coaching_messages
         (user_id, role, content, habit_type_context, detected_primary_emotion, stage_transition, crisis_flag)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      role,
      content,
      habitTypeContext ?? null,
      detectedPrimaryEmotion ?? null,
      stageTransition ?? null,
      crisisFlag === undefined ? null : crisisFlag ? 1 : 0
    );
  return getMessageById(db, info.lastInsertRowid);
}

export function getMessageById(db, id) {
  return db.prepare('SELECT * FROM coaching_messages WHERE id = ?').get(id);
}

// Oldest-first, for direct inclusion as verbatim turns in a coaching prompt.
export function listRecentMessages(db, userId, limit = 6) {
  const rows = db
    .prepare('SELECT * FROM coaching_messages WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit);
  return rows.reverse();
}

export function listMessagesSince(db, userId, sinceId) {
  return db
    .prepare('SELECT * FROM coaching_messages WHERE user_id = ? AND id > ? ORDER BY id ASC')
    .all(userId, sinceId);
}

export function listAllMessages(db, userId, limit = 200) {
  return db
    .prepare('SELECT * FROM coaching_messages WHERE user_id = ? ORDER BY id ASC LIMIT ?')
    .all(userId, limit);
}
