const $ = (id) => document.getElementById(id);

const lockScreen = $('lock-screen');
const lockHeading = $('lock-heading');
const lockCopy = $('lock-copy');
const lockForm = $('lock-form');
const masterPassword = $('master-password');
const toggleMaster = $('toggle-master');
const confirmWrap = $('confirm-wrap');
const confirmPassword = $('confirm-password');
const lockError = $('lock-error');
const unlockBtn = $('unlock-btn');
const shell = $('shell');
const categoryNav = $('category-nav');
const addCategoryBtn = $('add-category-btn');
const generatorNav = $('generator-nav');
const jsonBtn = $('json-btn');
const jsonMenu = $('json-menu');
const exportBtn = $('export-btn');
const importBtn = $('import-btn');
const themeBtn = $('theme-btn');
const lockBtn = $('lock-btn');
const searchInput = $('search-input');
const newBtn = $('new-btn');
const entryRows = $('entry-rows');
const selectAll = $('select-all');
const bulkBar = $('bulk-bar');
const bulkCount = $('bulk-count');
const bulkExport = $('bulk-export');
const bulkMove = $('bulk-move');
const bulkDelete = $('bulk-delete');
const bulkRestore = $('bulk-restore');
const bulkPurge = $('bulk-purge');
const emptyState = $('empty-state');
const emptyCopy = $('empty-copy');
const resultCount = $('result-count');
const idleLabel = $('idle-label');
const shortcutLabel = $('shortcut-label');
const vaultView = $('vault-view');
const generator = $('generator');
const genPassword = $('gen-password');
const genCopy = $('gen-copy');
const genRefresh = $('gen-refresh');
const genStrength = $('gen-strength');
const genLength = $('gen-length');
const genLengthLabel = $('gen-length-label');
const genLower = $('gen-lower');
const genUpper = $('gen-upper');
const genNumbers = $('gen-numbers');
const genSymbols = $('gen-symbols');
const genHistory = $('gen-history');
const inspector = $('inspector');
const inspectorKicker = $('inspector-kicker');
const inspectorClose = $('inspector-close');
const inspectorView = $('inspector-view');
const viewTitle = $('view-title');
const viewCorrupt = $('view-corrupt');
const viewBody = $('view-body');
const viewUpdated = $('view-updated');
const editBtn = $('edit-btn');
const deleteBtn = $('delete-btn');
const editorForm = $('editor-form');
const editorTitle = $('editor-title');
const editorKind = $('editor-kind');
const editorCategory = $('editor-category');
const editorCategoryNew = $('editor-category-new');
const historyBtn = $('history-btn');
const editorFields = $('editor-fields');
const editorAccounts = $('editor-accounts');
const editorNote = $('editor-note');
const editorCancel = $('editor-cancel');
const editorSave = $('editor-save');
const contextMenu = $('context-menu');
const toast = $('toast');
const modal = $('modal');
const modalTitle = $('modal-title');
const modalBody = $('modal-body');
const modalExtra = $('modal-extra');
const modalError = $('modal-error');
const modalActions = $('modal-actions');

const state = {
  initialized: false,
  unlocked: false,
  kinds: [
    { name: 'Web', kind: 'web', icon: 'globe' },
    { name: 'SSH', kind: 'ssh', icon: 'terminal' },
    { name: 'Server', kind: 'server', icon: 'server' },
    { name: 'Database', kind: 'database', icon: 'database' },
  ],
  groups: { web: [], ssh: [], server: [], database: [] },
  entries: [],
  deleted: [],
  checked: new Set(),
  kind: 'all',
  group: '',
  screen: 'vault',
  query: '',
  selectedId: null,
  detail: null,
  mode: null,
  draft: emptyDraft(),
  revealed: new Set(),
  generator: { length: 16, lowercase: true, uppercase: true, numbers: true, symbols: true },
  generated: '',
  history: [],
  clipboardSeconds: 15,
};

let modalResolver = null;
let toastTimer = null;
let copiedId = null;
let copiedTimer = null;
let lastActivity = 0;
let selectSeq = 0;

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function fold(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

const ICONS = {
  all: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"></rect><rect x="13" y="4" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"></rect><rect x="4" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"></rect><rect x="13" y="13" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"></rect></svg>',
  globe: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"></circle><path d="M4 12h16M12 4c2.4 2.6 2.4 13.4 0 16M12 4c-2.4 2.6-2.4 13.4 0 16" fill="none" stroke="currentColor" stroke-width="1.8"></path></svg>',
  mail: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg>',
  terminal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><path d="M7 9l3 3-3 3M12 15h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
  server: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"></rect><rect x="4" y="14" width="16" height="6" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8"></rect><path d="M7 7h.01M7 17h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"></path></svg>',
  database: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7" ry="3" fill="none" stroke="currentColor" stroke-width="1.8"></ellipse><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" fill="none" stroke="currentColor" stroke-width="1.8"></path><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" fill="none" stroke="currentColor" stroke-width="1.8"></path></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5h6l2 2h9v8.5a1.5 1.5 0 0 1-1.5 1.5h-15a1.5 1.5 0 0 1-1.5-1.5v-9a1.5 1.5 0 0 1 1.5-1.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7 7l.8 12.2a1.5 1.5 0 0 0 1.5 1.3h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg>',
};

const DB_ENGINES = ['PostgreSQL', 'MySQL', 'MariaDB', 'SQLite', 'SQL Server', 'Oracle', 'MongoDB', 'Redis', 'Cassandra', 'Elasticsearch'];
const COPY_SVG = '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"></rect><path d="M6 16V6a1 1 0 0 1 1-1h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>';
const EYE_SVG = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"></path><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.8"></circle></svg>';
const EYE_OFF_SVG = '<svg viewBox="0 0 24 24"><path d="M3 3l18 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path><path d="M9.9 5.2A10 10 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3.2 4.2M6.1 6.1C3.6 7.8 2 12 2 12s3.5 6 10 6c1.5 0 2.9-.3 4.1-.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>';

const FIELD_SETS = {
  web: [{ id: 'editor-host', key: 'url', label: 'Địa chỉ web', placeholder: 'https://' }],
  ssh: [
    { id: 'editor-host', key: 'host', label: 'Máy chủ', placeholder: 'bastion.example.com' },
    { id: 'editor-port', key: 'port', label: 'Cổng', placeholder: '22' },
  ],
  server: [
    { id: 'editor-host', key: 'host', label: 'Máy chủ' },
    { id: 'editor-port', key: 'port', label: 'Cổng' },
    { id: 'editor-protocol', key: 'protocol', label: 'Giao thức', placeholder: 'SSH, RDP, WinRM…' },
  ],
  database: [
    { id: 'editor-host', key: 'host', label: 'Máy chủ' },
    { id: 'editor-port', key: 'port', label: 'Cổng', placeholder: '5432' },
    { id: 'editor-database', key: 'database', label: 'Tên database' },
  ],
};

function emptyAccount() {
  return { id: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`, username: '', password: '', privateKey: '', passphrase: '', reveal: false };
}

function emptyDraft() {
  return { url: '', host: '', port: '', engine: '', database: '', protocol: '', accounts: [emptyAccount()] };
}

function kindLabel(kind) {
  const match = state.kinds.find((item) => item.kind === kind);
  return match ? match.name : 'Web';
}

function applyCatalog(catalog) {
  if (!catalog) return;
  if (Array.isArray(catalog.kinds) && catalog.kinds.length) state.kinds = catalog.kinds;
  const groups = catalog.groups || {};
  state.groups = {
    web: groups.web || [],
    ssh: groups.ssh || [],
    server: groups.server || [],
    database: groups.database || [],
  };
}

function currentKind() {
  return editorKind && editorKind.value ? editorKind.value : 'web';
}

function iconButton(label, svg, data) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-btn';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = svg;
  Object.entries(data || {}).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  return button;
}

function iconSpan(name) {
  const span = document.createElement('span');
  span.className = 'nav-icon';
  span.innerHTML = ICONS[name] || ICONS.folder;
  return span;
}

function fieldValue(key) {
  if (key === 'url') return state.draft.url;
  return state.draft[key] || '';
}

function formatTime(ms) {
  if (!ms) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(ms);
}

function showToast(message, duration = 4200) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    toast.textContent = '';
  }, duration);
}

function modifierLabel() {
  return window.keydock && window.keydock.platform === 'darwin' ? '⌘' : 'Ctrl+';
}

const SUN_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"></circle><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg>';
const MOON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3.5A8.5 8.5 0 1 0 20.5 14 7 7 0 0 1 16 3.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"></path></svg>';

function syncThemeButton() {
  const light = document.documentElement.dataset.theme === 'light';
  const label = light ? 'Nền đen' : 'Nền trắng';
  themeBtn.setAttribute('aria-label', label);
  themeBtn.title = label;
  const icon = themeBtn.querySelector('.nav-icon');
  const text = themeBtn.querySelector('.theme-label');
  if (icon) icon.innerHTML = light ? MOON_SVG : SUN_SVG;
  if (text) text.textContent = label;
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('keydock-theme', next);
  syncThemeButton();
}

function filteredEntries() {
  const query = fold(state.query.trim());
  return state.entries.filter((entry) => {
    if (state.kind !== 'all' && state.kind !== 'deleted' && entry.kind !== state.kind) return false;
    if (state.group && entry.category !== state.group) return false;
    if (!query) return true;
    const names = (entry.accounts || []).map((account) => account.username).join('\n');
    const haystack = fold([
      entry.title, entry.username, names, entry.host, entry.url, entry.category,
      entry.note, entry.engine, entry.database, entry.protocol, entry.port,
    ].join('\n'));
    return haystack.includes(query);
  });
}

function renderCategories() {
  clear(categoryNav);
  const all = navButton({
    label: 'Tất cả',
    icon: 'all',
    count: state.entries.length,
    kind: 'all',
    group: '',
    category: 'All',
    current: state.screen === 'vault' && state.kind === 'all',
  });
  categoryNav.append(all);
  for (const type of state.kinds) {
    const count = state.entries.filter((entry) => entry.kind === type.kind).length;
    categoryNav.append(navButton({
      label: type.name,
      icon: type.icon,
      count,
      kind: type.kind,
      group: '',
      category: type.name,
      current: state.screen === 'vault' && state.kind === type.kind && !state.group,
    }));
    const names = new Set(state.groups[type.kind] || []);
    for (const entry of state.entries) {
      if (entry.kind === type.kind && entry.category) names.add(entry.category);
    }
    for (const name of names) {
      const groupCount = state.entries.filter((entry) => entry.kind === type.kind && entry.category === name).length;
      categoryNav.append(navButton({
        label: name,
        icon: 'folder',
        count: groupCount,
        kind: type.kind,
        group: name,
        sub: true,
        current: state.screen === 'vault' && state.kind === type.kind && state.group === name,
      }));
    }
  }
  categoryNav.append(navButton({
    label: 'Đã xóa',
    icon: 'trash',
    count: state.deleted.length,
    kind: 'deleted',
    group: '',
    current: state.screen === 'vault' && state.kind === 'deleted',
  }));
  generatorNav.setAttribute('aria-current', state.screen === 'generator' ? 'true' : 'false');
}

function navButton({ label, icon, count, kind, group, category, current, sub }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = sub ? 'nav-item nav-sub' : 'nav-item';
  button.dataset.kind = kind;
  button.dataset.group = group || '';
  if (category) button.dataset.category = category;
  button.setAttribute('aria-current', current ? 'true' : 'false');
  const text = document.createElement('span');
  text.className = 'nav-label';
  text.append(iconSpan(icon), document.createTextNode(label));
  const badge = document.createElement('span');
  badge.className = 'nav-count';
  badge.textContent = String(count);
  button.append(text, badge);
  return button;
}

function setHeaders(labels) {
  const heads = document.querySelectorAll('#entry-table thead th:not(.check-col)');
  labels.forEach((label, index) => {
    if (heads[index]) heads[index].textContent = label;
  });
}

function visibleKeys() {
  if (state.kind === 'deleted') return state.deleted.map((entry) => entry.revisionId);
  return filteredEntries().map((entry) => entry.id);
}

function selectedKeys() {
  return visibleKeys().filter((key) => state.checked.has(key));
}

function syncBulk() {
  const keys = visibleKeys();
  const selected = selectedKeys();
  bulkBar.hidden = selected.length === 0;
  bulkCount.textContent = `${selected.length} đã chọn`;
  const trash = state.kind === 'deleted';
  bulkExport.hidden = trash;
  bulkMove.hidden = trash;
  bulkDelete.hidden = trash;
  bulkRestore.hidden = !trash;
  bulkPurge.hidden = !trash;
  selectAll.checked = keys.length > 0 && selected.length === keys.length;
  selectAll.indeterminate = selected.length > 0 && selected.length < keys.length;
}

function checkCell(key) {
  const td = document.createElement('td');
  td.className = 'check-col';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.dataset.check = key;
  box.checked = state.checked.has(key);
  box.setAttribute('aria-label', 'Chọn bản ghi');
  td.append(box);
  return td;
}

function renderTable() {
  if (state.kind === 'deleted') {
    renderDeleted();
    return;
  }
  setHeaders(['Tiêu đề', 'Tài khoản', 'Máy chủ', 'Danh mục', 'Cập nhật', '']);
  const rows = filteredEntries();
  clear(entryRows);
  for (const entry of rows) {
    const tr = document.createElement('tr');
    tr.dataset.id = entry.id;
    tr.setAttribute('aria-selected', state.selectedId === entry.id ? 'true' : 'false');
    tr.append(checkCell(entry.id));
    const username = entry.username || '—';
    const place = entry.host || '—';
    const group = entry.category || '—';
    for (const value of [entry.title, username, place, group, formatTime(entry.updatedAt)]) {
      const td = document.createElement('td');
      td.textContent = value;
      if (value === place && place !== '—') td.className = 'mono';
      tr.append(td);
    }
    const action = document.createElement('td');
    const button = iconButton('Chép mật khẩu', COPY_SVG, { copy: entry.id });
    button.disabled = entry.corrupt || !entry.hasPassword;
    if (copiedId === entry.id) button.classList.add('is-copied');
    action.append(button);
    tr.append(action);
    entryRows.append(tr);
  }

  emptyState.hidden = rows.length !== 0;
  if (!rows.length) {
    if (state.query.trim()) emptyCopy.textContent = 'Không có bản ghi khớp với tìm kiếm.';
    else if (state.kind !== 'all') emptyCopy.textContent = 'Mục này chưa có bản ghi.';
    else emptyCopy.textContent = 'Vault đang trống. Thêm bản ghi đầu tiên.';
  }
  const total = state.entries.length;
  resultCount.textContent = rows.length === total ? `${total} bản ghi` : `${rows.length} / ${total} bản ghi`;
  syncBulk();
}

function renderDeleted() {
  setHeaders(['Tiêu đề', 'Loại', 'Danh mục', 'Xóa lúc', '', '']);
  clear(entryRows);
  for (const entry of state.deleted) {
    const tr = document.createElement('tr');
    tr.dataset.revision = entry.revisionId;
    tr.append(checkCell(entry.revisionId));
    for (const value of [entry.title, kindLabel(entry.kind), entry.category || '—', formatTime(entry.deletedAt), '']) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    const action = document.createElement('td');
    const tools = document.createElement('div');
    tools.className = 'row-actions';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-small';
    button.dataset.restore = entry.revisionId;
    button.textContent = 'Khôi phục';
    const purge = document.createElement('button');
    purge.type = 'button';
    purge.className = 'btn btn-small btn-danger';
    purge.dataset.purge = entry.revisionId;
    purge.textContent = 'Xóa hẳn';
    tools.append(button, purge);
    action.append(tools);
    tr.append(action);
    entryRows.append(tr);
  }
  emptyState.hidden = state.deleted.length !== 0;
  emptyCopy.textContent = 'Chưa có bản ghi nào bị xóa.';
  resultCount.textContent = `${state.deleted.length} bản ghi đã xóa`;
  syncBulk();
}

function categoryNames(kind) {
  const names = new Set(state.groups[kind] || []);
  for (const entry of state.entries) {
    if (entry.kind === kind && entry.category) names.add(entry.category);
  }
  return [...names];
}

function isTypeLabel(name) {
  return ['web', 'ssh', 'ssh key', 'server', 'database', 'email'].includes(fold(name));
}

function fillCategoryOptions(selected) {
  const names = categoryNames(currentKind());
  const creating = editorCategory.value === '__new__';
  const typed = editorCategoryNew.value;
  const wanted = selected !== undefined ? selected : (creating ? '__new__' : editorCategory.value);
  clear(editorCategory);
  const none = document.createElement('option');
  none.value = '';
  none.textContent = 'Không có';
  editorCategory.append(none);
  for (const name of names) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    editorCategory.append(option);
  }
  const created = document.createElement('option');
  created.value = '__new__';
  created.textContent = 'Tạo danh mục mới…';
  editorCategory.append(created);
  if (wanted === '__new__') {
    editorCategory.value = '__new__';
    editorCategoryNew.hidden = false;
    editorCategoryNew.value = typed;
    return;
  }
  editorCategory.value = names.includes(wanted) ? wanted : '';
  editorCategoryNew.hidden = true;
  editorCategoryNew.value = '';
}

function chosenCategory() {
  if (editorCategory.value !== '__new__') return editorCategory.value;
  return editorCategoryNew.value.trim().replace(/\s+/g, ' ');
}

function setInspectorOpen(open) {
  inspector.hidden = !open;
  shell.classList.toggle('shell--inspect', open);
}

function closeInspector() {
  state.selectedId = null;
  state.detail = null;
  state.mode = null;
  state.revealed = new Set();
  state.draft = emptyDraft();
  clear(viewBody);
  setInspectorOpen(false);
  renderTable();
}

function captureDraft() {
  const kind = currentKind();
  const read = (id) => {
    const field = document.getElementById(id);
    return field ? field.value : '';
  };
  if (kind === 'web') state.draft.url = read('editor-host');
  else state.draft.host = read('editor-host');
  state.draft.port = read('editor-port');
  const engine = document.getElementById('editor-engine');
  if (engine) {
    state.draft.engine = engine.value === '__custom__' ? read('editor-engine-custom') : engine.value;
  }
  state.draft.protocol = read('editor-protocol');
  state.draft.database = read('editor-database');
  const cards = editorAccounts.querySelectorAll('[data-account-index]');
  cards.forEach((card) => {
    const index = Number(card.dataset.accountIndex);
    const account = state.draft.accounts[index];
    if (!account) return;
    const username = card.querySelector('[data-username]');
    const password = card.querySelector('[data-password]');
    const privateKey = card.querySelector('[data-private-key]');
    const passphrase = card.querySelector('[data-passphrase]');
    if (username) account.username = username.value;
    if (password) account.password = password.value;
    if (privateKey) account.privateKey = privateKey.value;
    if (passphrase) account.passphrase = passphrase.value;
  });
}

function engineField() {
  const label = document.createElement('label');
  label.className = 'field';
  const caption = document.createElement('span');
  caption.textContent = 'Hệ quản trị';
  const select = document.createElement('select');
  select.id = 'editor-engine';
  const known = DB_ENGINES.includes(state.draft.engine);
  const custom = Boolean(state.draft.engine) && !known;
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = 'Chọn loại';
  select.append(blank);
  for (const name of DB_ENGINES) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    select.append(option);
  }
  const other = document.createElement('option');
  other.value = '__custom__';
  other.textContent = 'Khác — nhập tên';
  select.append(other);
  select.value = known ? state.draft.engine : (custom ? '__custom__' : '');
  const customInput = document.createElement('input');
  customInput.id = 'editor-engine-custom';
  customInput.placeholder = 'ClickHouse, Neo4j…';
  customInput.maxLength = 80;
  customInput.spellcheck = false;
  customInput.autocomplete = 'off';
  customInput.value = custom ? state.draft.engine : '';
  customInput.hidden = select.value !== '__custom__';
  select.addEventListener('change', () => {
    customInput.hidden = select.value !== '__custom__';
    if (select.value !== '__custom__') customInput.value = '';
  });
  label.append(caption, select, customInput);
  return label;
}

function renderEditorFields() {
  const kind = currentKind();
  const fields = FIELD_SETS[kind] || FIELD_SETS.web;
  clear(editorFields);
  if (kind === 'database') editorFields.append(engineField());
  for (const field of fields) {
    const label = document.createElement('label');
    label.className = 'field';
    const caption = document.createElement('span');
    caption.textContent = field.label;
    const input = document.createElement('input');
    input.id = field.id;
    input.type = 'text';
    input.maxLength = field.key === 'port' ? 5 : 500;
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.placeholder = field.placeholder || '';
    input.value = field.key === 'url' ? state.draft.url : (state.draft[field.key] || '');
    label.append(caption, input);
    editorFields.append(label);
  }
}

function renderEditorAccounts() {
  const kind = currentKind();
  clear(editorAccounts);
  const account = state.draft.accounts[0] || emptyAccount();
  state.draft.accounts = [account];
  const card = document.createElement('div');
  card.className = 'account-block';
  card.dataset.accountIndex = '0';
  card.append(textField('Tên đăng nhập', 'data-username', account.username, 'editor-username'));
  card.append(passwordField(account, 0));
  if (kind === 'ssh') {
    card.append(areaField('Khóa riêng', 'data-private-key', account.privateKey, 'Dán private key nếu đăng nhập bằng khóa'));
    card.append(textField('Passphrase của khóa', 'data-passphrase', account.passphrase, '', true));
  }
  editorAccounts.append(card);
}

function textField(labelText, dataName, value, id, secret) {
  const label = document.createElement('label');
  label.className = 'field';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const input = document.createElement('input');
  input.type = secret ? 'password' : 'text';
  input.dataset[dataName.replace('data-', '').replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = '1';
  input.setAttribute(dataName, '');
  if (id) input.id = id;
  input.maxLength = 2048;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = value || '';
  label.append(caption, input);
  return label;
}

function passwordField(account, index) {
  const label = document.createElement('label');
  label.className = 'field';
  const caption = document.createElement('span');
  caption.textContent = 'Mật khẩu';
  const control = document.createElement('span');
  control.className = 'field-control';
  const input = document.createElement('input');
  input.type = account.reveal ? 'text' : 'password';
  input.setAttribute('data-password', '');
  if (index === 0) input.id = 'editor-password';
  input.maxLength = 2048;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = account.password || '';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'ghost-btn';
  toggle.dataset.togglePassword = String(index);
  toggle.setAttribute('aria-label', account.reveal ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  toggle.innerHTML = account.reveal ? EYE_OFF_SVG : EYE_SVG;
  control.append(input, toggle);
  const generate = document.createElement('button');
  generate.type = 'button';
  generate.className = 'text-btn';
  generate.dataset.generateAccount = String(index);
  generate.textContent = 'Tạo mật khẩu';
  label.append(caption, control, generate);
  return label;
}

function areaField(labelText, dataName, value, placeholder) {
  const label = document.createElement('label');
  label.className = 'field';
  const caption = document.createElement('span');
  caption.textContent = labelText;
  const area = document.createElement('textarea');
  area.rows = 4;
  area.maxLength = 20000;
  area.spellcheck = false;
  area.placeholder = placeholder;
  area.setAttribute(dataName, '');
  area.value = value || '';
  label.append(caption, area);
  return label;
}

function fieldRow(labelText, value, tools, valueId) {
  const row = document.createElement('div');
  row.className = 'field-row';
  const body = document.createElement('div');
  const term = document.createElement('div');
  term.className = 'field-row-label';
  term.textContent = labelText;
  const desc = document.createElement('div');
  desc.className = 'field-row-value';
  if (valueId) desc.id = valueId;
  desc.textContent = value;
  body.append(term, desc);
  row.append(body);
  if (tools && tools.length) {
    const actions = document.createElement('div');
    actions.className = 'field-row-tools';
    tools.forEach((tool) => actions.append(tool));
    row.append(actions);
  }
  return row;
}

function copyTool(label, field, accountId) {
  return iconButton(label, COPY_SVG, { copyField: field, accountId: accountId || '' });
}

function renderView() {
  const detail = state.detail;
  clear(viewBody);
  if (!detail || detail.corrupt) return;
  for (const fact of connectionFacts(detail)) {
    const tools = fact.value ? [copyTool(`Chép ${fact.label.toLowerCase()}`, fact.field)] : [];
    const row = fieldRow(fact.label, fact.value || '—', tools);
    if (fact.value) row.querySelector('.field-row-value').classList.add('mono');
    viewBody.append(row);
  }
  const account = (detail.accounts || [])[0] || { id: '', username: '', password: '' };
  {
    const heading = document.createElement('p');
    heading.className = 'section-label';
    heading.textContent = 'Tài khoản';
    viewBody.append(heading);
    const userTools = account.username ? [copyTool('Chép tài khoản', 'username', account.id)] : [];
    viewBody.append(fieldRow('Tên đăng nhập', account.username || '—', userTools));

    const shown = state.revealed.has(account.id);
    const hasSecret = Boolean(account.password || account.hasPassword);
    const secret = shown ? (account.password || 'Không có') : (hasSecret ? '••••••••' : 'Không có');
    const secretTools = [];
    if (hasSecret) {
      const reveal = iconButton(shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu', shown ? EYE_OFF_SVG : EYE_SVG, { reveal: account.id });
      reveal.id = 'reveal-btn';
      secretTools.push(reveal, copyTool('Chép mật khẩu', 'password', account.id));
    }
    const passwordRow = fieldRow('Mật khẩu', secret, secretTools, 'view-password');
    passwordRow.querySelector('.field-row-value').classList.add('mono');
    viewBody.append(passwordRow);

    if (detail.kind === 'ssh') {
      if (account.privateKey) {
        const keyShown = state.revealed.has(`${account.id}:key`);
        const keyTools = [
          iconButton(keyShown ? 'Ẩn khóa' : 'Hiện khóa', keyShown ? EYE_OFF_SVG : EYE_SVG, { reveal: `${account.id}:key` }),
          copyTool('Chép khóa riêng', 'key', account.id),
        ];
        const keyRow = fieldRow('Khóa riêng', keyShown ? account.privateKey : 'Đã lưu khóa riêng', keyTools);
        keyRow.querySelector('.field-row-value').classList.add('note');
        viewBody.append(keyRow);
      }
      if (account.passphrase) {
        const passShown = state.revealed.has(`${account.id}:pass`);
        const passTools = [
          iconButton(passShown ? 'Ẩn passphrase' : 'Hiện passphrase', passShown ? EYE_OFF_SVG : EYE_SVG, { reveal: `${account.id}:pass` }),
          copyTool('Chép passphrase', 'passphrase', account.id),
        ];
        viewBody.append(fieldRow('Passphrase', passShown ? account.passphrase : '••••••••', passTools));
      }
      const command = sshCommand(detail, account);
      if (command) viewBody.append(fieldRow('Lệnh SSH', command, [copyTool('Chép lệnh SSH', 'ssh', account.id)]));
    }
    if (detail.kind === 'database') {
      const uri = dbUri(detail, account);
      if (uri) {
        const uriRow = fieldRow('Chuỗi kết nối', uri, [copyTool('Chép chuỗi kết nối', 'uri', account.id)]);
        uriRow.querySelector('.field-row-value').classList.add('mono');
        viewBody.append(uriRow);
      }
    }
  }
  viewBody.append(fieldRow('Ghi chú', detail.note || '—', detail.note ? [copyTool('Chép ghi chú', 'note')] : []));
}

function sshCommand(detail, account) {
  if (!detail.host) return '';
  const user = account.username ? `${account.username}@` : '';
  const port = detail.port && detail.port !== '22' ? ` -p ${detail.port}` : '';
  return `ssh ${user}${detail.host}${port}`.trim();
}

function dbUri(detail, account) {
  if (!detail.host && !detail.database) return '';
  const engine = String(detail.engine || '').toLowerCase();
  let scheme = '';
  if (engine.includes('postgres')) scheme = 'postgresql';
  else if (engine.includes('maria') || engine.includes('mysql')) scheme = 'mysql';
  else if (engine.includes('mongo')) scheme = 'mongodb';
  else if (engine.includes('redis')) scheme = 'redis';
  else if (engine.includes('sql server') || engine.includes('mssql')) scheme = 'mssql';
  else if (engine.includes('elastic')) scheme = 'http';
  const user = account.username ? `${encodeURIComponent(account.username)}@` : '';
  const host = detail.host || 'localhost';
  const port = detail.port ? `:${detail.port}` : '';
  const name = detail.database ? `/${encodeURIComponent(detail.database)}` : '';
  return scheme ? `${scheme}://${user}${host}${port}${name}` : `${user}${host}${port}${name}`;
}

function connectionFacts(detail) {
  const kind = detail.kind || 'web';
  if (kind === 'web') return [{ label: 'Địa chỉ', field: 'url', value: detail.url || detail.host }];
  if (kind === 'ssh') {
    return [
      { label: 'Máy chủ', field: 'host', value: detail.host },
      { label: 'Cổng', field: 'port', value: detail.port || '22' },
    ];
  }
  if (kind === 'server') {
    return [
      { label: 'Máy chủ', field: 'host', value: detail.host },
      { label: 'Cổng', field: 'port', value: detail.port },
      { label: 'Giao thức', field: 'protocol', value: detail.protocol },
    ].filter((item) => item.value);
  }
  return [
    { label: 'Hệ quản trị', field: 'engine', value: detail.engine },
    { label: 'Máy chủ', field: 'host', value: detail.host },
    { label: 'Cổng', field: 'port', value: detail.port },
    { label: 'Database', field: 'database', value: detail.database },
  ].filter((item) => item.value);
}

function renderInspector() {
  const detail = state.detail;
  if (!detail || state.mode !== 'view') return;
  inspectorView.hidden = false;
  editorForm.hidden = true;
  setInspectorOpen(true);
  const group = detail.category ? `${kindLabel(detail.kind)} · ${detail.category}` : kindLabel(detail.kind);
  inspectorKicker.textContent = detail.corrupt ? 'Lỗi' : group;
  viewTitle.textContent = detail.title;
  viewCorrupt.hidden = !detail.corrupt;
  viewUpdated.textContent = detail.updatedAt ? `Cập nhật ${formatTime(detail.updatedAt)}` : '';
  editBtn.hidden = Boolean(detail.corrupt);
  renderView();
  historyBtn.hidden = Boolean(detail.corrupt);
  renderTable();
}

async function selectEntry(id) {
  const summary = state.entries.find((entry) => entry.id === id);
  if (!summary) return;
  const seq = ++selectSeq;
  state.selectedId = id;
  state.mode = 'view';
  if (summary.corrupt) {
    state.detail = { ...summary, password: '' };
    renderInspector();
    return;
  }
  const result = await window.keydock.get(id);
  if (seq !== selectSeq) return;
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  state.detail = result.entry;
  renderInspector();
}

function openEditor(mode) {
  showVaultList();
  state.mode = mode;
  inspectorView.hidden = true;
  editorForm.hidden = false;
  inspectorKicker.textContent = mode === 'edit' ? 'Sửa bản ghi' : 'Bản ghi mới';
  editorSave.textContent = mode === 'edit' ? 'Lưu' : 'Thêm';
  renderEditorFields();
  renderEditorAccounts();
  setInspectorOpen(true);
  renderTable();
  editorTitle.focus();
}

function openCreate() {
  state.selectedId = null;
  state.detail = null;
  selectSeq += 1;
  state.draft = emptyDraft();
  editorKind.value = ['web', 'ssh', 'server', 'database'].includes(state.kind) ? state.kind : 'web';
  fillCategoryOptions(state.group || '');
  editorTitle.value = '';
  editorNote.value = '';
  openEditor('create');
}

function openEdit() {
  if (!state.detail || state.detail.corrupt) return;
  const detail = state.detail;
  editorKind.value = detail.kind === 'email' ? 'web' : (detail.kind || 'web');
  fillCategoryOptions(detail.category || '');
  editorTitle.value = detail.title;
  editorNote.value = detail.note || '';
  state.draft = {
    url: detail.url || '',
    host: detail.host || '',
    port: detail.port || '',
    engine: detail.engine || '',
    database: detail.database || '',
    protocol: detail.protocol || '',
    accounts: (detail.accounts && detail.accounts.length ? detail.accounts.slice(0, 1) : [emptyAccount()]).map((account) => ({
      id: account.id,
      username: account.username || '',
      password: account.password || '',
      privateKey: account.privateKey || '',
      passphrase: account.passphrase || '',
      reveal: false,
    })),
  };
  openEditor('edit');
}

function showLock(message) {
  if (!modal.hidden) settleModal(null);
  state.unlocked = false;
  state.entries = [];
  state.deleted = [];
  state.checked.clear();
  state.detail = null;
  state.selectedId = null;
  state.mode = null;
  state.history = [];
  state.generated = '';
  state.revealed = new Set();
  shell.hidden = true;
  setInspectorOpen(false);
  lockScreen.hidden = false;
  const firstRun = !state.initialized;
  confirmWrap.hidden = !firstRun;
  unlockBtn.textContent = firstRun ? 'Tạo vault' : 'Mở khóa';
  lockHeading.textContent = firstRun ? 'Tạo vault mới' : 'Mở vault';
  lockCopy.textContent = firstRun
    ? 'Đặt mật khẩu chính cho kho trên máy này. Chỉ bạn biết mật khẩu đó.'
    : 'Nhập mật khẩu chính để mở kho của bạn.';
  lockError.textContent = message || '';
  masterPassword.value = '';
  confirmPassword.value = '';
  masterPassword.type = 'password';
  toggleMaster.textContent = 'Hiện';
  unlockBtn.disabled = false;
  masterPassword.focus();
}

async function showShell() {
  state.unlocked = true;
  lockScreen.hidden = true;
  shell.hidden = false;
  showVaultList();
  await refreshCategories();
  renderTable();
  searchInput.focus();
}

function showVaultList() {
  state.screen = 'vault';
  vaultView.hidden = false;
  generator.hidden = true;
  renderCategories();
}

async function refreshCategories() {
  const result = await window.keydock.categories();
  if (!result.ok) return;
  applyCatalog(result);
  renderCategories();
  if (!editorForm.hidden) fillCategoryOptions();
}

async function reload() {
  const [result, deleted] = await Promise.all([window.keydock.list(), window.keydock.deleted()]);
  if (!result.ok) {
    if (result.code === 'LOCKED') showLock('Vault đã khóa.');
    else showToast(result.error);
    return false;
  }
  state.entries = result.entries;
  state.deleted = deleted.ok ? deleted.entries : [];
  renderCategories();
  renderTable();
  return true;
}

async function submitLock(event) {
  event.preventDefault();
  const password = masterPassword.value;
  const confirm = confirmPassword.value;
  lockError.textContent = '';
  if (!state.initialized && password !== confirm) {
    lockError.textContent = 'Mật khẩu nhập lại không khớp.';
    return;
  }
  unlockBtn.disabled = true;
  unlockBtn.textContent = state.initialized ? 'Đang mở khóa…' : 'Đang tạo vault…';
  const result = state.initialized
    ? await window.keydock.unlock(password)
    : await window.keydock.setup(password);
  masterPassword.value = '';
  confirmPassword.value = '';
  if (!result.ok) {
    lockError.textContent = result.error;
    unlockBtn.disabled = false;
    unlockBtn.textContent = state.initialized ? 'Mở khóa' : 'Tạo vault';
    return;
  }
  state.initialized = true;
  state.entries = result.entries || [];
  await showShell();
}

async function copyPassword(id, accountId) {
  const result = await window.keydock.copyPassword(id, accountId);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  copiedId = id;
  renderTable();
  showToast(`Đã chép mật khẩu. Clipboard sẽ được xóa sau ${result.seconds} giây.`, result.seconds * 1000);
  clearTimeout(copiedTimer);
  copiedTimer = setTimeout(() => {
    copiedId = null;
    if (state.unlocked) renderTable();
  }, result.seconds * 1000);
}

async function copyPlain(text, message) {
  const result = await window.keydock.copyText(text);
  showToast(result.ok ? message : result.error);
}

async function copyField(field, accountId) {
  const detail = state.detail;
  if (!detail) return;
  const account = (detail.accounts || []).find((item) => item.id === accountId) || (detail.accounts || [])[0] || {};
  if (field === 'password') {
    copyPassword(detail.id, account.id);
    return;
  }
  let text = '';
  let secret = false;
  let message = 'Đã chép.';
  if (field === 'username') {
    text = account.username;
    message = 'Đã chép tài khoản.';
  } else if (field === 'key') {
    text = account.privateKey;
    secret = true;
    message = 'Đã chép khóa riêng. Clipboard sẽ được xóa sau 15 giây.';
  } else if (field === 'passphrase') {
    text = account.passphrase;
    secret = true;
    message = 'Đã chép passphrase. Clipboard sẽ được xóa sau 15 giây.';
  } else if (field === 'host') text = detail.host;
  else if (field === 'url') text = detail.url || detail.host;
  else if (field === 'port') text = detail.port || (detail.kind === 'ssh' ? '22' : '');
  else if (field === 'engine') text = detail.engine;
  else if (field === 'database') text = detail.database;
  else if (field === 'protocol') text = detail.protocol;
  else if (field === 'note') text = detail.note;
  else if (field === 'ssh') {
    text = sshCommand(detail, account);
    message = 'Đã chép lệnh SSH.';
  } else if (field === 'uri') {
    text = dbUri(detail, account);
    message = 'Đã chép chuỗi kết nối.';
  }
  if (!text) {
    showToast('Không có gì để chép.');
    return;
  }
  if (secret) {
    const result = await window.keydock.copySecret(text);
    showToast(result.ok ? message : result.error, result.ok ? result.seconds * 1000 : 4200);
    return;
  }
  copyPlain(text, message);
}

async function openHistory() {
  const id = state.selectedId;
  if (!id || state.mode !== 'view') return;
  const seq = selectSeq;
  const result = await window.keydock.history(id);
  if (seq !== selectSeq || state.selectedId !== id) return;
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  const revisions = result.revisions || [];
  revisionSecrets.clear();
  await openModal({
    title: 'Nhật ký',
    body: revisions.length
      ? 'Mỗi dòng là một phiên bản cũ. Bấm Chi tiết để xem nội dung, rồi mới khôi phục.'
      : 'Chưa có thay đổi nào để khôi phục.',
    wide: revisions.length > 0,
    extra(container) {
      if (!revisions.length) return null;
      const list = document.createElement('div');
      list.className = 'history-list';
      for (const revision of revisions) list.append(historyItem(revision));
      list.addEventListener('click', (event) => {
        const restore = event.target.closest('[data-restore]');
        if (restore) {
          settleModal(null);
          restoreRevision(restore.dataset.restore);
          return;
        }
        const secret = event.target.closest('[data-preview-secret]');
        if (secret) {
          toggleRevisionSecret(secret.dataset.previewSecret, secret, list);
          return;
        }
        const toggle = event.target.closest('[data-toggle-preview]');
        if (!toggle) return;
        const open = toggle.getAttribute('aria-expanded') !== 'true';
        for (const body of list.querySelectorAll('[data-preview-body]')) {
          const match = open && body.dataset.previewBody === toggle.dataset.togglePreview;
          body.hidden = !match;
          const button = list.querySelector(`[data-toggle-preview="${body.dataset.previewBody}"]`);
          if (button) {
            button.textContent = match ? 'Ẩn' : 'Chi tiết';
            button.setAttribute('aria-expanded', match ? 'true' : 'false');
          }
        }
      });
      container.append(list);
      return null;
    },
    actions: [{ label: 'Đóng', value: null }],
  });
}

function historyItem(revision) {
  const row = document.createElement('article');
  row.className = 'history-item';
  const head = document.createElement('div');
  head.className = 'history-head';
  const text = document.createElement('span');
  text.textContent = `${formatTime(revision.createdAt)} · ${changeSummary(revision.preview)}`;
  const tools = document.createElement('div');
  tools.className = 'history-tools';
  const detailButton = document.createElement('button');
  detailButton.type = 'button';
  detailButton.className = 'btn btn-small';
  detailButton.dataset.togglePreview = revision.id;
  detailButton.setAttribute('aria-expanded', 'false');
  detailButton.textContent = 'Chi tiết';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-small';
  button.dataset.restore = revision.id;
  button.textContent = 'Khôi phục';
  tools.append(detailButton, button);
  head.append(text, tools);
  row.append(head);
  const preview = revision.preview;
  const body = document.createElement('div');
  body.className = 'history-preview';
  body.dataset.previewBody = revision.id;
  body.hidden = true;
  if (!preview) {
    const line = document.createElement('p');
    line.textContent = revision.title || 'Không xem được phiên bản này.';
    body.append(line);
    row.append(body);
    return row;
  }
  const current = state.detail;
  const host = preview.host || preview.url || '';
  const currentHost = current ? (current.kind === 'web' ? current.url : current.host) : '';
  const lines = [
    ['Tiêu đề', preview.title || '—', current && preview.title !== current.title],
    ['Danh mục', preview.category || 'Không có', current && (preview.category || '') !== (current.category || '')],
    ['Tài khoản', preview.username || '—', current && (preview.username || '') !== (current.username || '')],
    ['Máy chủ', host || '—', current && host !== (currentHost || '')],
  ];
  if (preview.port || (current && current.port)) {
    lines.push(['Cổng', preview.port || '—', current && (preview.port || '') !== (current.port || '')]);
  }
  if (preview.engine || (current && current.engine)) {
    lines.push(['Hệ quản trị', preview.engine || '—', current && (preview.engine || '') !== (current.engine || '')]);
  }
  if (preview.database || (current && current.database)) {
    lines.push(['Database', preview.database || '—', current && (preview.database || '') !== (current.database || '')]);
  }
  if (preview.protocol || (current && current.protocol)) {
    lines.push(['Giao thức', preview.protocol || '—', current && (preview.protocol || '') !== (current.protocol || '')]);
  }
  if (preview.note || (current && current.note)) {
    lines.push(['Ghi chú', preview.note || '—', current && (preview.note || '') !== (current.note || '')]);
  }
  for (const [label, value, changed] of lines) {
    const line = document.createElement('p');
    if (changed) line.className = 'history-changed';
    const name = document.createElement('span');
    name.textContent = label;
    const content = document.createElement('span');
    content.textContent = value;
    line.append(name, content);
    body.append(line);
  }
  body.append(secretLine('Mật khẩu', revision.id, 'password', preview.hasPassword, preview.passwordChanged));
  if (preview.hasKey || preview.keyChanged) {
    body.append(secretLine('Khóa riêng', revision.id, 'key', preview.hasKey, preview.keyChanged));
  }
  row.append(body);
  return row;
}

function changeSummary(preview) {
  if (!preview) return 'Không xem được';
  const current = state.detail;
  const host = preview.host || preview.url || '';
  const currentHost = current ? (current.kind === 'web' ? current.url : current.host) : '';
  const bits = [];
  if (current && preview.title !== current.title) bits.push('Tiêu đề');
  if (current && (preview.category || '') !== (current.category || '')) bits.push('Danh mục');
  if (current && (preview.username || '') !== (current.username || '')) bits.push('Tài khoản');
  if (current && host !== (currentHost || '')) bits.push('Máy chủ');
  if (current && (preview.port || '') !== (current.port || '') && (preview.port || current.port)) bits.push('Cổng');
  if (preview.passwordChanged) bits.push('Mật khẩu');
  if (preview.keyChanged) bits.push('Khóa');
  if (current && (preview.note || '') !== (current.note || '') && (preview.note || current.note)) bits.push('Ghi chú');
  return bits.length ? bits.join(', ') : 'Không đổi';
}

function secretLine(label, revisionId, field, hasValue, changed) {
  const line = document.createElement('p');
  if (changed) line.className = 'history-changed';
  const name = document.createElement('span');
  name.textContent = label;
  const secretBody = document.createElement('span');
  secretBody.className = 'history-secret';
  const secretValue = document.createElement('span');
  secretValue.className = 'mono';
  secretValue.dataset.secretFor = revisionId;
  secretValue.dataset.secretField = field;
  secretValue.textContent = hasValue ? '••••••••' : 'Không có';
  secretBody.append(secretValue);
  if (hasValue) {
    const reveal = iconButton(field === 'key' ? 'Hiện khóa' : 'Hiện mật khẩu', EYE_SVG, {
      previewSecret: revisionId,
      secretField: field,
    });
    secretBody.append(reveal);
  }
  line.append(name, secretBody);
  return line;
}

const revisionSecrets = new Map();

async function toggleRevisionSecret(id, button, root) {
  const field = button.dataset.secretField || 'password';
  const slot = root.querySelector(`[data-secret-for="${id}"][data-secret-field="${field}"]`);
  if (!slot) return;
  const showLabel = field === 'key' ? 'Hiện khóa' : 'Hiện mật khẩu';
  const hideLabel = field === 'key' ? 'Ẩn khóa' : 'Ẩn mật khẩu';
  if (button.dataset.open === 'true') {
    button.dataset.open = 'false';
    button.setAttribute('aria-label', showLabel);
    button.title = showLabel;
    button.innerHTML = EYE_SVG;
    slot.textContent = '••••••••';
    return;
  }
  let secret = revisionSecrets.get(id);
  if (!secret) {
    const result = await window.keydock.revision(id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    secret = result.secret;
    revisionSecrets.set(id, secret);
  }
  const value = field === 'key' ? secret.privateKey : secret.password;
  slot.textContent = value || 'Không có';
  button.dataset.open = 'true';
  button.setAttribute('aria-label', hideLabel);
  button.title = hideLabel;
  button.innerHTML = EYE_OFF_SVG;
}

async function restoreRevision(id) {
  const result = await window.keydock.restore(id);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  await reload();
  await selectEntry(result.id);
  showToast('Đã khôi phục phiên bản trước.');
}

async function saveForm(event) {
  event.preventDefault();
  captureDraft();
  const category = chosenCategory();
  if (editorCategory.value === '__new__' && !category) {
    showToast('Hãy nhập tên danh mục.');
    editorCategoryNew.focus();
    return;
  }
  if (category && isTypeLabel(category)) {
    showToast('Tên này trùng loại có sẵn. Hãy đặt tên nhóm khác.');
    return;
  }
  const payload = {
    title: editorTitle.value,
    kind: editorKind.value,
    category,
    note: editorNote.value,
    url: state.draft.url,
    host: state.draft.host,
    port: state.draft.port,
    engine: state.draft.engine,
    database: state.draft.database,
    protocol: state.draft.protocol,
    accounts: state.draft.accounts.slice(0, 1).map((account) => ({
      id: account.id,
      username: account.username,
      password: account.password,
      privateKey: account.privateKey,
      passphrase: account.passphrase,
    })),
  };
  const editing = state.mode === 'edit';
  const result = editing
    ? await window.keydock.update({ id: state.selectedId, ...payload })
    : await window.keydock.create(payload);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  state.draft = emptyDraft();
  await reload();
  await selectEntry(result.id);
  showToast(editing ? 'Đã cập nhật bản ghi.' : 'Đã thêm bản ghi.');
}

function settleModal(value) {
  const card = modalTitle.closest('.modal-card');
  if (card) card.classList.remove('modal-card--wide');
  modal.hidden = true;
  clear(modalExtra);
  clear(modalActions);
  modalError.textContent = '';
  const resolve = modalResolver;
  modalResolver = null;
  if (resolve) resolve(value);
}

function openModal({ title, body, actions, expected, prompt, extra, wide }) {
  if (modalResolver) settleModal(null);
  const card = modalTitle.closest('.modal-card');
  if (card) card.classList.toggle('modal-card--wide', Boolean(wide));
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalError.textContent = '';
  clear(modalExtra);
  clear(modalActions);
  const readExtra = typeof extra === 'function' ? extra(modalExtra) : null;
  let input = null;
  if (expected || prompt) {
    input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = prompt || expected;
    input.setAttribute('aria-label', prompt ? 'Tên danh mục' : 'Xác nhận');
    modalExtra.append(input);
  }
  for (const action of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = action.primary ? 'btn btn-primary' : action.danger ? 'btn btn-danger' : 'btn';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      if (action.value && expected && input.value !== expected) {
        modalError.textContent = `Gõ đúng ${expected} để tiếp tục.`;
        input.focus();
        return;
      }
      if (action.value && prompt) {
        const text = input.value.trim();
        if (!text) {
          modalError.textContent = 'Hãy nhập tên danh mục.';
          input.focus();
          return;
        }
        const extraData = typeof readExtra === 'function' ? readExtra() : null;
        settleModal(extraData ? { name: text, ...extraData } : text);
        return;
      }
      if (action.value && !prompt && typeof readExtra === 'function') {
        const extraData = readExtra();
        if (extraData == null) return;
        settleModal(extraData);
        return;
      }
      settleModal(action.value);
    });
    modalActions.append(button);
  }
  modal.hidden = false;
  (input || modalActions.querySelector('button')).focus();
  return new Promise((resolve) => {
    modalResolver = resolve;
  });
}

function hideJsonMenu() {
  jsonMenu.hidden = true;
  jsonBtn.setAttribute('aria-expanded', 'false');
}

function hideContextMenu() {
  contextMenu.hidden = true;
  clear(contextMenu);
}

function showContextMenu(x, y, id, revisionId, items) {
  hideContextMenu();
  const menuItems = items || (revisionId
    ? [
      { label: 'Khôi phục', run: () => restoreRevision(revisionId) },
      { label: 'Xóa vĩnh viễn', danger: true, run: () => purgeDeleted([revisionId]) },
    ]
    : contextItems(id));
  items = menuItems;
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    if (item.danger) button.className = 'danger';
    button.disabled = Boolean(item.disabled);
    button.addEventListener('click', () => {
      hideContextMenu();
      item.run();
    });
    contextMenu.append(button);
  }
  contextMenu.hidden = false;
  const width = 210;
  const height = items.length * 38 + 12;
  const left = Math.max(8, Math.min(x, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - height - 8));
  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;
}

function contextItems(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return [];
  return [
    { label: 'Sao chép mật khẩu', disabled: entry.corrupt || !entry.hasPassword, run: () => copyPassword(id) },
    { label: 'Sao chép tài khoản', disabled: !entry.username, run: () => copyPlain(entry.username, 'Đã chép tài khoản.') },
    { label: 'Sửa', disabled: entry.corrupt, run: () => editFromMenu(id) },
    { label: 'Chuyển danh mục', disabled: entry.corrupt, run: () => moveEntryPrompt(id) },
    { label: 'Xuất bản ghi này', disabled: entry.corrupt, run: () => startExport(id) },
    { label: 'Xóa', danger: true, run: () => removeFromMenu(id) },
  ];
}

async function moveEntryPrompt(id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry || entry.corrupt) return;
  const names = categoryNames(entry.kind);
  const choice = await openModal({
    title: 'Chuyển danh mục',
    body: `“${entry.title}” vẫn thuộc ${kindLabel(entry.kind)}. Chỉ chuyển trong loại này.`,
    extra(container) {
      const label = document.createElement('label');
      label.className = 'field';
      const span = document.createElement('span');
      span.textContent = 'Danh mục';
      const select = document.createElement('select');
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'Không có';
      select.append(none);
      for (const name of names) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.append(option);
      }
      const created = document.createElement('option');
      created.value = '__new__';
      created.textContent = 'Tạo danh mục mới…';
      select.append(created);
      select.value = names.includes(entry.category) ? entry.category : '';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 40;
      input.placeholder = 'Tên danh mục mới';
      input.hidden = true;
      input.spellcheck = false;
      input.autocomplete = 'off';
      select.addEventListener('change', () => {
        input.hidden = select.value !== '__new__';
        if (!input.hidden) input.focus();
      });
      label.append(span, select, input);
      container.append(label);
      return () => {
        const category = select.value === '__new__' ? input.value.trim().replace(/\s+/g, ' ') : select.value;
        if (select.value === '__new__' && !category) {
          modalError.textContent = 'Hãy nhập tên danh mục.';
          input.focus();
          return null;
        }
        if (category && isTypeLabel(category)) {
          modalError.textContent = 'Tên này trùng loại có sẵn.';
          return null;
        }
        if (category === (entry.category || '')) {
          modalError.textContent = 'Bản ghi đang ở danh mục này.';
          return null;
        }
        return { category };
      };
    },
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Chuyển', value: 'move', primary: true },
    ],
  });
  if (!choice || choice.category === undefined) return;
  await moveEntry(id, choice.category);
}

async function moveEntry(id, category, quiet) {
  const loaded = await window.keydock.get(id);
  if (!loaded.ok) {
    showToast(loaded.error);
    return;
  }
  const detail = loaded.entry;
  const result = await window.keydock.update({
    id,
    title: detail.title,
    kind: detail.kind,
    category,
    note: detail.note || '',
    url: detail.url || '',
    host: detail.host || '',
    port: detail.port || '',
    engine: detail.engine || '',
    database: detail.database || '',
    protocol: detail.protocol || '',
    accounts: (detail.accounts || []).slice(0, 1).map((account) => ({
      id: account.id,
      username: account.username || '',
      password: account.password || '',
      privateKey: account.privateKey || '',
      passphrase: account.passphrase || '',
    })),
  });
  if (!result.ok) {
    showToast(result.error);
    return false;
  }
  if (quiet) return true;
  await reload();
  if (state.selectedId === id) await selectEntry(id);
  showToast(category ? `Đã chuyển tới “${category}”.` : 'Đã bỏ danh mục.');
  return true;
}

async function editFromMenu(id) {
  await selectEntry(id);
  openEdit();
}

async function removeFromMenu(id) {
  await selectEntry(id);
  removeSelected();
}

async function startExport(onlyId) {
  hideContextMenu();
  const preset = Array.isArray(onlyId) ? new Set(onlyId) : null;
  const source = state.entries.filter((entry) => !entry.corrupt);
  if (!source.length) {
    showToast('Chưa có bản ghi để xuất.');
    return;
  }
  const ids = await openModal({
    title: 'Chọn bản ghi để xuất',
    body: 'File JSON không mã hóa. Chỉ những bản ghi được chọn mới được ghi ra.',
    extra(container) {
      const list = document.createElement('div');
      list.className = 'pick-list';
      const allRow = document.createElement('label');
      allRow.className = 'pick-row';
      const all = document.createElement('input');
      all.type = 'checkbox';
      const allText = document.createElement('span');
      allText.textContent = 'Chọn tất cả';
      allRow.append(all, allText);
      list.append(allRow);
      for (const entry of source) {
        const row = document.createElement('label');
        row.className = 'pick-row';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.dataset.id = entry.id;
        box.checked = preset ? preset.has(entry.id) : (onlyId ? entry.id === onlyId : true);
        const copy = document.createElement('span');
        copy.className = 'pick-copy';
        const title = document.createElement('strong');
        title.textContent = entry.title;
        const meta = document.createElement('span');
        meta.textContent = [kindLabel(entry.kind), entry.username].filter(Boolean).join(' · ');
        copy.append(title, meta);
        row.append(box, copy);
        list.append(row);
      }
      const boxes = () => [...list.querySelectorAll('input[data-id]')];
      const syncAll = () => {
        const chosen = boxes();
        all.checked = chosen.every((box) => box.checked);
        all.indeterminate = !all.checked && chosen.some((box) => box.checked);
      };
      all.addEventListener('change', () => {
        boxes().forEach((box) => { box.checked = all.checked; });
      });
      list.addEventListener('change', syncAll);
      syncAll();
      container.append(list);
      return () => {
        const chosen = boxes().filter((box) => box.checked).map((box) => box.dataset.id);
        if (!chosen.length) {
          modalError.textContent = 'Hãy chọn ít nhất một bản ghi.';
          return null;
        }
        return chosen;
      };
    },
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Xuất', value: 'export', primary: true },
    ],
  });
  if (!ids) return;
  const result = await window.keydock.exportJson(ids);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  if (result.canceled) return;
  const extra = result.skippedCorrupt ? `\nBỏ qua ${result.skippedCorrupt} bản ghi không giải mã được.` : '';
  showToast(`Đã xuất ${result.count} bản ghi.\n${result.filePath}${extra}`, 7000);
}

function importPreviewTable(rows) {
  const wrap = document.createElement('div');
  wrap.className = 'preview-wrap';
  const table = document.createElement('table');
  table.className = 'preview-table';
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  for (const label of ['Tiêu đề', 'Tài khoản', 'Máy chủ', 'Danh mục', '']) {
    const cell = document.createElement('th');
    cell.textContent = label;
    header.append(cell);
  }
  head.append(header);
  const body = document.createElement('tbody');
  const statusText = { new: 'Mới', duplicate: 'Trùng', invalid: 'Bỏ' };
  for (const row of rows) {
    const line = document.createElement('tr');
    line.dataset.status = row.status || 'new';
    const group = row.category || (row.kind ? kindLabel(row.kind) : '—');
    for (const value of [row.title || '—', row.username || '—', row.host || '—', group]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      if (value === row.host && row.host) cell.className = 'mono';
      line.append(cell);
    }
    const badge = document.createElement('td');
    const tag = document.createElement('span');
    tag.className = `status-tag status-${row.status || 'new'}`;
    tag.textContent = statusText[row.status] || '—';
    badge.append(tag);
    line.append(badge);
    body.append(line);
  }
  table.append(head, body);
  wrap.append(table);
  return wrap;
}

async function startImport() {
  const preview = await window.keydock.pickImport();
  if (!preview.ok) {
    showToast(preview.error);
    return;
  }
  if (preview.canceled) return;
  if (preview.newCount === 0 && preview.duplicateCount === 0) {
    await window.keydock.cancelImport();
    showToast(preview.invalidCount ? 'Không có bản ghi hợp lệ để nhập.' : 'File không có bản ghi.');
    return;
  }
  const lines = [`${preview.newCount} mới · ${preview.duplicateCount} trùng`];
  if (preview.invalidCount) lines.push(`${preview.invalidCount} dòng không hợp lệ sẽ bị bỏ.`);
  if (preview.rowsExtra) lines.push(`Bảng chỉ hiện ${preview.rows.length} dòng đầu.`);
  const actions = preview.duplicateCount
    ? [
      { label: 'Hủy', value: null },
      { label: 'Bỏ qua trùng', value: 'skip' },
      { label: 'Ghi đè trùng', value: 'overwrite', primary: true },
    ]
    : [
      { label: 'Hủy', value: null },
      { label: 'Nhập', value: 'skip', primary: true },
    ];
  const choice = await openModal({
    title: 'Nhập JSON',
    body: lines.join('\n'),
    wide: true,
    extra(container) {
      container.append(importPreviewTable(preview.rows || []));
    },
    actions,
  });
  if (!choice) {
    await window.keydock.cancelImport();
    return;
  }
  const result = await window.keydock.applyImport(choice);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  await reload();
  showToast(`Đã nhập ${result.created} bản ghi mới, ghi đè ${result.overwritten}, bỏ qua ${result.skipped}.`);
}

async function removeSelected() {
  if (!state.selectedId) return;
  const title = state.detail ? state.detail.title : 'bản ghi này';
  const choice = await openModal({
    title: 'Xóa bản ghi?',
    body: `“${title}” sẽ ra khỏi danh sách. Có thể khôi phục trong mục Đã xóa.`,
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Xóa', value: 'delete', danger: true },
    ],
  });
  if (choice !== 'delete') return;
  const result = await window.keydock.remove(state.selectedId);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  closeInspector();
  await reload();
  showToast('Đã xóa bản ghi. Khôi phục được trong mục Đã xóa.');
}

async function removeChecked() {
  const ids = selectedKeys();
  if (!ids.length) return;
  const choice = await openModal({
    title: `Xóa ${ids.length} bản ghi?`,
    body: 'Các bản ghi sẽ vào mục Đã xóa và vẫn khôi phục được.',
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Xóa', value: 'delete', danger: true },
    ],
  });
  if (choice !== 'delete') return;
  for (const id of ids) {
    const result = await window.keydock.remove(id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    state.checked.delete(id);
  }
  if (ids.includes(state.selectedId)) closeInspector();
  await reload();
  showToast(`Đã xóa ${ids.length} bản ghi.`);
}

async function moveChecked() {
  const ids = selectedKeys();
  const entries = ids.map((id) => state.entries.find((entry) => entry.id === id)).filter(Boolean);
  if (!entries.length) return;
  const kind = entries[0].kind;
  if (entries.some((entry) => entry.kind !== kind || entry.corrupt)) {
    showToast('Chỉ chuyển cùng lúc các bản ghi cùng loại.');
    return;
  }
  const names = categoryNames(kind);
  const choice = await openModal({
    title: `Chuyển ${entries.length} bản ghi`,
    body: `Các bản ghi vẫn thuộc ${kindLabel(kind)}.`,
    extra(container) {
      const label = document.createElement('label');
      label.className = 'field';
      const span = document.createElement('span');
      span.textContent = 'Danh mục';
      const select = document.createElement('select');
      const none = document.createElement('option');
      none.value = '';
      none.textContent = 'Không có';
      select.append(none);
      for (const name of names) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.append(option);
      }
      const created = document.createElement('option');
      created.value = '__new__';
      created.textContent = 'Tạo danh mục mới…';
      select.append(created);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 40;
      input.placeholder = 'Tên danh mục mới';
      input.hidden = true;
      input.spellcheck = false;
      input.autocomplete = 'off';
      select.addEventListener('change', () => {
        input.hidden = select.value !== '__new__';
        if (!input.hidden) input.focus();
      });
      label.append(span, select, input);
      container.append(label);
      return () => {
        const category = select.value === '__new__' ? input.value.trim().replace(/\s+/g, ' ') : select.value;
        if (select.value === '__new__' && !category) {
          modalError.textContent = 'Hãy nhập tên danh mục.';
          input.focus();
          return null;
        }
        if (category && isTypeLabel(category)) {
          modalError.textContent = 'Tên này trùng loại có sẵn.';
          return null;
        }
        return { category };
      };
    },
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Chuyển', value: 'move', primary: true },
    ],
  });
  if (!choice || choice.category === undefined) return;
  for (const id of ids) {
    const ok = await moveEntry(id, choice.category, true);
    if (!ok) return;
    state.checked.delete(id);
  }
  await reload();
  showToast(choice.category ? `Đã chuyển ${ids.length} bản ghi tới “${choice.category}”.` : `Đã bỏ danh mục của ${ids.length} bản ghi.`);
}

async function restoreChecked() {
  const ids = selectedKeys();
  if (!ids.length) return;
  for (const id of ids) {
    const result = await window.keydock.restore(id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    state.checked.delete(id);
  }
  await reload();
  showToast(`Đã khôi phục ${ids.length} bản ghi.`);
}

async function purgeDeleted(ids) {
  if (!ids.length) return;
  const choice = await openModal({
    title: ids.length > 1 ? `Xóa vĩnh viễn ${ids.length} bản ghi?` : 'Xóa vĩnh viễn?',
    body: 'Bản ghi biến mất khỏi thùng rác và không khôi phục được.',
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Xóa vĩnh viễn', value: 'purge', danger: true },
    ],
  });
  if (choice !== 'purge') return;
  const result = await window.keydock.purge(ids);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  ids.forEach((id) => state.checked.delete(id));
  await reload();
  showToast(`Đã xóa vĩnh viễn ${result.removed} bản ghi.`);
}

function noteActivity() {
  if (!state.unlocked) return;
  const now = Date.now();
  if (now - lastActivity < 2000) return;
  lastActivity = now;
  window.keydock.activity();
}

function bind() {
  lockForm.addEventListener('submit', submitLock);
  toggleMaster.addEventListener('click', () => {
    const show = masterPassword.type === 'password';
    masterPassword.type = show ? 'text' : 'password';
    toggleMaster.textContent = show ? 'Ẩn' : 'Hiện';
  });
  themeBtn.addEventListener('click', toggleTheme);
  lockBtn.addEventListener('click', () => window.keydock.lock());
  jsonBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const willOpen = jsonMenu.hidden;
    hideContextMenu();
    jsonMenu.hidden = !willOpen;
    jsonBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  exportBtn.addEventListener('click', () => {
    hideJsonMenu();
    startExport();
  });
  importBtn.addEventListener('click', () => {
    hideJsonMenu();
    startImport();
  });
  newBtn.addEventListener('click', openCreate);
  addCategoryBtn.addEventListener('click', createCategory);
  generatorNav.addEventListener('click', showGenerator);
  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    renderTable();
  });
  categoryNav.addEventListener('contextmenu', (event) => {
    const button = event.target.closest('[data-group]');
    if (!button || !button.dataset.group) return;
    event.preventDefault();
    const kind = button.dataset.kind;
    const group = button.dataset.group;
    showContextMenu(event.clientX, event.clientY, null, null, [
      { label: 'Xóa danh mục', danger: true, run: () => deleteCategory(kind, group) },
    ]);
  });
  categoryNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-kind]');
    if (!button) return;
    state.kind = button.dataset.kind;
    state.group = button.dataset.group || '';
    state.checked.clear();
    showVaultList();
    renderTable();
  });
  entryRows.addEventListener('contextmenu', (event) => {
    const row = event.target.closest('tr');
    if (!row) return;
    event.preventDefault();
    if (row.dataset.id) showContextMenu(event.clientX, event.clientY, row.dataset.id);
    else if (row.dataset.revision) showContextMenu(event.clientX, event.clientY, null, row.dataset.revision);
  });
  entryRows.addEventListener('change', (event) => {
    const box = event.target.closest('[data-check]');
    if (!box) return;
    if (box.checked) state.checked.add(box.dataset.check);
    else state.checked.delete(box.dataset.check);
    syncBulk();
  });
  selectAll.addEventListener('change', () => {
    for (const key of visibleKeys()) {
      if (selectAll.checked) state.checked.add(key);
      else state.checked.delete(key);
    }
    renderTable();
  });
  bulkDelete.addEventListener('click', removeChecked);
  bulkMove.addEventListener('click', moveChecked);
  bulkExport.addEventListener('click', () => startExport(selectedKeys()));
  bulkRestore.addEventListener('click', restoreChecked);
  bulkPurge.addEventListener('click', () => purgeDeleted(selectedKeys()));
  entryRows.addEventListener('click', (event) => {
    if (event.target.closest('[data-check], .check-col')) return;
    const purge = event.target.closest('[data-purge]');
    if (purge) {
      purgeDeleted([purge.dataset.purge]);
      return;
    }
    const restore = event.target.closest('[data-restore]');
    if (restore) {
      restoreRevision(restore.dataset.restore);
      return;
    }
    const copyBtn = event.target.closest('[data-copy]');
    if (copyBtn) {
      copyPassword(copyBtn.dataset.copy);
      return;
    }
    const row = event.target.closest('[data-id]');
    if (row) selectEntry(row.dataset.id);
  });
  inspectorClose.addEventListener('click', closeInspector);
  historyBtn.addEventListener('click', openHistory);
  editBtn.addEventListener('click', openEdit);
  deleteBtn.addEventListener('click', removeSelected);
  viewBody.addEventListener('click', (event) => {
    const reveal = event.target.closest('[data-reveal]');
    if (reveal) {
      const id = reveal.dataset.reveal;
      if (state.revealed.has(id)) state.revealed.delete(id);
      else state.revealed.add(id);
      renderView();
      return;
    }
    const copy = event.target.closest('[data-copy-field]');
    if (copy && state.detail) copyField(copy.dataset.copyField, copy.dataset.accountId);
  });
  editorCategory.addEventListener('change', () => {
    const creating = editorCategory.value === '__new__';
    editorCategoryNew.hidden = !creating;
    if (creating) editorCategoryNew.focus();
    else editorCategoryNew.value = '';
  });
  editorKind.addEventListener('change', () => {
    captureDraft();
    fillCategoryOptions();
    renderEditorFields();
    renderEditorAccounts();
  });
  editorAccounts.addEventListener('click', async (event) => {
    const toggle = event.target.closest('[data-toggle-password]');
    if (toggle) {
      captureDraft();
      const account = state.draft.accounts[Number(toggle.dataset.togglePassword)];
      if (account) account.reveal = !account.reveal;
      renderEditorAccounts();
      return;
    }
    const generate = event.target.closest('[data-generate-account]');
    if (generate) {
      captureDraft();
      const account = state.draft.accounts[Number(generate.dataset.generateAccount)];
      if (!account) return;
      const result = await window.keydock.generatePassword(state.generator);
      if (!result.ok) {
        showToast(result.error);
        return;
      }
      account.password = result.password;
      account.reveal = true;
      renderEditorAccounts();
    }
  });
  editorForm.addEventListener('submit', saveForm);
  editorCancel.addEventListener('click', () => {
    if (state.selectedId) selectEntry(state.selectedId);
    else closeInspector();
  });
  genLength.addEventListener('input', () => {
    state.generator.length = Number(genLength.value);
    genLengthLabel.textContent = genLength.value;
  });
  [genLower, genUpper, genNumbers, genSymbols].forEach((box) => {
    box.addEventListener('change', syncGeneratorOptions);
  });
  genRefresh.addEventListener('click', () => producePassword(true));
  genCopy.addEventListener('click', async () => {
    if (!state.generated) return;
    const result = await window.keydock.copySecret(state.generated);
    showToast(result.ok ? `Đã chép mật khẩu. Clipboard sẽ được xóa sau ${result.seconds} giây.` : result.error, (result.seconds || 4) * 1000);
  });
  genHistory.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-history]');
    if (!button) return;
    const value = state.history[Number(button.dataset.history)];
    if (!value) return;
    const result = await window.keydock.copySecret(value);
    showToast(result.ok ? 'Đã chép mật khẩu trong lịch sử.' : result.error);
  });
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-dismiss]')) settleModal(null);
  });
  window.addEventListener('keydown', (event) => {
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (event.key === 'Escape' && !jsonMenu.hidden) {
      hideJsonMenu();
      return;
    }
    if (event.key === 'Escape' && !contextMenu.hidden) {
      hideContextMenu();
      return;
    }
    if (event.key === 'Escape' && !modal.hidden) {
      settleModal(null);
      return;
    }
    if (event.key === 'Escape' && state.unlocked && !inspector.hidden) {
      closeInspector();
      return;
    }
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
    if (!typing && state.unlocked && modal.hidden && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const rows = filteredEntries();
      if (!rows.length) return;
      event.preventDefault();
      const index = rows.findIndex((entry) => entry.id === state.selectedId);
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const next = Math.max(0, Math.min(rows.length - 1, index + delta));
      selectEntry(rows[next].id);
      return;
    }
    if (meta && key === 'k') {
      event.preventDefault();
      if (state.unlocked) searchInput.focus();
      return;
    }
    if (meta && key === 'n') {
      event.preventDefault();
      if (state.unlocked) openCreate();
      return;
    }
    if (meta && key === 'l' && state.unlocked) {
      event.preventDefault();
      window.keydock.lock();
    }
  });
  ['pointerdown', 'keydown', 'wheel'].forEach((type) => {
    window.addEventListener(type, noteActivity, { passive: true });
  });
  window.addEventListener('pointerdown', (event) => {
    if (!contextMenu.hidden && !event.target.closest('#context-menu')) hideContextMenu();
    if (!jsonMenu.hidden && !event.target.closest('.menu-wrap')) hideJsonMenu();
  });
  window.addEventListener('scroll', hideContextMenu, true);
  window.keydock.onLocked((payload) => {
    const message = payload.reason === 'idle'
      ? `Vault đã khóa sau ${state.idleMinutes} phút không hoạt động.`
      : '';
    showLock(message);
  });
  window.keydock.onMenu((command) => {
    if (!state.unlocked) return;
    if (command === 'new') openCreate();
    if (command === 'export') startExport();
    if (command === 'import') startImport();
  });
}

async function createCategory() {
  const draft = await openModal({
    title: 'Danh mục mới',
    body: 'Danh mục là nhóm bên trong loại đang chọn.',
    prompt: 'Tên danh mục',
    extra(container) {
      const label = document.createElement('label');
      label.className = 'field';
      const span = document.createElement('span');
      span.textContent = 'Thuộc loại';
      const select = document.createElement('select');
      for (const item of state.kinds) {
        const option = document.createElement('option');
        option.value = item.kind;
        option.textContent = item.name;
        select.append(option);
      }
      select.value = ['web', 'ssh', 'server', 'database'].includes(state.kind) ? state.kind : 'web';
      label.append(span, select);
      container.append(label);
      return () => ({ kind: select.value });
    },
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Tạo', value: 'create', primary: true },
    ],
  });
  if (!draft || !draft.name) return;
  const result = await window.keydock.addCategory(draft.kind, draft.name);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  applyCatalog(result);
  state.kind = draft.kind;
  state.group = draft.name;
  showVaultList();
  renderTable();
}

async function deleteCategory(kind, name) {
  const choice = await openModal({
    title: 'Xóa danh mục?',
    body: `Bỏ nhãn “${name}”. Bản ghi vẫn nằm trong ${kindLabel(kind)}.`,
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Xóa', value: 'delete', danger: true },
    ],
  });
  if (choice !== 'delete') return;
  const result = await window.keydock.removeCategory(kind, name);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  applyCatalog(result);
  if (state.kind === kind && state.group === name) state.group = '';
  await reload();
  showToast('Đã xóa danh mục.');
}

function syncGeneratorOptions() {
  const next = {
    length: Number(genLength.value),
    lowercase: genLower.checked,
    uppercase: genUpper.checked,
    numbers: genNumbers.checked,
    symbols: genSymbols.checked,
  };
  if (!next.lowercase && !next.uppercase && !next.numbers && !next.symbols) {
    genLower.checked = true;
    next.lowercase = true;
    showToast('Cần ít nhất một nhóm ký tự.');
  }
  state.generator = next;
  genLengthLabel.textContent = String(next.length);
}

function strengthText(password) {
  const options = state.generator;
  const pool = (options.lowercase ? 26 : 0) + (options.uppercase ? 26 : 0) + (options.numbers ? 10 : 0) + (options.symbols ? 14 : 0);
  const bits = password.length * Math.log2(pool || 2);
  if (bits < 28) return 'Rất yếu';
  if (bits < 36) return 'Yếu';
  if (bits < 60) return 'Khá';
  if (bits < 80) return 'Mạnh';
  return 'Rất mạnh';
}

function renderHistory() {
  clear(genHistory);
  if (!state.history.length) {
    const item = document.createElement('li');
    item.className = 'fine-print';
    item.textContent = 'Chưa có mật khẩu nào trong phiên này.';
    genHistory.append(item);
    return;
  }
  state.history.forEach((value, index) => {
    const item = document.createElement('li');
    const code = document.createElement('span');
    code.className = 'mono';
    code.textContent = value;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-btn';
    button.dataset.history = String(index);
    button.textContent = 'Chép';
    item.append(code, button);
    genHistory.append(item);
  });
}

async function producePassword(remember) {
  syncGeneratorOptions();
  const result = await window.keydock.generatePassword(state.generator);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  state.generated = result.password;
  genPassword.textContent = result.password;
  genStrength.textContent = strengthText(result.password);
  if (remember) {
    state.history.unshift(result.password);
    state.history = state.history.slice(0, 8);
  }
  renderHistory();
}

function showGenerator() {
  state.screen = 'generator';
  closeInspector();
  vaultView.hidden = true;
  generator.hidden = false;
  renderCategories();
  if (!state.generated) producePassword(false);
  else {
    genPassword.textContent = state.generated;
    genStrength.textContent = strengthText(state.generated);
    renderHistory();
  }
}

async function boot() {
  syncThemeButton();
  if (!window.keydock) {
    lockError.textContent = 'KeyDock cần chạy trong Electron.';
    return;
  }
  shortcutLabel.textContent = `${modifierLabel()}K tìm  ·  ${modifierLabel()}N thêm  ·  ${modifierLabel()}L đăng xuất`;
  const status = await window.keydock.status();
  if (!status.ok) {
    lockError.textContent = status.error;
    return;
  }
  state.initialized = status.initialized;
  applyCatalog(status.catalog);
  state.idleMinutes = status.idleMinutes;
  state.clipboardSeconds = status.clipboardSeconds;
  idleLabel.textContent = `Tự khóa sau ${status.idleMinutes} phút không hoạt động`;
  fillCategoryOptions();
  bind();
  if (status.unlocked) {
    const restored = await reload();
    if (restored) await showShell();
    return;
  }
  showLock('');
}

boot();
