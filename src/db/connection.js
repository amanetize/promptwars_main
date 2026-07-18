import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'data', 'brohab.db');

export function openDatabase(dbPath = DEFAULT_DB_PATH) {
  const isMemory = dbPath === ':memory:';
  if (!isMemory) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  if (!isMemory) {
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// Fresh in-memory database for tests — isolated, no filesystem side effects.
export function openTestDatabase() {
  return openDatabase(':memory:');
}
