'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeYouTubeUrl } = require('../src/main/services/validator');
const { DownloadManager, safeTitle, parseSize } = require('../src/main/services/download-manager');

test('normalizes watch, short, Shorts and scheme-less links', () => {
  for (const input of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=share',
    'youtu.be/dQw4w9WgXcQ',
    'https://youtube.com/shorts/dQw4w9WgXcQ'
  ]) assert.equal(normalizeYouTubeUrl(input).url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('rejects unsupported hosts, playlists and malformed ids', () => {
  for (const input of [
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/playlist?list=abc',
    'https://youtube.com/watch?v=bad'
  ]) assert.throws(() => normalizeYouTubeUrl(input), /link|video/i);
});

test('sanitizes filenames for cross-platform media paths', () => {
  assert.equal(safeTitle('../a:b?c. '), '.._a_b_c');
  assert.equal(safeTitle('CON'), 'Video CON');
  assert.ok(safeTitle('x'.repeat(300)).length <= 150);
});

test('parses yt-dlp byte units used by progress output', () => {
  assert.equal(parseSize('12.5MiB'), 13107200);
  assert.equal(parseSize('4.2MiB/s'), 4404019);
  assert.equal(parseSize('unknown'), null);
});

test('emits real structured download progress with size, speed and ETA', () => {
  let event;
  const manager = new DownloadManager(async () => ({}), (name, data) => { event = { name, data }; });
  manager.progress({ jobId: 'job-1' }, '__YTDESK_PROGRESS__ 42.5%|1048576|4194304|262144|30');
  assert.equal(event.name, 'download:progress');
  assert.deepEqual(event.data, { jobId: 'job-1', status: 'Downloading…', percent: 42.5, downloaded: 1048576, total: 4194304, speed: 262144, eta: '0:30' });
});
