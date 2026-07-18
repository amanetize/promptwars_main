import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openTestDatabase } from '../../src/db/connection.js';
import { runMigrations } from '../../src/db/migrations.js';

test('migrations are idempotent and create all expected tables', () => {
  const db = openTestDatabase();
  runMigrations(db);
  runMigrations(db); // second run must not throw

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((row) => row.name);

  for (const expected of [
    'habit_events',
    'telemetry_events',
    'user_habit_state',
    'implementation_intentions',
    'coaching_messages',
    'coaching_summaries',
  ]) {
    assert.ok(tables.includes(expected), `expected table ${expected} to exist`);
  }
  db.close();
});
