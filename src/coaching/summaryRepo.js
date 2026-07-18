export function getSummary(db, userId) {
  return db.prepare('SELECT * FROM coaching_summaries WHERE user_id = ?').get(userId);
}

export function upsertSummary(db, userId, { summaryText, coversThroughMessageId }) {
  const existing = getSummary(db, userId);
  if (existing) {
    db.prepare(
      `UPDATE coaching_summaries
       SET summary_text = ?, covers_through_message_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE user_id = ?`
    ).run(summaryText, coversThroughMessageId, userId);
  } else {
    db.prepare(
      `INSERT INTO coaching_summaries (user_id, summary_text, covers_through_message_id) VALUES (?, ?, ?)`
    ).run(userId, summaryText, coversThroughMessageId);
  }
  return getSummary(db, userId);
}
