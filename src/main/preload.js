const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('keydock', {
  platform: process.platform,
  status: () => ipcRenderer.invoke('vault:status'),
  setup: (password) => ipcRenderer.invoke('vault:setup', password),
  unlock: (password) => ipcRenderer.invoke('vault:unlock', password),
  lock: () => ipcRenderer.invoke('vault:lock'),
  reset: (confirmation) => ipcRenderer.invoke('vault:reset', confirmation),
  list: () => ipcRenderer.invoke('entries:list'),
  get: (id) => ipcRenderer.invoke('entries:get', id),
  create: (entry) => ipcRenderer.invoke('entries:create', entry),
  update: (entry) => ipcRenderer.invoke('entries:update', entry),
  remove: (id) => ipcRenderer.invoke('entries:remove', id),
  copyPassword: (id, accountId) => ipcRenderer.invoke('entries:copy-password', { id, accountId }),
  history: (id) => ipcRenderer.invoke('entries:history', id),
  revision: (id) => ipcRenderer.invoke('entries:revision', id),
  restore: (id) => ipcRenderer.invoke('entries:restore', id),
  deleted: () => ipcRenderer.invoke('entries:deleted'),
  purge: (ids) => ipcRenderer.invoke('entries:purge', ids),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  copySecret: (text) => ipcRenderer.invoke('clipboard:secret', text),
  generatePassword: (options) => ipcRenderer.invoke('password:generate', options || {}),
  categories: () => ipcRenderer.invoke('categories:list'),
  addCategory: (kind, name) => ipcRenderer.invoke('categories:add', { kind, name }),
  removeCategory: (kind, name) => ipcRenderer.invoke('categories:remove', { kind, name }),
  exportJson: (ids) => ipcRenderer.invoke('vault:export', ids),
  pickImport: () => ipcRenderer.invoke('vault:import-pick'),
  applyImport: (policy) => ipcRenderer.invoke('vault:import-apply', policy),
  cancelImport: () => ipcRenderer.invoke('vault:import-cancel'),
  activity: () => ipcRenderer.send('vault:activity'),
  onLocked: (callback) => {
    ipcRenderer.on('vault:locked', (_event, payload) => callback(payload || {}));
  },
  onMenu: (callback) => {
    ipcRenderer.on('menu:command', (_event, command) => callback(command));
  },
});
