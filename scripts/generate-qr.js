"use strict";

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

async function main() {
  const [, , content, outputArg] = process.argv;

  if (!content || !outputArg) {
    console.error('Usage: node scripts/generate-qr.js "<text-or-url>" "exports/qr/demo.png"');
    process.exit(1);
  }

  const outputPath = path.resolve(process.cwd(), outputArg);
  const outputDir = path.dirname(outputPath);

  fs.mkdirSync(outputDir, { recursive: true });

  try {
    await QRCode.toFile(outputPath, content, {
      margin: 2,
      width: 512,
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("Failed to generate QR code.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log(`QR code written to ${outputPath}`);
}

main();
