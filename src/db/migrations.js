// Idempotent schema setup — safe to run on every boot.
const MIGRATIONS_SQL = `
CREATE TABLE IF NOT EXISTS habit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  habit_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','device_sync')),
  occurred_at TEXT NOT NULL,
  trigger_tag TEXT,
  mood TEXT,
  value INTEGER,
  label TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_habit_events_user_type_date ON habit_events(user_id, habit_type, occurred_at);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  value_numeric REAL,
  value_json TEXT,
  unit TEXT,
  recorded_at TEXT NOT NULL,
  recorded_tz TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'device_sync' CHECK (source IN ('device_sync','browser_telemetry')),
  sync_batch_id TEXT,
  batch_seq INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_user_type_date ON telemetry_events(user_id, event_type, recorded_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_telemetry_events_batch_dedupe
  ON telemetry_events(user_id, sync_batch_id, batch_seq)
  WHERE sync_batch_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_habit_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  habit_type TEXT NOT NULL,
  stage_of_change TEXT NOT NULL DEFAULT 'contemplation'
    CHECK (stage_of_change IN ('precontemplation','contemplation','preparation','action','maintenance')),
  daily_goal_value INTEGER,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, habit_type)
);

CREATE TABLE IF NOT EXISTS implementation_intentions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  habit_type TEXT,
  if_trigger TEXT NOT NULL,
  then_action TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_intentions_user ON implementation_intentions(user_id, active);

CREATE TABLE IF NOT EXISTS coaching_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  habit_type_context TEXT,
  detected_primary_emotion TEXT,
  stage_transition TEXT,
  crisis_flag INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_coaching_messages_user ON coaching_messages(user_id, created_at);

CREATE TABLE IF NOT EXISTS coaching_summaries (
  user_id TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL DEFAULT '',
  covers_through_message_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

export function runMigrations(db) {
  db.exec(MIGRATIONS_SQL);
}
