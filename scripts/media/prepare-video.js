"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function hasFfmpeg() {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore", shell: true });
  return probe.status === 0;
}

function main() {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg || !outputArg) {
    console.error("Usage: node scripts/media/prepare-video.js <input.mp4> <output.mp4>");
    process.exit(1);
  }

  if (!hasFfmpeg()) {
    console.error("ffmpeg was not found on PATH. Install FFmpeg and try again.");
    console.error("See docs/tooling/ffmpeg.md for setup guidance.");
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), inputArg);
  const outputPath = path.resolve(process.cwd(), outputArg);

  if (!fs.existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-c:a", "aac", outputPath],
    { stdio: "inherit", shell: true }
  );

  process.exit(result.status || 0);
}

main();
