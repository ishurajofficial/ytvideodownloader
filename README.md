# YtDesk

YtDesk is a cross-platform desktop app for inspecting public YouTube video formats and saving media that you have permission to download. It uses yt-dlp for extraction and transfer, and FFmpeg for MP4 merging and MP3 conversion.

## Requirements

- Node.js 18 or newer and npm
- Python 3.9 or newer available as `python3` on macOS/Linux (the yt-dlp executable installed by the dependency uses Python)
- A system Node.js executable on `PATH` for yt-dlp’s YouTube JavaScript support (also required when running the packaged app)
- A supported 64-bit desktop operating system for Electron
- Internet access for video metadata and downloads

FFmpeg is bundled with the application. YtDesk does not request or store YouTube credentials and does not bypass DRM, private videos, or access controls. Use it only for content you have rights and permission to save, and follow YouTube’s Terms of Service and applicable law.

## Install and run

```sh
npm install
npm start
```

The yt-dlp dependency retrieves its executable during installation. On macOS, if Python certificates are not configured, the app uses the system CA bundle when available. On other platforms, make sure Python can verify HTTPS certificates; do not disable certificate checking.

## Build and package

```sh
npm test
npm run build
```

`npm run build` creates a package for the current platform in `dist/`. Use `npm run dist` for the same non-publishing build. Build and sign each release on its target OS and architecture; the yt-dlp and FFmpeg executables are platform-specific. Electron Builder unpacks both executable dependencies from the app archive so they can run. macOS distribution may require Developer ID signing and notarization; Windows installer signing is recommended for published releases.

## Android app

The native Android companion is maintained in the [YtDesk Android repository](https://github.com/ishurajofficial/ytdesk-android). It supports Android 10 and newer and includes its own build, signing, and third-party license instructions.

## Use

1. Paste a `youtube.com/watch`, `youtu.be`, Shorts, embed, or live video URL and press **Analyze**.
2. Review the thumbnail, title, channel, duration, and detected formats.
3. Choose an MP4 resolution or MP3 bitrate, select the destination in Settings, and press **Download**.
4. Follow live progress, cancel if needed, then open the finished file or its folder.

Pasting a link never starts a download. Playlists and non-YouTube links are rejected. Available qualities depend on the video and current yt-dlp support. Separate audio and video streams are merged automatically; audio is converted to MP3 at the selected bitrate.

## App data

Settings, up to 200 download-history entries, and a rotating diagnostic log are stored in Electron’s per-user `userData` directory. The chosen folder holds media. Filenames are sanitized and receive a unique suffix to avoid overwriting previous downloads.

## Troubleshooting

- **Analysis errors:** update dependencies (`npm update youtube-dl-exec`) and retry. Some videos are unavailable by region or publisher settings.
- **Media processing errors:** from the project folder run `npm run repair:ffmpeg`, then restart YtDesk. Installation checks that the FFmpeg binary can run and repairs an incomplete download; if a system FFmpeg is installed, YtDesk can use it as a fallback.
- **Python error:** confirm `python3 --version` works and meets the requirement above.
- **Certificate error:** install/configure a trusted CA bundle for the system Python environment. YtDesk keeps TLS verification enabled.
- **Post-processing error:** reinstall app dependencies so the bundled FFmpeg binary is present.
- **Build errors:** run `npm install` on the same OS and architecture you are packaging.

## Development checks

`npm test` runs focused tests for URL validation, path sanitization, and progress parsing. The metadata service can also be smoke-checked from Node with:

```sh
node -e "require('./src/main/services/video-service').inspect('https://www.youtube.com/watch?v=dQw4w9WgXcQ').then(x => console.log(x.title, x.choices.length))"
```
