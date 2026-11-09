const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function openDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new Database(filePath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 3000');
  database.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  const getMetaStmt = database.prepare('SELECT value FROM meta WHERE key = ?');
  const setMetaStmt = database.prepare(`
    INSERT INTO meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const insertStmt = database.prepare(`
    INSERT INTO entries (id, payload, created_at, updated_at)
    VALUES (@id, @payload, @createdAt, @updatedAt)
  `);
  const updateStmt = database.prepare(`
    UPDATE entries SET payload = ?, updated_at = ? WHERE id = ?
  `);
  const deleteStmt = database.prepare('DELETE FROM entries WHERE id = ?');
  const getStmt = database.prepare('SELECT id, payload, created_at, updated_at FROM entries WHERE id = ?');
  const allStmt = database.prepare('SELECT id, payload, created_at, updated_at FROM entries');

  function mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      payload: row.payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  const api = {
    isInitialized() {
      return Boolean(getMetaStmt.get('verifier'));
    },
    getMeta(key) {
      const row = getMetaStmt.get(key);
      return row ? row.value : null;
    },
    setMeta(key, value) {
      setMetaStmt.run(key, String(value));
    },
    insertEntry(row) {
      insertStmt.run(row);
    },
    updateEntry(id, patch) {
      const current = api.getEntry(id);
      if (!current) return false;
      const next = { ...current, ...patch };
      updateStmt.run(next.payload, next.updatedAt, id);
      return true;
    },
    deleteEntry(id) {
      return deleteStmt.run(id).changes > 0;
    },
    getEntry(id) {
      return mapRow(getStmt.get(id));
    },
    allEntries() {
      return allStmt.all().map(mapRow);
    },
    transaction(fn) {
      database.transaction(fn)();
    },
    close() {
      database.close();
    },
  };

  return api;
}

module.exports = { openDatabase };
