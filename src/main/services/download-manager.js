'use strict';

const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { constants } = require('youtube-dl-exec');
const ffmpegPath = require('ffmpeg-static');
const { normalizeYouTubeUrl } = require('./validator');
const { ytDlpEnvironment } = require('./environment');

function safeTitle(value) {
  let name = String(value || 'YouTube video').normalize('NFC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 150);
  if (!name || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(name)) name = `Video ${name}`;
  return name;
}

function parseSize(value) {
  const match = String(value || '').match(/([\d.]+)\s*(bytes|B|KB|KiB|MB|MiB|GB|GiB)/i);
  if (!match) return null;
  const units = { bytes: 1, b: 1, kb: 1000, kib: 1024, mb: 1000000, mib: 1048576, gb: 1000000000, gib: 1073741824 };
  return Math.round(Number(match[1]) * (units[match[2].toLowerCase()] || 1));
}

class DownloadManager {
  constructor(getSettings, emit) { this.getSettings = getSettings; this.emit = emit; this.jobs = new Map(); }

  executable() {
    const filename = process.platform === 'win32' ? 'yt-dlp.exe' : constants.YOUTUBE_DL_FILE;
    let executable = path.join(path.dirname(require.resolve('youtube-dl-exec/package.json')), 'bin', filename);
    if (process.versions.electron) {
      const { app } = require('electron');
      if (app.isPackaged) executable = executable.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    }
    return executable;
  }

  async start({ url, video, choiceId }) {
    const normalized = normalizeYouTubeUrl(url).url;
    if (!video || video.url !== normalized) throw new Error('Analyze this video again before downloading.');
    const choice = video.choices.find(item => item.id === choiceId);
    if (!choice) throw new Error('That format is no longer available. Analyze the link again.');
    const settings = await this.getSettings();
    const folder = settings.downloadDir;
    await fs.ensureDir(folder);
    const token = crypto.randomBytes(4).toString('hex');
    const template = path.join(folder, `${safeTitle(video.title)} [${video.id}] ${token}.%(ext)s`);
    const args = ['--no-warnings', '--no-playlist', '--newline', '--progress', '--progress-template', 'download:__YTDESK_PROGRESS__%(progress._percent_str)s|%(progress.downloaded_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s', '--no-overwrites', '--windows-filenames', '--output', template, '--print', 'after_move:__YTDESK_FILE__%(filepath)s'];
    if (settings.embedMetadata) args.push('--embed-metadata');
    if (choice.kind === 'audio') args.push('--format', 'bestaudio/best', '--extract-audio', '--audio-format', 'mp3', '--audio-quality', `${choice.bitrate}K`);
    else args.push('--format', choice.formatId, '--merge-output-format', 'mp4');
    args.push('--', normalized);

    const jobId = crypto.randomUUID();
    const env = ytDlpEnvironment();
    let resolvedFfmpeg = ffmpegPath;
    if (resolvedFfmpeg && process.versions.electron) {
      const { app } = require('electron');
      if (app.isPackaged) resolvedFfmpeg = resolvedFfmpeg.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
    }
    if (resolvedFfmpeg) {
      env.PATH = `${path.dirname(resolvedFfmpeg)}${path.delimiter}${env.PATH || ''}`;
      args.splice(args.indexOf('--no-warnings'), 0, '--ffmpeg-location', path.dirname(resolvedFfmpeg));
    }
    const child = spawn(this.executable(), args, { windowsHide: true, env });
    const job = { child, jobId, video, choice, folder, token, stdout: '', stderr: '', cancelled: false };
    this.jobs.set(jobId, job);
    const readLines = (target, chunk) => {
      const carryKey = `${target}Carry`;
      job[carryKey] = (job[carryKey] || '') + chunk;
      const lines = job[carryKey].split(/\r\n|\n|\r/);
      job[carryKey] = lines.pop() || '';
      for (const line of lines) this.progress(job, line);
    };
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => {
      job.stderr = (job.stderr + chunk).slice(-16000);
      readLines('stderr', chunk);
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { job.stdout = (job.stdout + chunk).slice(-8000); readLines('stdout', chunk); });
    child.once('error', error => this.finish(job, error));
    child.once('close', code => {
      if (code !== 0) return this.finish(job, job.cancelled ? null : new Error(this.friendlyError(job.stderr, code)));
      this.finish(job, null);
    });
    this.emit('download:started', { jobId, title: video.title });
    return { jobId };
  }

  progress(job, line) {
    if (/merging|post-process|extractaudio|converting/i.test(line)) {
      this.emit('download:progress', { jobId: job.jobId, status: 'Processing media…', percent: 99 });
      return;
    }
    if (line.startsWith('__YTDESK_PROGRESS__')) {
      const [percentText, downloadedText, totalText, speedText, etaText] = line.slice('__YTDESK_PROGRESS__'.length).trim().split('|');
      const percent = Number(String(percentText).replace('%', '').trim());
      if (!Number.isFinite(percent)) return;
      const downloaded = Number(downloadedText), total = Number(totalText), speed = Number(speedText), eta = Number(etaText);
      this.emit('download:progress', { jobId: job.jobId, status: 'Downloading…', percent: Math.min(99, percent), downloaded: Number.isFinite(downloaded) ? downloaded : null, total: Number.isFinite(total) ? total : null, speed: Number.isFinite(speed) ? speed : null, eta: Number.isFinite(eta) ? `${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}` : null });
      return;
    }
    const match = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+([^ ]+)(?:\s+at\s+([^ ]+))?(?:\s+ETA\s+([^ ]+))?/i);
    if (!match) return;
    const total = parseSize(match[2]);
    const speed = parseSize(match[3]);
    const percent = Math.min(99, Number(match[1]));
    this.emit('download:progress', { jobId: job.jobId, status: 'Downloading…', percent, downloaded: total ? Math.round(total * percent / 100) : null, total, speed, eta: match[4] || null });
  }

  async finish(job, error) {
    if (!this.jobs.has(job.jobId)) return;
    this.jobs.delete(job.jobId);
    if (job.cancelled) {
      const partials = (await fs.readdir(job.folder).catch(() => [])).filter(name => name.includes(job.token));
      await Promise.all(partials.map(name => fs.remove(path.join(job.folder, name)).catch(() => {})));
      this.emit('download:cancelled', { jobId: job.jobId }); return;
    }
    if (error) { this.emit('download:failed', { jobId: job.jobId, message: error.message }); return; }
    const marker = '__YTDESK_FILE__';
    const printed = job.stdout.split(/\r?\n/).find(line => line.startsWith(marker));
    let filePath = printed ? printed.slice(marker.length).trim() : '';
    if (!filePath || !(await fs.pathExists(filePath))) {
      const entries = (await fs.readdir(job.folder)).filter(name => name.includes(job.token) && ['.mp4', '.mp3', '.m4a', '.webm', '.mkv'].includes(path.extname(name).toLowerCase()));
      const candidates = await Promise.all(entries.map(async name => ({ name, mtime: (await fs.stat(path.join(job.folder, name))).mtimeMs })));
      candidates.sort((a, b) => b.mtime - a.mtime);
      filePath = candidates[0] ? path.join(job.folder, candidates[0].name) : '';
    }
    if (!filePath || !(await fs.pathExists(filePath))) { this.emit('download:failed', { jobId: job.jobId, message: 'The download ended, but its output file could not be found.' }); return; }
    this.emit('download:complete', { jobId: job.jobId, filePath, title: job.video.title, channel: job.video.channel, url: job.video.url, format: job.choice.kind === 'audio' ? 'mp3' : 'mp4', quality: job.choice.label });
  }

  friendlyError(stderr, code) {
    if (/ffmpeg|ffprobe/i.test(stderr)) return 'Media processing failed. Verify that the bundled FFmpeg is available, then try again.';
    if (/private video|members-only|sign in|login required|age-restricted/i.test(stderr)) return 'This video is not publicly available to this app. It does not bypass private or access-controlled content.';
    if (/not available|unavailable/i.test(stderr)) return 'This video is unavailable to download.';
    const detail = stderr.split(/\r?\n/).filter(line => line.includes('ERROR:')).pop();
    return (detail || `yt-dlp stopped with code ${code}.`).replace(/^.*ERROR:\s*/, '').slice(0, 500);
  }

  cancel(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    job.cancelled = true;
    job.child.kill('SIGTERM');
    setTimeout(() => { if (this.jobs.has(jobId)) job.child.kill('SIGKILL'); }, 2500).unref();
    return true;
  }

  cancelAll() { for (const id of this.jobs.keys()) this.cancel(id); }
}

module.exports = { DownloadManager, safeTitle, parseSize };
