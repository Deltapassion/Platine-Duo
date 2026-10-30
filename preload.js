// pont minimal et contrôlé entre la page et l'application (bac à sable activé)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('pdNative', {
  version: '2.1.0',
  onBtDevices: cb => { ipcRenderer.removeAllListeners('bt-devices'); ipcRenderer.on('bt-devices', (e, list) => cb(list)); },
  btSelect: id => ipcRenderer.send('bt-select', String(id || '')),
  fetchJson: url => ipcRenderer.invoke('net-json', String(url)),
  fetchBytes: async url => { const u = await ipcRenderer.invoke('net-bytes', String(url)); return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength); },
  // dossiers de la soirée par styles (fenêtre de choix du système)
  dirPick: () => ipcRenderer.invoke('dir-pick'),
  dirList: id => ipcRenderer.invoke('dir-list', String(id)),
  dirRead: async (id, rel, start, end) => { const u = await ipcRenderer.invoke('dir-read', String(id), String(rel), +start || 0, end == null ? null : +end); return u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength); },
  dirForget: id => ipcRenderer.invoke('dir-forget', String(id))
});
