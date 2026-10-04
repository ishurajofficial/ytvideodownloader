'use strict';

const fs = require('fs-extra');
const path = require('path');

class HistoryStore {
  constructor(app) { this.file = path.join(app.getPath('userData'), 'history.json'); }
  async list() { const rows = await fs.readJson(this.file).catch(() => []); return Array.isArray(rows) ? rows.slice(0, 200) : []; }
  async add(entry) {
    const rows = await this.list();
    rows.unshift({ ...entry, date: new Date().toISOString() });
    await fs.ensureDir(path.dirname(this.file));
    await fs.writeJson(this.file, rows.slice(0, 200), { spaces: 2 });
  }
  async clear() { await fs.ensureDir(path.dirname(this.file)); await fs.writeJson(this.file, []); }
}

module.exports = { HistoryStore };
