'use strict';

const fs = require('fs-extra');
const path = require('path');

function createLogger(app) {
  const file = path.join(app.getPath('userData'), 'ytdesk.log');
  return {
    async write(level, message, error) {
      const detail = error && (error.stack || error.message || String(error));
      const row = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${detail ? `\n${detail}` : ''}\n`;
      try {
        await fs.ensureDir(path.dirname(file));
        const stat = await fs.stat(file).catch(() => null);
        if (stat && stat.size > 1_000_000) await fs.move(file, `${file}.1`, { overwrite: true });
        await fs.appendFile(file, row, 'utf8');
      } catch { /* Logging must never interrupt the application. */ }
    },
    error(message, error) { return this.write('error', message, error); },
    info(message) { return this.write('info', message); }
  };
}

module.exports = { createLogger };
