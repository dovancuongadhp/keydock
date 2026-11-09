const crypto = require('crypto');
const { CATEGORIES } = require('../shared/constants');
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
    return {
      id: row.id,
      title: data.title,
      username: data.username,
      host: data.host,
      category: data.category,
      note: data.note,
      password: data.password,
      hasPassword: data.password.length > 0,
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
      category: 'Other',
      note: '',
      hasPassword: false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      corrupt: true,
    };
  }

  function toSummary(entry) {
    if (entry.corrupt) return corruptSummary(entry.row);
    const { password, ...summary } = present(entry.row, entry.data);
    return summary;
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
    database.insertEntry({
      id,
      payload: seal(value),
      createdAt: now,
      updatedAt: now,
    });
    return { id };
  }

  function update(id, input) {
    assertUnlocked();
    if (!database.getEntry(id)) throw new VaultError('NOT_FOUND', 'Không tìm thấy bản ghi.');
    const value = mustNormalize(input);
    database.updateEntry(id, { payload: seal(value), updatedAt: Date.now() });
    return { id };
  }

  function remove(id) {
    assertUnlocked();
    if (!database.deleteEntry(id)) throw new VaultError('NOT_FOUND', 'Không tìm thấy bản ghi.');
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

  function getPassword(id) {
    const entry = get(id);
    if (!entry.password) throw new VaultError('VALIDATION', 'Bản ghi này không có mật khẩu.');
    return entry.password;
  }

  function exportEntries() {
    const entries = [];
    let skippedCorrupt = 0;
    for (const item of readAll()) {
      if (item.corrupt) {
        skippedCorrupt += 1;
        continue;
      }
      entries.push({
        title: item.data.title,
        username: item.data.username,
        password: item.data.password,
        host: item.data.host,
        category: item.data.category,
        note: item.data.note,
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
    const duplicateTitles = [];
    let newCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const raw of rawItems) {
      const parsed = normalizeEntry(raw);
      if (parsed.error) {
        invalidCount += 1;
        continue;
      }
      const titleKey = normalizeTitle(parsed.value.title);
      if (seen.has(titleKey)) {
        duplicateCount += 1;
        duplicateTitles.push(parsed.value.title);
      } else {
        newCount += 1;
        seen.add(titleKey);
      }
      items.push(parsed.value);
    }

    pendingImport = items;
    return {
      total: rawItems.length,
      newCount,
      duplicateCount,
      invalidCount,
      duplicateTitles: duplicateTitles.slice(0, 8).map(shortTitle),
      duplicateTitleExtra: Math.max(0, duplicateTitles.length - 8),
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
          database.updateEntry(existingId, { payload: seal(value), updatedAt: Date.now() });
          result.overwritten += 1;
        } else {
          const id = crypto.randomUUID();
          const now = Date.now();
          database.insertEntry({ id, payload: seal(value), createdAt: now, updatedAt: now });
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

  function makePassword(length) {
    assertUnlocked();
    try {
      return { password: generatePassword(length) };
    } catch {
      throw new VaultError('VALIDATION', 'Độ dài mật khẩu phải từ 12 đến 128.');
    }
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

function normalizeEntry(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Bản ghi không hợp lệ.' };
  }
  const titleRaw = asText(input.title);
  if (titleRaw.error) return { error: 'Tiêu đề không hợp lệ.' };
  const title = titleRaw.trim().replace(/\s+/g, ' ');
  if (!title) return { error: 'Thiếu tiêu đề.' };
  if (title.length > 200) return { error: 'Tiêu đề quá dài.' };

  const usernameRaw = asText(input.username);
  const passwordRaw = asText(input.password);
  const hostRaw = asText(input.host);
  const noteRaw = asText(input.note);
  if (usernameRaw.error || passwordRaw.error || hostRaw.error || noteRaw.error) {
    return { error: 'Trường văn bản không hợp lệ.' };
  }

  const username = usernameRaw.trim();
  const host = hostRaw.trim();
  const password = passwordRaw;
  const note = noteRaw;
  if (username.length > 320) return { error: 'Tài khoản quá dài.' };
  if (host.length > 500) return { error: 'Máy chủ quá dài.' };
  if (password.length > 2048) return { error: 'Mật khẩu quá dài.' };
  if (note.length > 20000) return { error: 'Ghi chú quá dài.' };

  const categoryRaw = asText(input.category);
  let category = 'Other';
  if (!categoryRaw.error && categoryRaw.trim()) {
    const requested = categoryRaw.trim();
    const match = CATEGORIES.find((item) => item.toLowerCase() === requested.toLowerCase());
    if (match) category = match;
    else if (requested.length <= 40 && !/[\r\n]/.test(requested)) category = requested;
  }

  return { value: { title, username, password, host, category, note } };
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
