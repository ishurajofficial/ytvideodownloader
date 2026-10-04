'use strict';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be']);

function normalizeYouTubeUrl(value) {
  let input = String(value || '').trim();
  if (!input) throw new Error('Paste a YouTube video link to continue.');
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(input)) input = `https://${input}`;
  let parsed;
  try { parsed = new URL(input); } catch { throw new Error('That link does not look valid. Check it and try again.'); }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!['https:', 'http:'].includes(parsed.protocol) || !HOSTS.has(host)) {
    throw new Error('Enter a link from youtube.com or youtu.be.');
  }
  const parts = parsed.pathname.split('/').filter(Boolean);
  let id = '';
  if (host.includes('youtu.be')) id = parts[0] || '';
  else if (parsed.pathname.replace(/\/$/, '') === '/watch') id = parsed.searchParams.get('v') || '';
  else if (['shorts', 'embed', 'live'].includes(parts[0])) id = parts[1] || '';
  if (!VIDEO_ID.test(id)) throw new Error('That link does not contain a valid video. Playlists and channel links are not supported.');
  return { id, url: `https://www.youtube.com/watch?v=${id}` };
}

module.exports = { normalizeYouTubeUrl };
