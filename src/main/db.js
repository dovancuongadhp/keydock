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
    CREATE TABLE IF NOT EXISTS revisions (
      id TEXT PRIMARY KEY,
      entry_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_revisions_entry ON revisions (entry_id, created_at DESC);
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
  const insertRevisionStmt = database.prepare(`
    INSERT INTO revisions (id, entry_id, payload, action, created_at)
    VALUES (@id, @entryId, @payload, @action, @createdAt)
  `);
  const listRevisionsStmt = database.prepare(`
    SELECT id, entry_id, payload, action, created_at
    FROM revisions WHERE entry_id = ? ORDER BY created_at DESC
  `);
  const getRevisionStmt = database.prepare(`
    SELECT id, entry_id, payload, action, created_at FROM revisions WHERE id = ?
  `);
  const listDeletedStmt = database.prepare(`
    SELECT id, entry_id, payload, action, created_at
    FROM revisions WHERE action = 'delete' ORDER BY created_at DESC
  `);
  const staleRevisionsStmt = database.prepare(`
    SELECT id FROM revisions WHERE entry_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 40
  `);
  const deleteRevisionStmt = database.prepare('DELETE FROM revisions WHERE id = ?');
  const deleteEntryRevisionsStmt = database.prepare('DELETE FROM revisions WHERE entry_id = ?');

  function mapRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      payload: row.payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  function mapRevision(row) {
    if (!row) return null;
    return {
      id: row.id,
      entryId: row.entry_id,
      payload: row.payload,
      action: row.action,
      createdAt: row.created_at,
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
    insertRevision(row) {
      insertRevisionStmt.run(row);
      for (const stale of staleRevisionsStmt.all(row.entryId)) deleteRevisionStmt.run(stale.id);
    },
    listRevisions(entryId) {
      return listRevisionsStmt.all(entryId).map(mapRevision);
    },
    getRevision(id) {
      return mapRevision(getRevisionStmt.get(id));
    },
    listDeletedRevisions() {
      return listDeletedStmt.all().map(mapRevision);
    },
    deleteEntryRevisions(entryId) {
      deleteEntryRevisionsStmt.run(entryId);
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
