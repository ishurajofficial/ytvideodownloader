'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { inspect } = require('./src/main/services/video-service');
const { normalizeYouTubeUrl } = require('./src/main/services/validator');
const { SettingsStore } = require('./src/main/services/settings-store');
const { HistoryStore } = require('./src/main/services/history-store');
const { DownloadManager } = require('./src/main/services/download-manager');
const { createLogger } = require('./src/main/services/logger');

let mainWindow;
const analyses = new Map();
const log = createLogger(app);
const settingsStore = new SettingsStore(app);
const historyStore = new HistoryStore(app);
const send = (channel, payload) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload); };
const downloads = new DownloadManager(() => settingsStore.read(), (channel, payload) => {
  if (channel === 'download:complete') historyStore.add(payload).then(() => send(channel, payload)).catch(error => { log.error('Could not save download history', error); send(channel, payload); });
  else { if (channel === 'download:failed') log.error(payload.message); send(channel, payload); }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 820, minWidth: 880, minHeight: 680, show: false,
    title: 'YtDesk', titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#101318',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true }
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (target !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.on('closed', () => { downloads.cancelAll(); mainWindow = null; });
}

ipcMain.handle('video:analyze', async (_event, value) => {
  const normalized = normalizeYouTubeUrl(value).url;
  try {
    const info = await inspect(normalized);
    analyses.set(info.url, info);
    if (analyses.size > 30) analyses.delete(analyses.keys().next().value);
    return info;
  } catch (error) {
    const message = String(error.stderr || error.message || 'Unable to analyze this video.');
    if (/private video|members-only|sign in|login required|age-restricted/i.test(message)) throw new Error('This video is not publicly available. Private or access-controlled content is not supported.');
    if (/ffmpeg|python/i.test(message)) throw new Error('The media helper could not start. Reinstall the app dependencies and try again.');
    throw new Error(message.replace(/^.*ERROR:\s*/m, '').slice(0, 500));
  }
});

ipcMain.handle('settings:read', () => settingsStore.read());
ipcMain.handle('settings:write', (_event, value) => settingsStore.write(value));
ipcMain.handle('settings:choose-folder', async () => {
  const current = await settingsStore.read();
  const result = await dialog.showOpenDialog(mainWindow, { defaultPath: current.downloadDir, properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths[0]) return null;
  return settingsStore.write({ ...current, downloadDir: result.filePaths[0] });
});
ipcMain.handle('history:list', () => historyStore.list());
ipcMain.handle('history:clear', () => historyStore.clear());
ipcMain.handle('download:start', async (_event, request) => {
  const normalized = normalizeYouTubeUrl(request.url).url;
  const video = analyses.get(normalized);
  if (!video) throw new Error('Analyze this link again before downloading.');
  return downloads.start({ ...request, url: normalized, video });
});
ipcMain.handle('download:cancel', (_event, jobId) => downloads.cancel(String(jobId)));
ipcMain.handle('file:open', async (_event, filepath) => {
  const settings = await settingsStore.read();
  const resolved = path.resolve(String(filepath || ''));
  if (!resolved.startsWith(`${path.resolve(settings.downloadDir)}${path.sep}`)) throw new Error('This file is outside the selected download folder.');
  const error = await shell.openPath(resolved);
  if (error) throw new Error(error);
});
ipcMain.handle('file:reveal', async (_event, filepath) => {
  const settings = await settingsStore.read();
  const resolved = path.resolve(String(filepath || ''));
  if (!resolved.startsWith(`${path.resolve(settings.downloadDir)}${path.sep}`)) throw new Error('This file is outside the selected download folder.');
  if (!(await fs.pathExists(resolved))) throw new Error('That file is no longer available.');
  shell.showItemInFolder(resolved);
});
ipcMain.handle('folder:open', async () => {
  const settings = await settingsStore.read();
  await fs.ensureDir(settings.downloadDir);
  const error = await shell.openPath(settings.downloadDir);
  if (error) throw new Error(error);
});
ipcMain.handle('app:version', () => app.getVersion());

app.whenReady().then(async () => { await settingsStore.read(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
app.on('before-quit', () => downloads.cancelAll());
process.on('unhandledRejection', error => log.error('Unhandled promise rejection', error));
process.on('uncaughtException', error => log.error('Uncaught exception', error));
