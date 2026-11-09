const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  clipboard,
  ipcMain,
} = require('electron');
const { IDLE_LOCK_MS, CLIPBOARD_CLEAR_MS } = require('../shared/constants');
const { openDatabase } = require('./db');
const { createVault } = require('./vault');
const { VaultError } = require('./errors');
const { verifyWipeCode } = require('./wipe-codes');

app.setName('KeyDock');
const userDataDir = process.env.KEYDOCK_USER_DATA
  ? path.resolve(process.env.KEYDOCK_USER_DATA)
  : path.join(app.getPath('appData'), 'KeyDock');
app.setPath('userData', userDataDir);

const ctx = {
  dbPath: path.join(app.getPath('userData'), 'keydock.db'),
  database: null,
  vault: null,
};

let win = null;
let idleTimer = null;
let copyTimer = null;
let copiedHash = null;

function fingerprint(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest();
}

async function clearCopiedSecret() {
  clearTimeout(copyTimer);
  copyTimer = null;
  const expected = copiedHash;
  copiedHash = null;
  if (!expected) return;
  try {
    const current = fingerprint(await clipboard.readText());
    if (current.length === expected.length && crypto.timingSafeEqual(current, expected)) {
      clipboard.clear();
    }
  } catch {
    // The clipboard can be unavailable for a moment on some desktops.
  }
}

function bumpActivity() {
  if (!ctx.vault || !ctx.vault.isUnlocked()) return;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => performLock('idle'), IDLE_LOCK_MS);
}

async function performLock(reason) {
  clearTimeout(idleTimer);
  idleTimer = null;
  await clearCopiedSecret();
  if (ctx.vault) ctx.vault.lock();
  if (win && !win.isDestroyed()) {
    win.webContents.send('vault:locked', { reason });
  }
}

function sendMenu(command) {
  if (win && !win.isDestroyed()) win.webContents.send('menu:command', command);
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      const data = await fn(payload);
      return { ok: true, ...data };
    } catch (error) {
      const code = error instanceof VaultError ? error.code : 'ERROR';
      const message = error instanceof VaultError ? error.message : 'Không thực hiện được thao tác.';
      return { ok: false, code, error: message };
    }
  });
}

function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new VaultError('FORMAT', 'File không phải JSON hợp lệ.');
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.entries)) return parsed.entries;
  throw new VaultError('FORMAT', 'JSON phải là một mảng bản ghi, hoặc object có khóa entries.');
}

function registerIpc() {
  handle('vault:status', async () => ({
    initialized: ctx.vault.isInitialized(),
    unlocked: ctx.vault.isUnlocked(),
    catalog: ctx.vault.listCategories(),
    idleMinutes: IDLE_LOCK_MS / 60000,
    clipboardSeconds: CLIPBOARD_CLEAR_MS / 1000,
  }));

  handle('vault:setup', async (password) => {
    const data = await ctx.vault.setup(password);
    bumpActivity();
    return data;
  });

  handle('vault:unlock', async (password) => {
    const data = await ctx.vault.unlock(password);
    bumpActivity();
    return data;
  });

  handle('vault:lock', async () => {
    await performLock('manual');
    return {};
  });

  handle('vault:reset', async (code) => {
    if (!verifyWipeCode(code)) {
      throw new VaultError('VALIDATION', 'Mã xóa không đúng.');
    }
    clearTimeout(idleTimer);
    idleTimer = null;
    clearCopiedSecret();
    ctx.vault.lock();
    ctx.database.close();
    try {
      for (const suffix of ['', '-wal', '-shm']) {
        fs.rmSync(`${ctx.dbPath}${suffix}`, { force: true });
      }
    } catch {
      ctx.database = openDatabase(ctx.dbPath);
      ctx.vault = createVault(ctx.database);
      throw new VaultError('ERROR', 'Không xóa được file vault.');
    }
    ctx.database = openDatabase(ctx.dbPath);
    ctx.vault = createVault(ctx.database);
    return { initialized: false };
  });

  handle('entries:list', async () => ({ entries: ctx.vault.list() }));
  handle('entries:get', async (id) => ({ entry: ctx.vault.get(id) }));
  handle('entries:create', async (entry) => {
    const data = ctx.vault.create(entry);
    bumpActivity();
    return data;
  });
  handle('entries:update', async (entry) => {
    const data = ctx.vault.update(entry.id, entry);
    bumpActivity();
    return data;
  });
  handle('entries:remove', async (id) => {
    const data = ctx.vault.remove(id);
    bumpActivity();
    return data;
  });

  handle('entries:copy-password', async (payload) => {
    const id = payload && typeof payload === 'object' ? payload.id : payload;
    const accountId = payload && typeof payload === 'object' ? payload.accountId : undefined;
    const password = ctx.vault.getPassword(id, accountId);
    await clipboard.writeText(password);
    copiedHash = fingerprint(password);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(clearCopiedSecret, CLIPBOARD_CLEAR_MS);
    bumpActivity();
    return { seconds: CLIPBOARD_CLEAR_MS / 1000 };
  });

  handle('clipboard:write', async (text) => {
    if (typeof text !== 'string' || text.length === 0 || text.length > 20000) {
      throw new VaultError('VALIDATION', 'Không có gì để chép.');
    }
    await clipboard.writeText(text);
    bumpActivity();
    return { copied: true };
  });

  handle('clipboard:secret', async (text) => {
    if (typeof text !== 'string' || text.length === 0 || text.length > 20000) {
      throw new VaultError('VALIDATION', 'Không có gì để chép.');
    }
    await clipboard.writeText(text);
    copiedHash = fingerprint(text);
    clearTimeout(copyTimer);
    copyTimer = setTimeout(clearCopiedSecret, CLIPBOARD_CLEAR_MS);
    bumpActivity();
    return { seconds: CLIPBOARD_CLEAR_MS / 1000 };
  });

  handle('password:generate', async (options) => ctx.vault.generatePassword(options || {}));
  handle('categories:list', async () => ctx.vault.listCategories());
  handle('categories:add', async (payload) => {
    const kind = payload && typeof payload === 'object' ? payload.kind : 'web';
    const name = payload && typeof payload === 'object' ? payload.name : payload;
    const data = ctx.vault.addCategory(kind, name);
    bumpActivity();
    return data;
  });
  handle('categories:remove', async (payload) => {
    const data = ctx.vault.removeCategory(payload && payload.kind, payload && payload.name);
    bumpActivity();
    return data;
  });
  handle('entries:history', async (id) => ({ revisions: ctx.vault.history(id) }));
  handle('entries:revision', async (id) => ({ secret: ctx.vault.revisionSecret(id) }));
  handle('entries:restore', async (id) => {
    const data = ctx.vault.restore(id);
    bumpActivity();
    return data;
  });
  handle('entries:deleted', async () => ({ entries: ctx.vault.deletedRecords() }));
  handle('entries:purge', async (ids) => {
    const data = ctx.vault.purgeDeleted(ids);
    bumpActivity();
    return data;
  });

  handle('vault:export', async (ids) => {
    const { entries, skippedCorrupt } = ctx.vault.exportEntries(Array.isArray(ids) ? ids : null);
    if (!entries.length) throw new VaultError('VALIDATION', 'Không có bản ghi nào được chọn.');
    const chosen = await dialog.showSaveDialog(win, {
      title: 'Xuất bản sao lưu KeyDock',
      defaultPath: path.join(app.getPath('documents'), 'keydock_backup.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (chosen.canceled || !chosen.filePath) return { canceled: true };
    const filePath = chosen.filePath.toLowerCase().endsWith('.json')
      ? chosen.filePath
      : `${chosen.filePath}.json`;
    fs.writeFileSync(filePath, `${JSON.stringify(entries, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    bumpActivity();
    return { count: entries.length, skippedCorrupt, filePath };
  });

  handle('vault:import-pick', async () => {
    const chosen = await dialog.showOpenDialog(win, {
      title: 'Nhập bản sao lưu KeyDock',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (chosen.canceled || !chosen.filePaths[0]) return { canceled: true };
    const filePath = chosen.filePaths[0];
    const stat = fs.statSync(filePath);
    if (stat.size > 5 * 1024 * 1024) {
      throw new VaultError('VALIDATION', 'File JSON lớn hơn 5 MB.');
    }
    const records = parseBackup(fs.readFileSync(filePath, 'utf8'));
    bumpActivity();
    return ctx.vault.beginImport(records);
  });

  handle('vault:import-apply', async (policy) => {
    const data = ctx.vault.applyImport(policy);
    bumpActivity();
    return data;
  });

  handle('vault:import-cancel', async () => ctx.vault.cancelImport());

  ipcMain.on('vault:activity', () => bumpActivity());
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [];

  if (isMac) {
    template.push({
      label: 'KeyDock',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Khóa vault', accelerator: 'CmdOrCtrl+L', click: () => performLock('manual') },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: 'Tệp',
    submenu: [
      { label: 'Bản ghi mới', accelerator: 'CmdOrCtrl+N', click: () => sendMenu('new') },
      { type: 'separator' },
      { label: 'Xuất JSON…', click: () => sendMenu('export') },
      { label: 'Nhập JSON…', click: () => sendMenu('import') },
      { type: 'separator' },
      ...(isMac
        ? []
        : [
          { label: 'Khóa vault', accelerator: 'CmdOrCtrl+L', click: () => performLock('manual') },
          { type: 'separator' },
          { role: 'quit' },
        ]),
    ],
  });

  template.push({ role: 'editMenu' });
  template.push({ role: 'windowMenu' });

  if (!app.isPackaged) {
    template.push({
      label: 'Xem',
      submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function appIconPath() {
  const iconPath = path.join(__dirname, '../../build/icon.png');
  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function createWindow() {
  const icon = appIconPath();
  if (icon && process.platform === 'darwin' && app.dock) app.dock.setIcon(icon);
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    show: false,
    backgroundColor: '#0e1114',
    title: 'KeyDock',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('render-process-gone', (_event, details) => {
    const reason = details && details.reason;
    if (reason === 'crashed' || reason === 'oom' || reason === 'abnormal-exit' || reason === 'integrity-failure') {
      performLock('manual');
    }
  });
  if (process.env.KEYDOCK_SMOKE !== '1') {
    win.once('ready-to-show', () => win.show());
  }
  win.on('closed', () => {
    win = null;
    clearTimeout(idleTimer);
    clearCopiedSecret();
    if (ctx.vault) ctx.vault.lock();
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error(label);
}

async function runSmoke() {
  if (win.webContents.isLoading()) {
    await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  }
  const js = (source) => win.webContents.executeJavaScript(source);

  await waitFor(async () => (await js("document.getElementById('lock-heading').textContent")) === 'Tạo vault mới', 'init screen did not appear');

  const mismatch = await js(`
    document.getElementById('master-password').value = 'abcdefgh';
    document.getElementById('confirm-password').value = 'abcdefgi';
    document.getElementById('lock-form').requestSubmit();
    document.getElementById('lock-error').textContent
  `);
  if (mismatch !== 'Mật khẩu nhập lại không khớp.') {
    throw new Error(`unexpected confirm message: ${mismatch}`);
  }

  await js(`
    document.getElementById('master-password').value = 'smoke-test-password';
    document.getElementById('confirm-password').value = 'smoke-test-password';
    document.getElementById('lock-form').requestSubmit();
  `);
  await waitFor(
    async () => js("document.getElementById('shell').hidden === false"),
    'vault did not open after setup',
  );

  const categories = await js("document.getElementById('category-nav').innerText");
  for (const name of ['Tất cả', 'Web', 'Server', 'SSH', 'Database']) {
    if (!categories.includes(name)) throw new Error(`missing category ${name}`);
  }

  await js(`
    document.getElementById('new-btn').click();
    document.getElementById('editor-title').value = 'GitHub';
    document.getElementById('editor-username').value = 'octocat';
    document.getElementById('editor-password').value = 'secret-pass';
    document.getElementById('editor-host').value = 'github.com';
    document.getElementById('editor-category').value = 'Web';
    document.getElementById('editor-note').value = 'work account';
    document.getElementById('editor-form').requestSubmit();
  `);
  await waitFor(
    async () => js("document.getElementById('entry-rows').textContent.includes('GitHub')"),
    'new entry did not appear',
  );

  await js(`
    document.getElementById('search-input').value = 'zzz';
    document.getElementById('search-input').dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await waitFor(
    async () => js("document.getElementById('empty-state').hidden === false"),
    'search did not show an empty state',
  );

  await js(`
    document.getElementById('search-input').value = 'git';
    document.getElementById('search-input').dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await waitFor(
    async () => js("document.getElementById('entry-rows').textContent.includes('github.com')"),
    'search did not find the host',
  );

  await js("document.querySelector('[data-category=\"Server\"]').click()");
  await waitFor(
    async () => js("document.getElementById('empty-state').hidden === false"),
    'category filter did not narrow the list',
  );
  await js("document.querySelector('[data-category=\"Web\"]').click()");
  await waitFor(
    async () => js("document.getElementById('entry-rows').textContent.includes('GitHub')"),
    'web category did not show the entry',
  );

  await js("document.querySelector('#entry-rows tr').click()");
  await waitFor(
    async () => js("document.getElementById('view-password').textContent === '••••••••'"),
    'password was not masked',
  );
  await js("document.getElementById('reveal-btn').click()");
  const revealed = await js("document.getElementById('view-password').textContent");
  if (revealed !== 'secret-pass') throw new Error(`reveal failed: ${revealed}`);

  await js("document.getElementById('theme-btn').click()");
  const theme = await js('document.documentElement.dataset.theme');
  if (theme !== 'light') throw new Error(`theme did not switch: ${theme}`);

  const copyResult = await js(`(async () => {
    const button = document.querySelector('[data-copy]');
    if (!button) return { error: 'no-button' };
    return window.keydock.copyPassword(button.dataset.copy);
  })()`);
  const copied = await clipboard.readText();
  if (!copyResult || !copyResult.ok || copied !== 'secret-pass') {
    throw new Error(`copy failed: ${JSON.stringify(copyResult)} clipboard=${JSON.stringify(copied)}`);
  }
  clipboard.clear();

  const stored = fs.readFileSync(ctx.dbPath);
  if (stored.includes(Buffer.from('secret-pass'))) throw new Error('password was stored in plaintext');
  if (stored.includes(Buffer.from('smoke-test-password'))) throw new Error('master password was stored');

  await js("document.getElementById('lock-btn').click()");
  await waitFor(
    async () => js("document.getElementById('lock-screen').hidden === false"),
    'vault did not lock',
  );
  await js(`
    document.getElementById('master-password').value = 'wrong-password';
    document.getElementById('lock-form').requestSubmit();
  `);
  await waitFor(
    async () => js("document.getElementById('lock-error').textContent.includes('không đúng')"),
    'wrong password was accepted',
  );
  await js(`
    document.getElementById('master-password').value = 'smoke-test-password';
    document.getElementById('lock-form').requestSubmit();
  `);
  await waitFor(
    async () => js("document.getElementById('shell').hidden === false && document.getElementById('entry-rows').textContent.includes('GitHub')"),
    'unlock did not restore the vault',
  );
  console.log('ui smoke ok');
}

function focusWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusWindow);
  app.on('window-all-closed', () => app.quit());
  let quitCleanup = false;
  app.on('before-quit', (event) => {
    if (quitCleanup) return;
    event.preventDefault();
    quitCleanup = true;
    Promise.resolve(clearCopiedSecret()).finally(() => {
      clearTimeout(idleTimer);
      if (ctx.vault) ctx.vault.lock();
      if (ctx.database) {
        try { ctx.database.close(); } catch { /* already closed */ }
      }
      app.quit();
    });
  });

  app.whenReady().then(() => {
    if (process.platform === 'darwin') {
      app.setAboutPanelOptions({
        applicationName: 'KeyDock',
        applicationVersion: app.getVersion(),
        copyright: 'Local-First Password Vault',
      });
    }
    ctx.database = openDatabase(ctx.dbPath);
    ctx.vault = createVault(ctx.database);
    registerIpc();
    buildMenu();
    createWindow();
    if (!app.isPackaged) {
      console.log(`[keydock] database ${ctx.dbPath}`);
    }
    if (process.env.KEYDOCK_SMOKE === '1') {
      runSmoke().then(() => app.exit(0)).catch((error) => {
        console.error(error);
        app.exit(1);
      });
    }
  }).catch((error) => {
    dialog.showErrorBox('KeyDock', error.message || 'Không mở được cơ sở dữ liệu.');
    app.quit();
  });
}
