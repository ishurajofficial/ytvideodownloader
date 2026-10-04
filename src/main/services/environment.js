'use strict';

const fs = require('fs');

function ytDlpEnvironment() {
  const env = { ...process.env };
  const runtimePaths = process.platform === 'darwin'
    ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
    : process.platform === 'win32'
      ? []
      : ['/usr/local/bin', '/usr/bin', '/bin'];
  env.PATH = [...new Set([...runtimePaths, ...(env.PATH || '').split(require('path').delimiter).filter(Boolean)])].join(require('path').delimiter);
  if (!env.SSL_CERT_FILE && !env.SSL_CERT_DIR) {
    const candidates = process.platform === 'darwin'
      ? ['/etc/ssl/cert.pem']
      : process.platform === 'win32'
        ? []
        : ['/etc/ssl/certs/ca-certificates.crt', '/etc/pki/tls/certs/ca-bundle.crt'];
    const caFile = candidates.find(file => fs.existsSync(file));
    if (caFile) env.SSL_CERT_FILE = caFile;
  }
  return env;
}

module.exports = { ytDlpEnvironment };
