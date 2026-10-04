'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const bundledFfmpeg = require('ffmpeg-static');

function canRun(executable, env) {
  if (!executable) return false;
  const result = spawnSync(executable, ['-version'], {
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true,
    env
  });
  return !result.error && result.status === 0;
}

function getFfmpegPath(env, packaged = false) {
  let executable = bundledFfmpeg;
  if (packaged && executable) {
    executable = executable.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
  }
  if (canRun(executable, env)) return executable;

  if (canRun('ffmpeg', env)) return null;

  throw new Error('FFmpeg is missing or damaged. From the project folder, run "npm run repair:ffmpeg", then restart YtDesk.');
}

module.exports = { getFfmpegPath };
