const test = require('node:test');
const assert = require('node:assert/strict');
const { createVault } = require('../src/main/vault');

function memoryDatabase() {
  const meta = new Map();
  const entries = new Map();
  const api = {
    isInitialized() {
      return meta.has('verifier');
    },
    getMeta(key) {
      return meta.has(key) ? meta.get(key) : null;
    },
    setMeta(key, value) {
      meta.set(key, String(value));
    },
    insertEntry(row) {
      entries.set(row.id, { ...row });
    },
    updateEntry(id, patch) {
      const current = api.getEntry(id);
      if (!current) return false;
      entries.set(id, { ...current, ...patch });
      return true;
    },
    deleteEntry(id) {
      return entries.delete(id);
    },
    getEntry(id) {
      const row = entries.get(id);
      return row ? { ...row } : null;
    },
    allEntries() {
      return [...entries.values()].map((row) => ({ ...row }));
    },
    transaction(fn) {
      const metaBackup = new Map(meta);
      const entryBackup = new Map([...entries].map(([id, row]) => [id, { ...row }]));
      try {
        fn();
      } catch (error) {
        meta.clear();
        for (const [key, value] of metaBackup) meta.set(key, value);
        entries.clear();
        for (const [id, row] of entryBackup) entries.set(id, row);
        throw error;
      }
    },
    close() {},
    dump() {
      return {
        meta: [...meta.entries()],
        payloads: [...entries.values()].map((row) => row.payload),
      };
    },
  };
  return api;
}

async function unlockedVault() {
  const database = memoryDatabase();
  const vault = createVault(database, { kdfIterations: 1000 });
  await vault.setup('test-password');
  return { database, vault };
}

test('setup stores the production KDF and never writes the master password', async () => {
  const database = memoryDatabase();
  const vault = createVault(database);
  assert.equal(vault.isInitialized(), false);
  await vault.setup('production-iterations');
  assert.equal(database.getMeta('kdf'), 'pbkdf2-sha256');
  assert.equal(database.getMeta('kdf_iterations'), '600000');
  const dumped = JSON.stringify(database.dump());
  assert.equal(dumped.includes('production-iterations'), false);
  vault.lock();
  assert.equal(vault.isUnlocked(), false);
  assert.throws(() => vault.list(), (error) => error.code === 'LOCKED');
});

test('unlock accepts the master password and rejects a different one', async () => {
  const { vault } = await unlockedVault();
  vault.lock();
  await vault.unlock('test-password');
  assert.equal(vault.isUnlocked(), true);
  await assert.rejects(
    () => vault.unlock('wrong-password-here'),
    (error) => error.code === 'AUTH',
  );
  assert.equal(vault.isUnlocked(), true);
});

test('entries stay encrypted at rest and round-trip in memory', async () => {
  const { database, vault } = await unlockedVault();
  const created = vault.create({
    title: 'Router',
    username: 'admin',
    password: 'unique-router-secret-value',
    host: '192.168.1.1',
    category: 'server',
    note: 'Cổng quản trị',
  });
  const stored = JSON.stringify(database.dump());
  assert.equal(stored.includes('unique-router-secret-value'), false);
  assert.equal(stored.includes('admin'), false);
  const summary = vault.list();
  assert.equal(summary[0].password, undefined);
  assert.equal(summary[0].category, 'Server');
  assert.equal(vault.get(created.id).password, 'unique-router-secret-value');
  assert.equal(vault.getPassword(created.id), 'unique-router-secret-value');
  vault.update(created.id, {
    title: 'Router',
    username: 'root',
    password: 'rotated-secret-value',
    host: '10.0.0.1',
    category: 'Server',
    note: '',
  });
  assert.equal(vault.get(created.id).username, 'root');
  vault.remove(created.id);
  assert.equal(vault.list().length, 0);
});

test('import overwrites or skips records with the same title', async () => {
  const { vault } = await unlockedVault();
  vault.create({
    title: 'GitHub',
    username: 'ada',
    password: 'old-password',
    host: 'github.com',
    category: 'Web',
    note: '',
  });
  const preview = vault.beginImport([
    { title: 'GitHub', username: 'ada', password: 'new-password', host: 'github.com', category: 'Web', note: 'work' },
    { title: 'Mail', username: 'ada@ex.com', password: 'mail-secret', host: 'imap.example', category: 'Email', note: '' },
    { title: 'Mail', username: 'other', password: 'later-secret', host: 'imap.example', category: 'Email', note: '' },
    { username: 'missing-title' },
  ]);
  assert.deepEqual(
    { newCount: preview.newCount, duplicateCount: preview.duplicateCount, invalidCount: preview.invalidCount },
    { newCount: 1, duplicateCount: 2, invalidCount: 1 },
  );

  const skipped = vault.applyImport('skip');
  assert.deepEqual(skipped, { created: 1, overwritten: 0, skipped: 2 });
  assert.equal(vault.getPassword(vault.list().find((entry) => entry.title === 'GitHub').id), 'old-password');
  assert.equal(vault.list().filter((entry) => entry.title === 'Mail').length, 1);

  vault.beginImport([
    { title: 'GitHub', username: 'ada', password: 'replaced-password', host: 'github.com', category: 'Web', note: '' },
  ]);
  const overwritten = vault.applyImport('overwrite');
  assert.equal(overwritten.overwritten, 1);
  assert.equal(vault.getPassword(vault.list().find((entry) => entry.title === 'GitHub').id), 'replaced-password');
});

test('export returns plaintext records and nothing else', async () => {
  const { vault } = await unlockedVault();
  vault.create({
    title: 'DB',
    username: 'postgres',
    password: 'db-secret',
    host: 'localhost',
    category: 'Database',
    note: 'dev',
  });
  const exported = vault.exportEntries();
  assert.equal(exported.skippedCorrupt, 0);
  assert.deepEqual(Object.keys(exported.entries[0]).sort(), [
    'category',
    'host',
    'note',
    'password',
    'title',
    'username',
  ]);
  assert.equal(exported.entries[0].password, 'db-secret');
});

test('a failed import transaction does not leave a partial write', async () => {
  const { database, vault } = await unlockedVault();
  const original = database.transaction.bind(database);
  database.transaction = (fn) => {
    original(() => {
      fn();
      throw new Error('disk full');
    });
  };
  vault.beginImport([
    { title: 'One', username: '', password: 'x', host: '', category: 'Web', note: '' },
  ]);
  assert.throws(() => vault.applyImport('skip'));
  assert.equal(vault.list().length, 0);
});
