'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ytdesk', {
  analyze: url => ipcRenderer.invoke('video:analyze', url),
  getSettings: () => ipcRenderer.invoke('settings:read'),
  saveSettings: settings => ipcRenderer.invoke('settings:write', settings),
  chooseFolder: () => ipcRenderer.invoke('settings:choose-folder'),
  getHistory: () => ipcRenderer.invoke('history:list'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  startDownload: request => ipcRenderer.invoke('download:start', request),
  cancelDownload: jobId => ipcRenderer.invoke('download:cancel', jobId),
  openFile: filepath => ipcRenderer.invoke('file:open', filepath),
  revealFile: filepath => ipcRenderer.invoke('file:reveal', filepath),
  openFolder: () => ipcRenderer.invoke('folder:open'),
  version: () => ipcRenderer.invoke('app:version'),
  onProgress: callback => ipcRenderer.on('download:progress', (_event, value) => callback(value)),
  onComplete: callback => ipcRenderer.on('download:complete', (_event, value) => callback(value)),
  onFailed: callback => ipcRenderer.on('download:failed', (_event, value) => callback(value)),
  onCancelled: callback => ipcRenderer.on('download:cancelled', (_event, value) => callback(value))
});
