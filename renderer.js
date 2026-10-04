'use strict';

class YtDesk {
  constructor() {
    this.video = null;
    this.jobId = null;
    this.downloading = false;
    this.lastFile = null;
    this.history = [];
    this.settings = null;
    this.getElements();
    this.bindEvents();
    this.bindDownloads();
    this.initialize().catch(error => this.toast(error.message, 'error'));
  }

  getElements() {
    for (const id of ['urlInput','analyzeBtn','videoInfoSection','downloadOptions','progressSection','loadingOverlay','toastContainer','videoThumbnail','videoTitle','videoDuration','videoLength','channelName','qualitySelect','formatList','downloadPath','downloadBtn','browseFolderBtn','selectFolderBtn','clearHistoryBtn','historyList','progressFill','progressPercentage','progressStatus','progressMeta','cancelDownloadBtn','openFileBtn','openFolderBtn','anotherVideoBtn','settingsBtn','settingsDialog','settingsPath','metadataToggle','saveSettingsBtn','closeSettingsBtn','legalNotice']) {
      this[id] = document.getElementById(id);
    }
    this.formatTabs = document.querySelectorAll('.format-tab');
  }

  bindEvents() {
    this.urlInput.addEventListener('keydown', event => { if (event.key === 'Enter') this.analyze(); });
    this.analyzeBtn.addEventListener('click', () => this.analyze());
    this.formatTabs.forEach(tab => tab.addEventListener('click', () => {
      this.formatTabs.forEach(item => item.classList.toggle('active', item === tab));
      this.updateChoices();
    }));
    this.qualitySelect.addEventListener('change', () => this.updateDownloadButton());
    this.downloadBtn.addEventListener('click', () => this.download());
    this.selectFolderBtn.addEventListener('click', () => this.chooseFolder());
    this.browseFolderBtn.addEventListener('click', () => this.chooseFolder());
    this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());
    this.settingsBtn.addEventListener('click', () => this.settingsDialog.showModal());
    this.closeSettingsBtn.addEventListener('click', () => this.settingsDialog.close());
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    this.cancelDownloadBtn.addEventListener('click', () => this.cancelDownload());
    this.openFileBtn.addEventListener('click', () => this.openFile());
    this.openFolderBtn.addEventListener('click', () => this.openFolder());
    this.anotherVideoBtn.addEventListener('click', () => this.reset());
  }

  bindDownloads() {
    window.ytdesk.onProgress(data => {
      if (data.jobId !== this.jobId) return;
      this.progressFill.style.width = `${data.percent || 0}%`;
      this.progressPercentage.textContent = `${Math.floor(data.percent || 0)}%`;
      this.progressStatus.textContent = data.status || 'Downloading…';
      const size = data.total ? `${this.bytes(data.downloaded || 0)} / ${this.bytes(data.total)}` : 'Size unavailable';
      const speed = data.speed ? `${this.bytes(data.speed)}/s` : '—';
      const eta = data.eta || '—';
      this.progressMeta.textContent = `${size}  ·  ${speed}  ·  ${eta} remaining`;
    });
    window.ytdesk.onComplete(data => { if (data.jobId === this.jobId) this.completed(data); });
    window.ytdesk.onFailed(data => { if (data.jobId === this.jobId) this.failed(data.message); });
    window.ytdesk.onCancelled(data => { if (data.jobId === this.jobId) this.cancelled(); });
  }

  async initialize() {
    [this.settings, this.history] = await Promise.all([window.ytdesk.getSettings(), window.ytdesk.getHistory()]);
    this.showSettings();
    this.renderHistory();
    this.updateDownloadButton();
    this.legalNotice.textContent = 'Only save content you have the rights and permission to download. Follow YouTube’s Terms of Service and applicable local law. YtDesk does not bypass DRM, private content, or access controls.';
  }

  async analyze() {
    const url = this.urlInput.value.trim();
    if (!url) return this.toast('Paste a YouTube video link to continue.', 'error');
    this.showLoading(true);
    this.analyzeBtn.disabled = true;
    this.analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing…';
    this.videoInfoSection.style.display = 'none';
    this.downloadOptions.style.display = 'none';
    try {
      this.video = await window.ytdesk.analyze(url);
      this.urlInput.value = this.video.url;
      this.videoThumbnail.src = this.video.thumbnail || '';
      this.videoTitle.textContent = this.video.title;
      this.videoLength.textContent = this.formatDuration(this.video.duration);
      this.videoDuration.textContent = this.formatDuration(this.video.duration);
      this.channelName.textContent = this.video.channel;
      this.videoInfoSection.style.display = 'block';
      this.downloadOptions.style.display = 'block';
      this.updateChoices();
      this.toast('Video details are ready.', 'success');
    } catch (error) { this.toast(error.message, 'error'); }
    finally {
      this.showLoading(false);
      this.analyzeBtn.disabled = false;
      this.analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Analyze';
    }
  }

  updateChoices() {
    if (!this.video) return;
    const kind = document.querySelector('.format-tab.active').dataset.format === 'mp3' ? 'audio' : 'video';
    const choices = this.video.choices.filter(choice => choice.kind === kind);
    this.qualitySelect.replaceChildren(new Option(choices.length ? 'Select quality…' : 'No formats available', ''));
    this.formatList.replaceChildren();
    for (const choice of choices) {
      const option = new Option(`${choice.label}  ·  ${choice.size}`, choice.id);
      this.qualitySelect.add(option);
      const row = document.createElement('div'); row.className = 'format-row';
      const detail = document.createElement('span'); detail.textContent = `${kind === 'video' ? 'MP4' : 'MP3'} · ${choice.label}`;
      const size = document.createElement('small'); size.textContent = choice.size;
      const download = document.createElement('button'); download.className = 'btn btn-primary format-download-btn'; download.textContent = 'Download'; download.disabled = Boolean(this.jobId || this.downloading);
      download.addEventListener('click', () => { this.qualitySelect.value = choice.id; this.updateDownloadButton(); this.download(); });
      const labels = document.createElement('div'); labels.className = 'format-labels'; labels.append(detail, size);
      row.append(labels, download); this.formatList.append(row);
    }
    this.updateDownloadButton();
  }

  updateDownloadButton() {
    if (this.downloadBtn) this.downloadBtn.disabled = !(this.qualitySelect.value && this.downloadPath.value);
  }

  async chooseFolder() {
    try { this.settings = await window.ytdesk.chooseFolder(); if (this.settings) this.showSettings(); }
    catch (error) { this.toast(error.message, 'error'); }
  }

  showSettings() {
    this.downloadPath.value = this.settings.downloadDir;
    this.settingsPath.value = this.settings.downloadDir;
    this.metadataToggle.checked = this.settings.embedMetadata;
  }

  async saveSettings() {
    try {
      this.settings = await window.ytdesk.saveSettings({ downloadDir: this.settingsPath.value.trim(), embedMetadata: this.metadataToggle.checked });
      this.showSettings(); this.settingsDialog.close(); this.updateDownloadButton(); this.toast('Settings saved.', 'success');
    } catch (error) { this.toast(error.message, 'error'); }
  }

  async download() {
    if (!this.video || this.jobId || this.downloading) return;
    const choiceId = this.qualitySelect.value;
    if (!choiceId) return this.toast('Select a quality first.', 'error');
    this.downloading = true;
    this.lastFile = null;
    this.progressSection.style.display = 'block';
    this.progressFill.style.width = '0%'; this.progressPercentage.textContent = '0%';
    this.progressStatus.textContent = 'Preparing download…'; this.progressMeta.textContent = 'Waiting for media…';
    this.cancelDownloadBtn.hidden = false; this.openFileBtn.hidden = true; this.openFolderBtn.hidden = true; this.anotherVideoBtn.hidden = true;
    this.downloadBtn.disabled = true;
    this.setFormatButtons(true);
    try {
      const result = await window.ytdesk.startDownload({ url: this.video.url, choiceId });
      this.jobId = result.jobId;
    } catch (error) { this.downloading = false; this.failed(error.message); }
  }

  async cancelDownload() {
    if (!this.jobId) return;
    this.cancelDownloadBtn.disabled = true;
    this.progressStatus.textContent = 'Stopping download safely…';
    try { await window.ytdesk.cancelDownload(this.jobId); } catch (error) { this.toast(error.message, 'error'); }
  }

  async completed(data) {
    this.jobId = null; this.downloading = false; this.lastFile = data.filePath;
    this.progressFill.style.width = '100%'; this.progressPercentage.textContent = '100%';
    this.progressStatus.textContent = 'Download completed'; this.progressMeta.textContent = `${data.format.toUpperCase()} · ${data.quality}`;
    this.cancelDownloadBtn.hidden = true; this.cancelDownloadBtn.disabled = false;
    this.openFileBtn.hidden = false; this.openFolderBtn.hidden = false; this.anotherVideoBtn.hidden = false;
    this.updateDownloadButton(); this.setFormatButtons(false);
    this.history.unshift(data); this.history = this.history.slice(0, 200);
    await window.ytdesk.getHistory().then(rows => { this.history = rows; });
    this.renderHistory(); this.toast('Download completed.', 'success');
  }

  failed(message) {
    this.jobId = null; this.downloading = false; this.cancelDownloadBtn.hidden = true; this.cancelDownloadBtn.disabled = false;
    this.anotherVideoBtn.hidden = false; this.updateDownloadButton(); this.setFormatButtons(false);
    this.progressStatus.textContent = 'Download failed'; this.progressMeta.textContent = message;
    this.toast(message, 'error');
  }

  cancelled() {
    this.jobId = null; this.downloading = false; this.cancelDownloadBtn.hidden = true; this.cancelDownloadBtn.disabled = false;
    this.anotherVideoBtn.hidden = false; this.updateDownloadButton(); this.setFormatButtons(false);
    this.progressStatus.textContent = 'Download cancelled'; this.progressMeta.textContent = '';
  }

  async openFile() { if (this.lastFile) try { await window.ytdesk.openFile(this.lastFile); } catch (error) { this.toast(error.message, 'error'); } }
  async openFolder() { try { await window.ytdesk.openFolder(); } catch (error) { this.toast(error.message, 'error'); } }

  async renderHistory() {
    this.historyList.replaceChildren();
    if (!this.history.length) {
      const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<i class="fas fa-history"></i><p>No downloads yet</p>'; this.historyList.append(empty); return;
    }
    for (const item of this.history) {
      const row = document.createElement('div'); row.className = 'history-item';
      const info = document.createElement('div'); info.className = 'history-info';
      const title = document.createElement('h4'); title.textContent = item.title;
      const details = document.createElement('p'); details.textContent = `${String(item.format).toUpperCase()} · ${item.quality} · ${item.channel || ''}`;
      const date = document.createElement('small'); date.textContent = new Date(item.date).toLocaleString();
      info.append(title, details, date);
      const actions = document.createElement('div'); actions.className = 'history-actions';
      const open = document.createElement('button'); open.className = 'btn btn-text'; open.textContent = 'Open file'; open.addEventListener('click', () => window.ytdesk.openFile(item.path).catch(error => this.toast(error.message, 'error')));
      const reveal = document.createElement('button'); reveal.className = 'btn btn-text'; reveal.textContent = 'Show folder'; reveal.addEventListener('click', () => window.ytdesk.revealFile(item.path).catch(error => this.toast(error.message, 'error')));
      actions.append(open, reveal); row.append(info, actions); this.historyList.append(row);
    }
  }

  async clearHistory() {
    if (!this.history.length || !window.confirm('Clear all download history?')) return;
    await window.ytdesk.clearHistory(); this.history = []; this.renderHistory(); this.toast('History cleared.', 'success');
  }

  reset() {
    this.video = null; this.lastFile = null; this.jobId = null; this.downloading = false;
    this.progressSection.style.display = 'none'; this.downloadOptions.style.display = 'none'; this.videoInfoSection.style.display = 'none';
    this.urlInput.value = ''; this.qualitySelect.replaceChildren(new Option('Select quality…', ''));
    this.cancelDownloadBtn.disabled = false; this.downloadBtn.disabled = true; this.urlInput.focus();
  }

  showLoading(show) { this.loadingOverlay.style.display = show ? 'flex' : 'none'; }
  setFormatButtons(disabled) { this.formatList.querySelectorAll('button').forEach(button => { button.disabled = disabled; }); }
  toast(message, type = 'success') {
    const node = document.createElement('div'); node.className = `toast ${type}`; node.textContent = message;
    this.toastContainer.append(node); setTimeout(() => node.remove(), 6000);
  }
  formatDuration(seconds) { const value = Number(seconds) || 0; const h = Math.floor(value / 3600); const m = Math.floor(value % 3600 / 60); const s = value % 60; return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`; }
  bytes(value) { if (!Number.isFinite(Number(value)) || value <= 0) return '—'; const units = ['B','KB','MB','GB']; let size = Number(value), i = 0; while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; } return `${size.toFixed(i ? 1 : 0)} ${units[i]}`; }
}

document.addEventListener('DOMContentLoaded', () => new YtDesk());
