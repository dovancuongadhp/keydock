const test = require('node:test');
const assert = require('node:assert/strict');
const { createVault } = require('../src/main/vault');

function memoryDatabase() {
  const meta = new Map();
  const entries = new Map();
  const revisions = [];
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
    insertRevision(row) {
      revisions.push({ ...row });
      const mine = revisions.filter((item) => item.entryId === row.entryId);
      if (mine.length <= 40) return;
      const drop = new Set(mine.slice(0, mine.length - 40).map((item) => item.id));
      for (let index = revisions.length - 1; index >= 0; index -= 1) {
        if (drop.has(revisions[index].id)) revisions.splice(index, 1);
      }
    },
    listRevisions(entryId) {
      return revisions
        .filter((item) => item.entryId === entryId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((item) => ({ ...item }));
    },
    getRevision(id) {
      const row = revisions.find((item) => item.id === id);
      return row ? { ...row } : null;
    },
    listDeletedRevisions() {
      return revisions
        .filter((item) => item.action === 'delete')
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((item) => ({ ...item }));
    },
    deleteEntryRevisions(entryId) {
      for (let index = revisions.length - 1; index >= 0; index -= 1) {
        if (revisions[index].entryId === entryId) revisions.splice(index, 1);
      }
    },
    transaction(fn) {
      const metaBackup = new Map(meta);
      const entryBackup = new Map([...entries].map(([id, row]) => [id, { ...row }]));
      const revisionBackup = revisions.map((row) => ({ ...row }));
      try {
        fn();
      } catch (error) {
        meta.clear();
        for (const [key, value] of metaBackup) meta.set(key, value);
        entries.clear();
        for (const [id, row] of entryBackup) entries.set(id, row);
        revisions.splice(0, revisions.length, ...revisionBackup);
        throw error;
      }
    },
    close() {},
    dump() {
      return {
        meta: [...meta.entries()],
        payloads: [
          ...[...entries.values()].map((row) => row.payload),
          ...revisions.map((row) => row.payload),
        ],
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
  assert.equal(summary[0].kind, 'server');
  assert.equal(summary[0].category, '');
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
  assert.deepEqual(preview.rows.map((row) => row.status), ['duplicate', 'new', 'duplicate', 'invalid']);
  assert.equal(JSON.stringify(preview.rows).includes('mail-secret'), false);

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
  assert.equal(exported.entries[0].password, 'db-secret');
  assert.equal(exported.entries[0].kind, 'database');
  assert.equal(exported.entries[0].accounts[0].username, 'postgres');
  assert.equal(exported.entries[0].host, 'localhost');
  const selected = vault.exportEntries([vault.list()[0].id]);
  assert.equal(selected.entries.length, 1);
  assert.equal(vault.exportEntries(['missing']).entries.length, 0);
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

test('a record keeps one account, and SSH keeps its own fields', async () => {
  const { database, vault } = await unlockedVault();
  const web = vault.create({
    title: 'GitHub',
    category: 'Web',
    url: 'https://github.com',
    accounts: [
      { username: 'ada', password: 'first-secret' },
      { username: 'grace', password: 'second-secret' },
    ],
  });
  const entry = vault.get(web.id);
  assert.equal(entry.kind, 'web');
  assert.equal(entry.accounts.length, 1);
  assert.equal(entry.accounts[0].username, 'ada');
  assert.equal(vault.getPassword(web.id), 'first-secret');

  const ssh = vault.create({
    title: 'Bastion',
    category: 'SSH Key',
    host: '10.0.0.5',
    port: '22',
    accounts: [{
      username: 'root',
      password: '',
      privateKey: 'BEGIN OPENSSH PRIVATE KEY',
      passphrase: 'key-passphrase',
    }],
  });
  const sshEntry = vault.get(ssh.id);
  assert.equal(sshEntry.category, '');
  assert.equal(sshEntry.kind, 'ssh');
  assert.equal(sshEntry.port, '22');
  assert.equal(sshEntry.accounts[0].privateKey, 'BEGIN OPENSSH PRIVATE KEY');
  const dumped = JSON.stringify(database.dump());
  assert.equal(dumped.includes('first-secret'), false);
  assert.equal(dumped.includes('BEGIN OPENSSH PRIVATE KEY'), false);
});

test('groups live inside a type, and a record can be restored', async () => {
  const { vault } = await unlockedVault();
  const added = vault.addCategory('web', 'Việc nhà');
  assert.equal(added.groups.web.includes('Việc nhà'), true);
  const created = vault.create({
    title: 'Wifi',
    kind: 'web',
    category: 'Việc nhà',
    host: 'home.lan',
    username: 'admin',
    password: 'wifi-secret',
  });
  assert.equal(vault.get(created.id).kind, 'web');
  assert.equal(vault.get(created.id).category, 'Việc nhà');
  assert.equal(vault.get(created.id).url, 'home.lan');
  vault.update(created.id, {
    title: 'Wifi',
    kind: 'web',
    category: 'Việc nhà',
    host: 'home.lan',
    username: 'admin',
    password: 'wifi-new',
  });
  const revisions = vault.history(created.id);
  assert.equal(revisions.length, 1);
  assert.equal(revisions[0].preview.username, 'admin');
  assert.equal(revisions[0].preview.category, 'Việc nhà');
  assert.equal(revisions[0].preview.passwordChanged, true);
  assert.equal(JSON.stringify(revisions).includes('wifi-secret'), false);
  assert.equal(vault.revisionSecret(revisions[0].id).password, 'wifi-secret');
  vault.restore(revisions[0].id);
  assert.equal(vault.getPassword(created.id), 'wifi-secret');

  const database = vault.create({
    title: 'Logs',
    kind: 'database',
    engine: 'ClickHouse',
    host: '10.0.0.8',
    port: '9000',
    database: 'logs',
    username: 'reader',
    password: 'db-secret',
  });
  assert.equal(vault.get(database.id).engine, 'ClickHouse');
  assert.equal(vault.get(database.id).kind, 'database');

  vault.remove(created.id);
  assert.equal(vault.list().some((entry) => entry.id === created.id), false);
  const deleted = vault.deletedRecords();
  assert.equal(deleted.length, 1);
  vault.restore(deleted[0].revisionId);
  assert.equal(vault.getPassword(created.id), 'wifi-secret');

  vault.remove(database.id);
  const trashed = vault.deletedRecords().find((item) => item.entryId === database.id);
  assert.ok(trashed);
  assert.equal(vault.purgeDeleted([trashed.revisionId]).removed, 1);
  assert.equal(vault.deletedRecords().some((item) => item.entryId === database.id), false);

  vault.removeCategory('web', 'Việc nhà');
  assert.equal(vault.get(created.id).category, '');
  assert.equal(vault.get(created.id).kind, 'web');
  assert.equal(vault.listCategories().groups.web.includes('Việc nhà'), false);
  assert.throws(() => vault.removeCategory('ssh', 'Không có'), (error) => error.code === 'NOT_FOUND');
});
