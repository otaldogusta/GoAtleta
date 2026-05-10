# FFmpeg

FFmpeg is not bundled with the repository. The placeholder script expects `ffmpeg` to be available on PATH.

## Script

```bash
npm run media:prepare-video -- input.mp4 output.mp4
```

## What the placeholder does

- verifies that `ffmpeg` is available
- validates the input path
- writes the output directory if needed
- runs a safe baseline transcode to H.264/AAC

## Install

Install FFmpeg using your normal system package workflow and ensure `ffmpeg` is available in the shell PATH.

## Scope

This is preparation tooling for future media assets. It must not be used to drive pedagogical logic.
