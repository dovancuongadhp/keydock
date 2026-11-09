const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/main/db');

function tempFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'keydock-'));
  return { dir, file: path.join(dir, 'keydock.db') };
}

function main() {
  const { dir, file } = tempFile();
  try {
    const db = openDatabase(file);
    assert.equal(db.isInitialized(), false);
    db.setMeta('salt', 'abc');
    assert.equal(db.getMeta('salt'), 'abc');
    db.setMeta('salt', 'rotated');
    assert.equal(db.getMeta('salt'), 'rotated');

    db.insertEntry({ id: '1', payload: 'cipher', createdAt: 10, updatedAt: 20 });
    assert.deepEqual(db.getEntry('1'), {
      id: '1',
      payload: 'cipher',
      createdAt: 10,
      updatedAt: 20,
    });
    assert.equal(db.updateEntry('1', { payload: 'next', updatedAt: 30 }), true);
    assert.equal(db.getEntry('1').createdAt, 10);
    assert.equal(db.getEntry('1').payload, 'next');

    assert.throws(() => {
      db.transaction(() => {
        db.insertEntry({ id: '2', payload: 'rolled', createdAt: 1, updatedAt: 1 });
        throw new Error('nope');
      });
    });
    assert.equal(db.getEntry('2'), null);

    db.close();
    const reopened = openDatabase(file);
    assert.equal(reopened.getEntry('1').payload, 'next');
    assert.equal(reopened.deleteEntry('1'), true);
    assert.equal(reopened.allEntries().length, 0);
    reopened.insertRevision({ id: 'r1', entryId: '1', payload: 'old', action: 'delete', createdAt: 40 });
    assert.equal(reopened.getRevision('r1').entryId, '1');
    assert.equal(reopened.listDeletedRevisions().length, 1);
    reopened.deleteEntryRevisions('1');
    assert.equal(reopened.listDeletedRevisions().length, 0);
    reopened.close();
    console.log('sqlite adapter ok');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main();
