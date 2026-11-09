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
const resetBtn = $('reset-btn');
const shell = $('shell');
const categoryNav = $('category-nav');
const exportBtn = $('export-btn');
const importBtn = $('import-btn');
const themeBtn = $('theme-btn');
const lockBtn = $('lock-btn');
const searchInput = $('search-input');
const newBtn = $('new-btn');
const entryRows = $('entry-rows');
const emptyState = $('empty-state');
const emptyCopy = $('empty-copy');
const resultCount = $('result-count');
const idleLabel = $('idle-label');
const shortcutLabel = $('shortcut-label');
const inspector = $('inspector');
const inspectorKicker = $('inspector-kicker');
const inspectorClose = $('inspector-close');
const inspectorView = $('inspector-view');
const viewTitle = $('view-title');
const viewCorrupt = $('view-corrupt');
const viewUsername = $('view-username');
const copyUsernameBtn = $('copy-username-btn');
const viewHost = $('view-host');
const viewPassword = $('view-password');
const revealBtn = $('reveal-btn');
const viewNote = $('view-note');
const viewUpdated = $('view-updated');
const copyPasswordBtn = $('copy-password-btn');
const editBtn = $('edit-btn');
const deleteBtn = $('delete-btn');
const editorForm = $('editor-form');
const editorTitle = $('editor-title');
const editorUsername = $('editor-username');
const editorPassword = $('editor-password');
const toggleEditorPassword = $('toggle-editor-password');
const generateBtn = $('generate-btn');
const editorHost = $('editor-host');
const editorCategory = $('editor-category');
const editorNote = $('editor-note');
const editorCancel = $('editor-cancel');
const editorSave = $('editor-save');
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
  categories: [],
  entries: [],
  category: 'All',
  query: '',
  selectedId: null,
  detail: null,
  mode: null,
  passwordVisible: false,
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

function syncThemeButton() {
  const light = document.documentElement.dataset.theme === 'light';
  themeBtn.textContent = light ? 'Giao diện tối' : 'Giao diện sáng';
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
    if (state.category !== 'All' && entry.category !== state.category) return false;
    if (!query) return true;
    const haystack = fold([entry.title, entry.username, entry.host, entry.category, entry.note].join('\n'));
    return haystack.includes(query);
  });
}

function renderCategories() {
  const counts = new Map();
  for (const entry of state.entries) {
    counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  }
  const items = [['All', 'Tất cả', state.entries.length]];
  const known = new Set(state.categories);
  for (const category of state.categories) {
    items.push([category, category, counts.get(category) || 0]);
  }
  for (const [category, count] of counts) {
    if (!known.has(category)) items.push([category, category, count]);
  }

  clear(categoryNav);
  for (const [id, label, count] of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item';
    button.dataset.category = id;
    button.setAttribute('aria-current', state.category === id ? 'true' : 'false');
    const name = document.createElement('span');
    name.textContent = label;
    const badge = document.createElement('span');
    badge.className = 'nav-count';
    badge.textContent = String(count);
    button.append(name, badge);
    categoryNav.append(button);
  }
}

function renderTable() {
  const rows = filteredEntries();
  clear(entryRows);
  for (const entry of rows) {
    const tr = document.createElement('tr');
    tr.dataset.id = entry.id;
    tr.setAttribute('aria-selected', state.selectedId === entry.id ? 'true' : 'false');
    for (const value of [entry.title, entry.username || '—', entry.host || '—', entry.category, formatTime(entry.updatedAt)]) {
      const td = document.createElement('td');
      td.textContent = value;
      if (value === entry.host) td.className = 'mono';
      tr.append(td);
    }
    const action = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-small';
    button.dataset.copy = entry.id;
    button.textContent = copiedId === entry.id ? 'Đã chép' : 'Chép mật khẩu';
    button.disabled = entry.corrupt || !entry.hasPassword;
    action.append(button);
    tr.append(action);
    entryRows.append(tr);
  }

  emptyState.hidden = rows.length !== 0;
  if (!rows.length) {
    if (state.query.trim()) emptyCopy.textContent = 'Không có bản ghi khớp với tìm kiếm.';
    else if (state.category !== 'All') emptyCopy.textContent = 'Danh mục này chưa có bản ghi.';
    else emptyCopy.textContent = 'Vault đang trống. Thêm bản ghi đầu tiên.';
  }
  const total = state.entries.length;
  resultCount.textContent = rows.length === total
    ? `${total} bản ghi`
    : `${rows.length} / ${total} bản ghi`;
}

function fillCategorySelect(selected) {
  clear(editorCategory);
  const categories = [...state.categories];
  if (selected && !categories.includes(selected)) categories.push(selected);
  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    editorCategory.append(option);
  }
  editorCategory.value = selected && categories.includes(selected) ? selected : (categories[0] || 'Other');
}

function setInspectorOpen(open) {
  inspector.hidden = !open;
  shell.classList.toggle('shell--inspect', open);
}

function closeInspector() {
  state.selectedId = null;
  state.detail = null;
  state.mode = null;
  state.passwordVisible = false;
  editorForm.reset();
  editorPassword.type = 'password';
  toggleEditorPassword.textContent = 'Hiện';
  viewPassword.textContent = '';
  setInspectorOpen(false);
  renderTable();
}

function renderInspector() {
  const detail = state.detail;
  if (!detail || state.mode !== 'view') return;
  inspectorView.hidden = false;
  editorForm.hidden = true;
  setInspectorOpen(true);
  inspectorKicker.textContent = detail.corrupt ? 'Lỗi' : detail.category;
  viewTitle.textContent = detail.title;
  viewCorrupt.hidden = !detail.corrupt;
  viewUsername.textContent = detail.username || '—';
  copyUsernameBtn.hidden = !detail.username;
  viewHost.textContent = detail.host || '—';
  viewNote.textContent = detail.note || '—';
  viewUpdated.textContent = detail.updatedAt ? `Cập nhật ${formatTime(detail.updatedAt)}` : '';
  state.passwordVisible = false;
  viewPassword.textContent = detail.hasPassword ? '••••••••' : 'Không có';
  revealBtn.hidden = detail.corrupt || !detail.hasPassword;
  revealBtn.textContent = 'Hiện';
  copyPasswordBtn.hidden = detail.corrupt || !detail.hasPassword;
  editBtn.hidden = detail.corrupt;
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

function openCreate() {
  state.selectedId = null;
  state.detail = null;
  state.mode = 'create';
  selectSeq += 1;
  editorForm.reset();
  fillCategorySelect(state.category !== 'All' ? state.category : state.categories[0]);
  editorPassword.type = 'password';
  toggleEditorPassword.textContent = 'Hiện';
  inspectorView.hidden = true;
  editorForm.hidden = false;
  inspectorKicker.textContent = 'Bản ghi mới';
  editorSave.textContent = 'Thêm';
  setInspectorOpen(true);
  renderTable();
  editorTitle.focus();
}

async function openEdit() {
  if (!state.detail || state.detail.corrupt) return;
  state.mode = 'edit';
  fillCategorySelect(state.detail.category);
  editorTitle.value = state.detail.title;
  editorUsername.value = state.detail.username;
  editorPassword.value = state.detail.password;
  editorHost.value = state.detail.host;
  editorNote.value = state.detail.note;
  editorPassword.type = 'password';
  toggleEditorPassword.textContent = 'Hiện';
  inspectorView.hidden = true;
  editorForm.hidden = false;
  inspectorKicker.textContent = 'Sửa bản ghi';
  editorSave.textContent = 'Lưu';
  editorTitle.focus();
}

function showLock(message) {
  if (!modal.hidden) settleModal(null);
  state.unlocked = false;
  state.entries = [];
  state.detail = null;
  state.selectedId = null;
  state.mode = null;
  shell.hidden = true;
  setInspectorOpen(false);
  lockScreen.hidden = false;
  const firstRun = !state.initialized;
  confirmWrap.hidden = !firstRun;
  resetBtn.hidden = firstRun;
  unlockBtn.textContent = firstRun ? 'Tạo vault' : 'Mở khóa';
  lockHeading.textContent = firstRun ? 'Tạo vault mới' : 'Mở vault';
  lockCopy.textContent = firstRun
    ? 'Chọn mật khẩu chính. KeyDock dùng nó để tạo khóa mã hóa và không lưu mật khẩu này.'
    : 'Nhập mật khẩu chính để giải mã các bản ghi trên máy này.';
  lockError.textContent = message || '';
  masterPassword.value = '';
  confirmPassword.value = '';
  masterPassword.type = 'password';
  toggleMaster.textContent = 'Hiện';
  unlockBtn.disabled = false;
  masterPassword.focus();
}

function showShell() {
  state.unlocked = true;
  lockScreen.hidden = true;
  shell.hidden = false;
  renderCategories();
  renderTable();
  searchInput.focus();
}

async function reload() {
  const result = await window.keydock.list();
  if (!result.ok) {
    if (result.code === 'LOCKED') showLock('Vault đã khóa.');
    else showToast(result.error);
    return false;
  }
  state.entries = result.entries;
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
  showShell();
}

async function copyPassword(id) {
  const result = await window.keydock.copyPassword(id);
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

async function saveForm(event) {
  event.preventDefault();
  const payload = {
    title: editorTitle.value,
    username: editorUsername.value,
    password: editorPassword.value,
    host: editorHost.value,
    category: editorCategory.value,
    note: editorNote.value,
  };
  const editing = state.mode === 'edit';
  const result = editing
    ? await window.keydock.update({ id: state.selectedId, ...payload })
    : await window.keydock.create(payload);
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  editorPassword.value = '';
  await reload();
  await selectEntry(result.id);
  showToast(editing ? 'Đã cập nhật bản ghi.' : 'Đã thêm bản ghi.');
}

function settleModal(value) {
  modal.hidden = true;
  clear(modalExtra);
  clear(modalActions);
  modalError.textContent = '';
  const resolve = modalResolver;
  modalResolver = null;
  if (resolve) resolve(value);
}

function openModal({ title, body, actions, expected }) {
  if (modalResolver) settleModal(null);
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalError.textContent = '';
  clear(modalExtra);
  clear(modalActions);
  let input = null;
  if (expected) {
    input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = expected;
    input.setAttribute('aria-label', 'Xác nhận');
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

async function startExport() {
  const choice = await openModal({
    title: 'Xuất JSON không mã hóa?',
    body: 'File sao lưu chứa mật khẩu dạng plaintext. Ai có file này đều đọc được. Chỉ lưu ở nơi an toàn.',
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Xuất file', value: 'export', primary: true },
    ],
  });
  if (!choice) return;
  const result = await window.keydock.exportJson();
  if (!result.ok) {
    showToast(result.error);
    return;
  }
  if (result.canceled) return;
  const extra = result.skippedCorrupt ? `\nBỏ qua ${result.skippedCorrupt} bản ghi không giải mã được.` : '';
  showToast(`Đã xuất ${result.count} bản ghi.\n${result.filePath}${extra}`, 7000);
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
  const lines = [`${preview.newCount} bản ghi mới.`];
  if (preview.duplicateCount) lines.push(`${preview.duplicateCount} bản ghi trùng tên.`);
  if (preview.invalidCount) lines.push(`${preview.invalidCount} dòng bị bỏ qua vì thiếu tiêu đề hoặc không hợp lệ.`);
  if (preview.duplicateTitles && preview.duplicateTitles.length) {
    const extra = preview.duplicateTitleExtra ? '…' : '';
    lines.push(`Trùng: ${preview.duplicateTitles.join(', ')}${extra}`);
  }
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

async function resetVault() {
  const choice = await openModal({
    title: 'Xóa vault cục bộ?',
    body: 'Toàn bộ bản ghi trên máy này sẽ bị xóa và không thể khôi phục. Gõ XOA VAULT để xác nhận.',
    expected: 'XOA VAULT',
    actions: [
      { label: 'Hủy', value: null },
      { label: 'Xóa vault', value: 'reset', danger: true },
    ],
  });
  if (choice !== 'reset') return;
  const result = await window.keydock.reset('XOA VAULT');
  if (!result.ok) {
    showLock(result.error);
    return;
  }
  state.initialized = false;
  showLock('Đã xóa vault. Hãy tạo mật khẩu chính mới.');
}

async function removeSelected() {
  if (!state.selectedId) return;
  const title = state.detail ? state.detail.title : 'bản ghi này';
  const choice = await openModal({
    title: 'Xóa bản ghi?',
    body: `“${title}” sẽ bị xóa khỏi vault trên máy này.`,
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
  showToast('Đã xóa bản ghi.');
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
  resetBtn.addEventListener('click', resetVault);
  themeBtn.addEventListener('click', toggleTheme);
  lockBtn.addEventListener('click', () => window.keydock.lock());
  exportBtn.addEventListener('click', startExport);
  importBtn.addEventListener('click', startImport);
  newBtn.addEventListener('click', openCreate);
  searchInput.addEventListener('input', () => {
    state.query = searchInput.value;
    renderTable();
  });
  categoryNav.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    state.category = button.dataset.category;
    renderCategories();
    renderTable();
  });
  entryRows.addEventListener('click', (event) => {
    const copyBtn = event.target.closest('[data-copy]');
    if (copyBtn) {
      copyPassword(copyBtn.dataset.copy);
      return;
    }
    const row = event.target.closest('[data-id]');
    if (row) selectEntry(row.dataset.id);
  });
  inspectorClose.addEventListener('click', closeInspector);
  editBtn.addEventListener('click', openEdit);
  deleteBtn.addEventListener('click', removeSelected);
  copyPasswordBtn.addEventListener('click', () => {
    if (state.selectedId) copyPassword(state.selectedId);
  });
  copyUsernameBtn.addEventListener('click', async () => {
    if (!state.detail || !state.detail.username) return;
    const result = await window.keydock.copyText(state.detail.username);
    showToast(result.ok ? 'Đã chép tài khoản.' : result.error);
  });
  revealBtn.addEventListener('click', () => {
    if (!state.detail) return;
    state.passwordVisible = !state.passwordVisible;
    viewPassword.textContent = state.passwordVisible ? state.detail.password : '••••••••';
    revealBtn.textContent = state.passwordVisible ? 'Ẩn' : 'Hiện';
  });
  editorForm.addEventListener('submit', saveForm);
  editorCancel.addEventListener('click', () => {
    if (state.selectedId) selectEntry(state.selectedId);
    else closeInspector();
  });
  toggleEditorPassword.addEventListener('click', () => {
    const show = editorPassword.type === 'password';
    editorPassword.type = show ? 'text' : 'password';
    toggleEditorPassword.textContent = show ? 'Ẩn' : 'Hiện';
  });
  generateBtn.addEventListener('click', async () => {
    const result = await window.keydock.generatePassword();
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    editorPassword.value = result.password;
    editorPassword.type = 'text';
    toggleEditorPassword.textContent = 'Ẩn';
    editorPassword.focus();
  });
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-dismiss]')) settleModal(null);
  });
  window.addEventListener('keydown', (event) => {
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
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

async function boot() {
  syncThemeButton();
  if (!window.keydock) {
    lockError.textContent = 'KeyDock cần chạy trong Electron.';
    return;
  }
  shortcutLabel.textContent = `${modifierLabel()}K tìm  ·  ${modifierLabel()}N thêm  ·  ${modifierLabel()}L khóa`;
  const status = await window.keydock.status();
  if (!status.ok) {
    lockError.textContent = status.error;
    return;
  }
  state.initialized = status.initialized;
  state.categories = status.categories;
  state.idleMinutes = status.idleMinutes;
  state.clipboardSeconds = status.clipboardSeconds;
  idleLabel.textContent = `Tự khóa sau ${status.idleMinutes} phút không hoạt động`;
  fillCategorySelect(state.categories[0]);
  bind();
  showLock('');
}

boot();
