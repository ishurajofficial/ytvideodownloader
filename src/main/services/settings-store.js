'use strict';

const fs = require('fs-extra');
const path = require('path');

class SettingsStore {
  constructor(app) {
    this.file = path.join(app.getPath('userData'), 'settings.json');
    this.defaults = { downloadDir: path.join(app.getPath('downloads'), 'YtDesk'), embedMetadata: true };
  }
  async read() {
    const saved = await fs.readJson(this.file).catch(() => ({}));
    const settings = { ...this.defaults, ...saved };
    await fs.ensureDir(settings.downloadDir);
    return settings;
  }
  async write(value) {
    const settings = { ...this.defaults, downloadDir: String(value.downloadDir || '').trim(), embedMetadata: value.embedMetadata !== false };
    if (!settings.downloadDir) throw new Error('Choose a download folder first.');
    await fs.ensureDir(settings.downloadDir);
    await fs.writeJson(this.file, settings, { spaces: 2 });
    return settings;
  }
}

module.exports = { SettingsStore };
