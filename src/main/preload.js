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
  copyPassword: (id) => ipcRenderer.invoke('entries:copy-password', id),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  generatePassword: () => ipcRenderer.invoke('password:generate'),
  exportJson: () => ipcRenderer.invoke('vault:export'),
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
