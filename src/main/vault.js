const crypto = require('crypto');
const { KINDS } = require('../shared/constants');
const { VaultError } = require('./errors');
const {
  KDF_ITERATIONS,
  VERIFIER_PLAINTEXT,
  generateSalt,
  deriveKey,
  encrypt,
  decrypt,
  safeEqual,
  generatePassword,
} = require('./crypto');

const AUTH_MESSAGE = 'Mật khẩu chính không đúng.';

function createVault(database, options = {}) {
  const setupIterations = options.kdfIterations || KDF_ITERATIONS;
  let key = null;
  let pendingImport = null;

  function assertUnlocked() {
    if (!key) throw new VaultError('LOCKED', 'Vault đang khóa.');
  }

  function wipeKey() {
    if (key) key.fill(0);
    key = null;
    pendingImport = null;
  }

  function seal(value) {
    return encrypt(key, JSON.stringify(value));
  }

  function readAll() {
    assertUnlocked();
    return database.allEntries().map((row) => {
      try {
        const data = JSON.parse(decrypt(key, row.payload));
        return { row, data, corrupt: false };
      } catch {
        return { row, data: null, corrupt: true };
      }
    });
  }

  function present(row, data) {
    const record = storedRecord(data);
    const first = record.accounts[0] || { username: '', password: '' };
    return {
      id: row.id,
      ...record,
      username: first.username,
      password: first.password,
      hasPassword: record.accounts.some((account) => account.password),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      corrupt: false,
    };
  }

  function corruptSummary(row) {
    return {
      id: row.id,
      title: 'Không giải mã được',
      username: '',
      host: '',
      url: '',
      category: '',
      kind: 'web',
      note: '',
      accountCount: 0,
      hasPassword: false,
      accounts: [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      corrupt: true,
    };
  }

  function toSummary(entry) {
    if (entry.corrupt) return corruptSummary(entry.row);
    const full = present(entry.row, entry.data);
    return {
      id: full.id,
      title: full.title,
      username: full.username,
      host: full.kind === 'web' ? full.url : full.host,
      url: full.url,
      port: full.port,
      engine: full.engine,
      database: full.database,
      protocol: full.protocol,
      category: full.category,
      kind: full.kind,
      note: full.note,
      accountCount: full.accounts.length,
      hasPassword: full.hasPassword,
      accounts: full.accounts.map((account) => ({
        id: account.id,
        username: account.username,
        hasPassword: Boolean(account.password),
        hasKey: Boolean(account.privateKey),
      })),
      createdAt: full.createdAt,
      updatedAt: full.updatedAt,
      corrupt: false,
    };
  }

  function listRecords() {
    return readAll()
      .map(toSummary)
      .sort((a, b) => b.updatedAt - a.updatedAt || a.title.localeCompare(b.title));
  }

  function titleMap() {
    const map = new Map();
    for (const entry of readAll()) {
      if (entry.corrupt) continue;
      const titleKey = normalizeTitle(entry.data.title);
      if (!map.has(titleKey)) map.set(titleKey, entry.row.id);
    }
    return map;
  }

  async function setup(password) {
    assertMasterPassword(password);
    if (database.isInitialized()) {
      throw new VaultError('ALREADY_INITIALIZED', 'Vault đã được khởi tạo.');
    }
    const salt = generateSalt();
    const derived = await deriveKey(password, salt, setupIterations);
    try {
      database.transaction(() => {
        database.setMeta('schema_version', '1');
        database.setMeta('kdf', 'pbkdf2-sha256');
        database.setMeta('kdf_iterations', String(setupIterations));
        database.setMeta('salt', salt.toString('base64'));
        database.setMeta('verifier', encrypt(derived, VERIFIER_PLAINTEXT));
      });
    } catch (error) {
      derived.fill(0);
      throw error;
    }
    if (key) key.fill(0);
    key = derived;
    return { entries: [] };
  }

  async function unlock(password) {
    assertMasterPassword(password);
    if (!database.isInitialized()) {
      throw new VaultError('NOT_INITIALIZED', 'Vault chưa được khởi tạo.');
    }
    const kdf = database.getMeta('kdf');
    const saltRaw = database.getMeta('salt');
    const iterations = Number(database.getMeta('kdf_iterations'));
    const verifier = database.getMeta('verifier');
    if (kdf !== 'pbkdf2-sha256' || !saltRaw || !verifier || !Number.isInteger(iterations) || iterations < 1) {
      throw new VaultError('CORRUPT', 'Vault bị hỏng (thiếu tham số khóa).');
    }

    let derived;
    try {
      derived = await deriveKey(password, Buffer.from(saltRaw, 'base64'), iterations);
      const plain = decrypt(derived, verifier);
      if (!safeEqual(plain, VERIFIER_PLAINTEXT)) {
        throw new VaultError('AUTH', AUTH_MESSAGE);
      }
    } catch (error) {
      if (derived) derived.fill(0);
      if (error instanceof VaultError && error.code === 'CORRUPT') throw error;
      throw new VaultError('AUTH', AUTH_MESSAGE);
    }

    if (key) key.fill(0);
    key = derived;
    return { entries: listRecords() };
  }

  function create(input) {
    assertUnlocked();
    const value = mustNormalize(input);
    const now = Date.now();
    const id = crypto.randomUUID();
    database.transaction(() => {
      database.insertEntry({
        id,
        payload: seal(value),
        createdAt: now,
        updatedAt: now,
      });
      rememberGroup(value.kind, value.category);
    });
    return { id };
  }

  function update(id, input) {
    assertUnlocked();
    const current = database.getEntry(id);
    if (!current) throw new VaultError('NOT_FOUND', 'Không tìm thấy bản ghi.');
    const value = mustNormalize(input);
    database.transaction(() => {
      rememberRevision(id, current.payload, 'update');
      database.updateEntry(id, { payload: seal(value), updatedAt: Date.now() });
      rememberGroup(value.kind, value.category);
    });
    return { id };
  }

  function remove(id) {
    assertUnlocked();
    const current = database.getEntry(id);
    if (!current) throw new VaultError('NOT_FOUND', 'Không tìm thấy bản ghi.');
    database.transaction(() => {
      rememberRevision(id, current.payload, 'delete');
      database.deleteEntry(id);
    });
    return { id };
  }

  function get(id) {
    assertUnlocked();
    const row = database.getEntry(id);
    if (!row) throw new VaultError('NOT_FOUND', 'Không tìm thấy bản ghi.');
    try {
      return present(row, JSON.parse(decrypt(key, row.payload)));
    } catch {
      throw new VaultError('CORRUPT', 'Không giải mã được bản ghi này.');
    }
  }

  function getPassword(id, accountId) {
    const entry = get(id);
    const account = accountId
      ? entry.accounts.find((item) => item.id === accountId)
      : entry.accounts.find((item) => item.password);
    if (!account || !account.password) throw new VaultError('VALIDATION', 'Bản ghi này không có mật khẩu.');
    return account.password;
  }

  function exportEntries(ids) {
    const allow = Array.isArray(ids) ? new Set(ids.map(String)) : null;
    const entries = [];
    let skippedCorrupt = 0;
    for (const item of readAll()) {
      if (allow && !allow.has(item.row.id)) continue;
      if (item.corrupt) {
        skippedCorrupt += 1;
        continue;
      }
      const record = storedRecord(item.data);
      const first = record.accounts[0] || { username: '', password: '' };
      entries.push({
        title: record.title,
        username: first.username,
        password: first.password,
        host: record.kind === 'web' ? record.url : record.host,
        category: record.category,
        note: record.note,
        kind: record.kind,
        url: record.url,
        port: record.port,
        engine: record.engine,
        database: record.database,
        protocol: record.protocol,
        accounts: record.accounts.map((account) => ({
          username: account.username,
          password: account.password,
          privateKey: account.privateKey,
          passphrase: account.passphrase,
        })),
      });
    }
    entries.sort((a, b) => a.title.localeCompare(b.title));
    return { entries, skippedCorrupt };
  }

  function beginImport(rawItems) {
    assertUnlocked();
    if (!Array.isArray(rawItems)) {
      throw new VaultError('FORMAT', 'File JSON phải là một mảng bản ghi.');
    }
    if (rawItems.length > 10000) {
      throw new VaultError('VALIDATION', 'File có quá nhiều bản ghi.');
    }

    const seen = new Set();
    for (const entry of readAll()) {
      if (!entry.corrupt) seen.add(normalizeTitle(entry.data.title));
    }

    const items = [];
    const rows = [];
    const duplicateTitles = [];
    let newCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const raw of rawItems) {
      const parsed = normalizeEntry(raw);
      if (parsed.error) {
        invalidCount += 1;
        rows.push({
          title: raw && typeof raw.title === 'string' ? raw.title.trim().slice(0, 80) : '',
          username: '',
          host: '',
          kind: '',
          category: '',
          status: 'invalid',
        });
        continue;
      }
      const titleKey = normalizeTitle(parsed.value.title);
      const duplicate = seen.has(titleKey);
      if (duplicate) {
        duplicateCount += 1;
        duplicateTitles.push(parsed.value.title);
      } else {
        newCount += 1;
        seen.add(titleKey);
      }
      const record = parsed.value;
      const account = record.accounts[0] || { username: '' };
      rows.push({
        title: record.title,
        username: account.username,
        host: record.kind === 'web' ? record.url : record.host,
        kind: record.kind,
        category: record.category,
        status: duplicate ? 'duplicate' : 'new',
      });
      items.push(record);
    }

    pendingImport = items;
    return {
      total: rawItems.length,
      newCount,
      duplicateCount,
      invalidCount,
      duplicateTitles: duplicateTitles.slice(0, 8).map(shortTitle),
      duplicateTitleExtra: Math.max(0, duplicateTitles.length - 8),
      rows: rows.slice(0, 400),
      rowsExtra: Math.max(0, rows.length - 400),
    };
  }

  function applyImport(policy) {
    assertUnlocked();
    if (!pendingImport) throw new VaultError('VALIDATION', 'Không có bản nhập nào đang chờ.');
    if (policy !== 'overwrite' && policy !== 'skip') {
      throw new VaultError('VALIDATION', 'Cách xử lý bản trùng không hợp lệ.');
    }

    const items = pendingImport;
    const result = { created: 0, overwritten: 0, skipped: 0 };
    database.transaction(() => {
      const map = titleMap();
      for (const value of items) {
        const titleKey = normalizeTitle(value.title);
        const existingId = map.get(titleKey);
        if (existingId) {
          if (policy === 'skip') {
            result.skipped += 1;
            continue;
          }
          const current = database.getEntry(existingId);
          if (current) rememberRevision(existingId, current.payload, 'update');
          database.updateEntry(existingId, { payload: seal(value), updatedAt: Date.now() });
          rememberGroup(value.kind, value.category);
          result.overwritten += 1;
        } else {
          const id = crypto.randomUUID();
          const now = Date.now();
          database.insertEntry({ id, payload: seal(value), createdAt: now, updatedAt: now });
          rememberGroup(value.kind, value.category);
          map.set(titleKey, id);
          result.created += 1;
        }
      }
    });
    pendingImport = null;
    return result;
  }

  function cancelImport() {
    pendingImport = null;
    return { canceled: true };
  }

  function makePassword(options) {
    assertUnlocked();
    try {
      return { password: generatePassword(options || {}) };
    } catch {
      throw new VaultError('VALIDATION', 'Chọn độ dài từ 8 đến 128 và ít nhất một nhóm ký tự.');
    }
  }

  function readGroups() {
    const groups = emptyGroups();
    const raw = database.getMeta('custom_categories');
    if (!raw || !key) return groups;
    try {
      const parsed = JSON.parse(decrypt(key, raw));
      if (Array.isArray(parsed)) {
        groups.web = uniqueGroupNames(parsed);
        return groups;
      }
      if (parsed && typeof parsed === 'object') {
        for (const kind of Object.keys(groups)) groups[kind] = uniqueGroupNames(parsed[kind] || []);
      }
    } catch {
      return emptyGroups();
    }
    return groups;
  }

  function writeGroups(groups) {
    database.setMeta('custom_categories', encrypt(key, JSON.stringify(groups)));
  }

  function rememberGroup(kind, name) {
    const cleaned = String(name || '').trim();
    if (!cleaned || !emptyGroups()[kind]) return;
    const groups = readGroups();
    if (groups[kind].some((item) => item.toLowerCase() === cleaned.toLowerCase())) return;
    if (groups[kind].length >= 40) return;
    groups[kind].push(cleaned);
    writeGroups(groups);
  }

  function rememberRevision(entryId, payload, action) {
    database.insertRevision({
      id: crypto.randomUUID(),
      entryId,
      payload,
      action,
      createdAt: Date.now(),
    });
  }

  function publicCatalog() {
    return {
      kinds: KINDS.map((item) => ({ ...item, builtin: true })),
      groups: readGroups(),
    };
  }

  function addCategory(kind, name) {
    assertUnlocked();
    const cleanKind = emptyGroups()[kind] ? kind : '';
    if (!cleanKind) throw new VaultError('VALIDATION', 'Hãy chọn loại Web, SSH, Server hoặc Database.');
    const cleaned = cleanCategoryName(name);
    if (cleaned.error) throw new VaultError('VALIDATION', cleaned.error);
    const groups = readGroups();
    if (groups[cleanKind].some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
      throw new VaultError('VALIDATION', 'Danh mục đã tồn tại trong loại này.');
    }
    if (groups[cleanKind].length >= 40) throw new VaultError('VALIDATION', 'Loại này đã có quá nhiều danh mục.');
    groups[cleanKind].push(cleaned);
    writeGroups(groups);
    return publicCatalog();
  }

  function removeCategory(kind, name) {
    assertUnlocked();
    const cleanKind = emptyGroups()[kind] ? kind : '';
    if (!cleanKind) throw new VaultError('VALIDATION', 'Không xóa được loại có sẵn.');
    const target = String(name || '').trim();
    const groups = readGroups();
    const next = groups[cleanKind].filter((item) => item.toLowerCase() !== target.toLowerCase());
    if (next.length === groups[cleanKind].length) throw new VaultError('NOT_FOUND', 'Không tìm thấy danh mục.');
    database.transaction(() => {
      for (const item of readAll()) {
        if (item.corrupt) continue;
        const record = storedRecord(item.data);
        if (record.kind !== cleanKind) continue;
        if (record.category.toLowerCase() !== target.toLowerCase()) continue;
        rememberRevision(item.row.id, item.row.payload, 'update');
        const moved = mustNormalize({ ...item.data, kind: cleanKind, category: '' });
        database.updateEntry(item.row.id, { payload: seal(moved), updatedAt: Date.now() });
      }
      groups[cleanKind] = next;
      writeGroups(groups);
    });
    return publicCatalog();
  }

  function history(id) {
    assertUnlocked();
    const entry = database.getEntry(id);
    if (!entry) throw new VaultError('NOT_FOUND', 'Không tìm thấy bản ghi.');
    let current = null;
    try {
      current = storedRecord(JSON.parse(decrypt(key, entry.payload)));
    } catch {
      current = null;
    }
    return database.listRevisions(id)
      .filter((row) => row.action !== 'delete')
      .map((row) => describeRevision(row, current));
  }

  function revisionSecret(revisionId) {
    assertUnlocked();
    const row = database.getRevision(revisionId);
    if (!row) throw new VaultError('NOT_FOUND', 'Không tìm thấy phiên bản này.');
    let data;
    try {
      data = JSON.parse(decrypt(key, row.payload));
    } catch {
      throw new VaultError('CORRUPT', 'Không giải mã được phiên bản này.');
    }
    const account = storedRecord(data).accounts[0] || {};
    return {
      password: account.password || '',
      privateKey: account.privateKey || '',
      passphrase: account.passphrase || '',
    };
  }

  function restore(revisionId) {
    assertUnlocked();
    const row = database.getRevision(revisionId);
    if (!row) throw new VaultError('NOT_FOUND', 'Không tìm thấy phiên bản này.');
    let data;
    try {
      data = JSON.parse(decrypt(key, row.payload));
    } catch {
      throw new VaultError('CORRUPT', 'Không giải mã được phiên bản này.');
    }
    const value = mustNormalize(data);
    const existing = database.getEntry(row.entryId);
    database.transaction(() => {
      if (existing) {
        rememberRevision(existing.id, existing.payload, 'update');
        database.updateEntry(existing.id, { payload: seal(value), updatedAt: Date.now() });
      } else {
        const now = Date.now();
        database.insertEntry({
          id: row.entryId,
          payload: seal(value),
          createdAt: row.createdAt,
          updatedAt: now,
        });
      }
      rememberGroup(value.kind, value.category);
    });
    return { id: row.entryId };
  }

  function describeRevision(row, current) {
    let title = 'Không giải mã được';
    let preview = null;
    try {
      const record = storedRecord(JSON.parse(decrypt(key, row.payload)));
      const account = record.accounts[0] || {};
      const currentAccount = current && current.accounts ? (current.accounts[0] || {}) : {};
      title = record.title || title;
      const note = record.note.length > 280 ? `${record.note.slice(0, 280)}…` : record.note;
      preview = {
        title: record.title,
        kind: record.kind,
        category: record.category,
        username: account.username || '',
        host: record.kind === 'web' ? record.url : record.host,
        url: record.url,
        port: record.port,
        engine: record.engine,
        database: record.database,
        protocol: record.protocol,
        note,
        hasPassword: Boolean(account.password),
        hasKey: Boolean(account.privateKey),
        passwordChanged: Boolean(current) && (account.password || '') !== (currentAccount.password || ''),
        keyChanged: Boolean(current) && (account.privateKey || '') !== (currentAccount.privateKey || ''),
      };
    } catch {
      title = 'Không giải mã được';
    }
    return {
      id: row.id,
      entryId: row.entryId,
      action: row.action,
      createdAt: row.createdAt,
      title,
      preview,
    };
  }

  function deletedRecords() {
    assertUnlocked();
    const live = new Set(database.allEntries().map((row) => row.id));
    const seen = new Set();
    const items = [];
    for (const row of database.listDeletedRevisions()) {
      if (live.has(row.entryId) || seen.has(row.entryId)) continue;
      seen.add(row.entryId);
      let title = 'Không giải mã được';
      let kind = 'web';
      let category = '';
      try {
        const record = storedRecord(JSON.parse(decrypt(key, row.payload)));
        title = record.title || title;
        kind = record.kind;
        category = record.category;
      } catch {
        title = 'Không giải mã được';
      }
      items.push({
        revisionId: row.id,
        entryId: row.entryId,
        title,
        kind,
        category,
        deletedAt: row.createdAt,
      });
    }
    return items;
  }

  function purgeDeleted(revisionIds) {
    assertUnlocked();
    const wanted = new Set((Array.isArray(revisionIds) ? revisionIds : []).filter((id) => typeof id === 'string' && id));
    if (!wanted.size) throw new VaultError('VALIDATION', 'Chưa chọn bản ghi nào.');
    const live = new Set(database.allEntries().map((row) => row.id));
    const entryIds = new Set();
    for (const row of database.listDeletedRevisions()) {
      if (!wanted.has(row.id) || live.has(row.entryId)) continue;
      entryIds.add(row.entryId);
    }
    if (!entryIds.size) throw new VaultError('NOT_FOUND', 'Không tìm thấy bản ghi trong thùng rác.');
    database.transaction(() => {
      for (const entryId of entryIds) database.deleteEntryRevisions(entryId);
    });
    return { removed: entryIds.size };
  }

  return {
    isInitialized: () => database.isInitialized(),
    isUnlocked: () => Boolean(key),
    setup,
    unlock,
    lock: wipeKey,
    list: listRecords,
    get,
    getPassword,
    create,
    update,
    remove,
    exportEntries,
    beginImport,
    applyImport,
    cancelImport,
    generatePassword: makePassword,
    listCategories() {
      if (!key) {
        return {
          kinds: KINDS.map((item) => ({ ...item, builtin: true })),
          groups: emptyGroups(),
        };
      }
      return publicCatalog();
    },
    addCategory,
    removeCategory,
    history,
    revisionSecret,
    restore,
    deletedRecords,
    purgeDeleted,
  };
}

function assertMasterPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new VaultError('VALIDATION', 'Hãy nhập mật khẩu chính.');
  }
  if (password.length < 8) {
    throw new VaultError('VALIDATION', 'Mật khẩu chính cần ít nhất 8 ký tự.');
  }
  if (password.length > 1024) {
    throw new VaultError('VALIDATION', 'Mật khẩu chính quá dài.');
  }
}

function asText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return { error: true };
}

function emptyGroups() {
  return { web: [], ssh: [], server: [], database: [] };
}

function isTypeName(value) {
  return ['web', 'email', 'ssh', 'ssh key', 'server', 'database'].includes(String(value || '').toLowerCase());
}

function uniqueGroupNames(list) {
  const seen = new Set();
  const names = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const name = item.trim().replace(/\s+/g, ' ');
    const key = name.toLowerCase();
    if (!name || name.length > 40 || seen.has(key) || isTypeName(name)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

function placementFrom(input) {
  const source = input || {};
  const rawKind = String(source.kind || '').trim().toLowerCase();
  const rawCategory = asText(source.category);
  if (rawCategory.error) return { error: 'Tên danh mục không hợp lệ.' };
  const categoryText = rawCategory.trim().replace(/\s+/g, ' ');
  if (categoryText.length > 40 || /[\r\n]/.test(categoryText)) {
    return { error: 'Tên danh mục không hợp lệ.' };
  }
  let kind = '';
  if (rawKind === 'email') kind = 'web';
  else if (emptyGroups()[rawKind]) kind = rawKind;
  else if (categoryText.toLowerCase() === 'ssh' || categoryText.toLowerCase() === 'ssh key') kind = 'ssh';
  else if (categoryText.toLowerCase() === 'server') kind = 'server';
  else if (categoryText.toLowerCase() === 'database') kind = 'database';
  else kind = 'web';
  return { kind, category: isTypeName(categoryText) ? '' : categoryText };
}

function cleanCategoryName(value) {
  const name = String(value || '').trim().replace(/\s+/g, ' ');
  if (!name) return { error: 'Hãy nhập tên danh mục.' };
  if (name.length > 40 || /[\r\n]/.test(name)) return { error: 'Tên danh mục quá dài.' };
  return name;
}

function cleanPort(value) {
  const text = asText(value);
  if (text.error) return { error: 'Cổng không hợp lệ.' };
  const port = text.trim();
  if (!port) return '';
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    return { error: 'Cổng phải từ 1 đến 65535.' };
  }
  return String(Number(port));
}

function normalizeAccounts(input, kind) {
  const source = Array.isArray(input.accounts) && input.accounts.length
    ? [input.accounts[0]]
    : [{
      username: input.username,
      password: input.password,
      privateKey: input.privateKey,
      passphrase: input.passphrase,
    }];
  const accounts = [];
  for (let index = 0; index < source.length; index += 1) {
    const raw = source[index];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'Tài khoản không hợp lệ.' };
    const username = asText(raw.username);
    const password = asText(raw.password);
    const privateKey = asText(raw.privateKey);
    const passphrase = asText(raw.passphrase);
    if (username.error || password.error || privateKey.error || passphrase.error) {
      return { error: 'Tài khoản không hợp lệ.' };
    }
    if (username.trim().length > 320) return { error: 'Tài khoản quá dài.' };
    if (password.length > 2048) return { error: 'Mật khẩu quá dài.' };
    if (privateKey.length > 20000) return { error: 'Khóa riêng quá dài.' };
    if (passphrase.length > 2048) return { error: 'Passphrase quá dài.' };
    const id = typeof raw.id === 'string' && raw.id.trim() && raw.id.length <= 80
      ? raw.id.trim()
      : `legacy-${index}`;
    accounts.push({
      id,
      username: username.trim(),
      password,
      privateKey: kind === 'ssh' ? privateKey : '',
      passphrase: kind === 'ssh' ? passphrase : '',
    });
  }
  return { accounts };
}

function normalizeEntry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Bản ghi không hợp lệ.' };
  }
  const titleRaw = asText(input.title);
  if (titleRaw.error) return { error: 'Tiêu đề không hợp lệ.' };
  const title = titleRaw.trim().replace(/\s+/g, ' ');
  if (!title) return { error: 'Thiếu tiêu đề.' };
  if (title.length > 200) return { error: 'Tiêu đề quá dài.' };

  const place = placementFrom(input);
  if (place.error) return place;
  const { kind, category } = place;
  const accounts = normalizeAccounts(input, kind);
  if (accounts.error) return accounts;

  const noteRaw = asText(input.note);
  const urlRaw = asText(input.url);
  const hostRaw = asText(input.host);
  const engineRaw = asText(input.engine);
  const databaseRaw = asText(input.database);
  const protocolRaw = asText(input.protocol);
  if (noteRaw.error || urlRaw.error || hostRaw.error || engineRaw.error || databaseRaw.error || protocolRaw.error) {
    return { error: 'Trường văn bản không hợp lệ.' };
  }
  const note = noteRaw;
  if (note.length > 20000) return { error: 'Ghi chú quá dài.' };
  const port = cleanPort(input.port);
  if (port.error) return port;
  const address = (hostRaw || urlRaw).trim();
  if (address.length > 500) return { error: 'Máy chủ quá dài.' };
  const engine = kind === 'database' ? engineRaw.trim() : '';
  if (engine.length > 80) return { error: 'Tên hệ quản trị quá dài.' };
  if (databaseRaw.trim().length > 200) return { error: 'Tên database quá dài.' };

  const webLike = kind === 'web';
  return {
    value: {
      title,
      category,
      kind,
      note,
      url: webLike ? (urlRaw.trim() || hostRaw.trim()) : '',
      host: webLike ? '' : hostRaw.trim(),
      port: webLike ? '' : port,
      engine,
      database: kind === 'database' ? databaseRaw.trim() : '',
      protocol: kind === 'server' ? protocolRaw.trim() : '',
      accounts: accounts.accounts,
    },
  };
}

function storedRecord(data) {
  const place = placementFrom(data);
  const kind = place.error ? 'web' : place.kind;
  const category = place.error ? '' : place.category;
  const accounts = normalizeAccounts(data || {}, kind);
  const safeAccounts = accounts.accounts || [{
    id: 'legacy-0',
    username: '',
    password: '',
    privateKey: '',
    passphrase: '',
  }];
  const webLike = kind === 'web';
  return {
    title: String((data && data.title) || ''),
    category,
    kind,
    note: String((data && data.note) || ''),
    url: webLike ? String((data && (data.url || data.host)) || '') : '',
    host: webLike ? '' : String((data && data.host) || ''),
    port: webLike ? '' : String((data && data.port) || ''),
    engine: kind === 'database' ? String((data && data.engine) || '') : '',
    database: kind === 'database' ? String((data && data.database) || '') : '',
    protocol: kind === 'server' ? String((data && data.protocol) || '') : '',
    accounts: safeAccounts,
  };
}

function mustNormalize(input) {
  const parsed = normalizeEntry(input);
  if (parsed.error) throw new VaultError('VALIDATION', parsed.error);
  return parsed.value;
}

function normalizeTitle(title) {
  return String(title).trim().replace(/\s+/g, ' ').toLowerCase();
}

function shortTitle(title) {
  return title.length > 80 ? `${title.slice(0, 80)}…` : title;
}

module.exports = {
  createVault,
  normalizeEntry,
};
