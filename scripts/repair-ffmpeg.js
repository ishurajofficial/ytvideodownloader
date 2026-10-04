'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ffmpegPath = require('ffmpeg-static');
const packageDirectory = path.dirname(require.resolve('ffmpeg-static'));

function canRun(executable) {
  if (!executable) return false;
  const result = spawnSync(executable, ['-version'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
    env: process.env
  });
  return !result.error && result.status === 0;
}

function repair() {
  if (canRun(ffmpegPath)) {
    console.log('Bundled FFmpeg is ready.');
    return;
  }

  if (canRun('ffmpeg')) {
    console.warn('Bundled FFmpeg is unavailable; YtDesk can use the FFmpeg on PATH.');
    return;
  }

  if (!ffmpegPath) throw new Error('No FFmpeg binary is available for this platform.');

  if (fs.existsSync(ffmpegPath)) {
    console.warn('Removing an incomplete or non-runnable bundled FFmpeg binary.');
    fs.unlinkSync(ffmpegPath);
  }

  const installer = path.join(packageDirectory, 'install.js');
  const result = spawnSync(process.execPath, [installer], {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg setup exited with code ${result.status}.`);
  if (!canRun(ffmpegPath)) throw new Error('The downloaded FFmpeg binary could not be started. Check your network and platform support, then run npm run repair:ffmpeg again.');

  console.log('Bundled FFmpeg repaired successfully.');
}

try {
  repair();
} catch (error) {
  console.error(`FFmpeg setup failed: ${error.message}`);
  process.exitCode = 1;
}
