'use strict';

const ytdlp = require('youtube-dl-exec');
const { normalizeYouTubeUrl } = require('./validator');
const { ytDlpEnvironment } = require('./environment');

function readableSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return 'Size varies';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value, unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `~${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

async function inspect(value) {
  const { id, url } = normalizeYouTubeUrl(value);
  const info = await ytdlp(url, { dumpSingleJson: true, noWarnings: true, noPlaylist: true, skipDownload: true }, { env: ytDlpEnvironment() });
  const formats = (info.formats || []).filter(f => f.format_id && f.url);
  const video = formats.filter(f => f.vcodec && f.vcodec !== 'none' && Number(f.height) > 0);
  const heights = [...new Set(video.map(f => Number(f.height)))].sort((a, b) => b - a);
  const choices = [];
  if (heights.length) {
    choices.push({ kind: 'video', id: 'best', formatId: 'bestvideo+bestaudio/best', label: `Best available · ${heights[0]}p`, size: 'Size varies', height: heights[0] });
    for (const height of heights) {
      const group = video.filter(f => Number(f.height) === height);
      group.sort((a, b) => Number(b.ext === 'mp4') - Number(a.ext === 'mp4') || Number(b.filesize || b.filesize_approx || 0) - Number(a.filesize || a.filesize_approx || 0) || Number(b.tbr || 0) - Number(a.tbr || 0));
      const selected = group[0];
      const selector = selected.acodec && selected.acodec !== 'none'
        ? selected.format_id
        : `${selected.format_id}+bestaudio[ext=m4a]/${selected.format_id}+bestaudio/best`;
      choices.push({ kind: 'video', id: `video-${height}`, formatId: selector, label: `${height}p`, size: readableSize(selected.filesize || selected.filesize_approx), height });
    }
  }
  const audio = formats.filter(f => f.acodec && f.acodec !== 'none' && (!f.vcodec || f.vcodec === 'none'));
  if (audio.length) {
    for (const bitrate of [320, 256, 192, 128]) {
      const estimate = info.duration ? Number(info.duration) * bitrate * 1000 / 8 : 0;
      choices.push({ kind: 'audio', id: `audio-${bitrate}`, formatId: 'bestaudio/best', label: `${bitrate} kbps`, bitrate, size: estimate ? readableSize(estimate) : 'Size varies' });
    }
  }
  return {
    id, url, title: info.title || 'YouTube video', channel: info.channel || info.uploader || 'YouTube',
    duration: Number(info.duration) || 0, thumbnail: info.thumbnail || '', choices
  };
}

module.exports = { inspect, readableSize };
