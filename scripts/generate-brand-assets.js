const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const markPath = path.join(root, "assets", "brand", "goatleta-mark.svg");
const imagesDir = path.join(root, "assets", "images");
const markSvg = fs.readFileSync(markPath, "utf8");

const NAVY = "#102A72";
const SAND = "#F5F0E8";
const SURFACE = "#FFFDF8";

const recoloredMark = (color) => Buffer.from(markSvg.replaceAll(NAVY, color));

async function renderMark(size, color = NAVY) {
  return sharp(recoloredMark(color)).resize(size, size, { fit: "contain" }).png().toBuffer();
}

async function renderCentered({ size, background, markSize, output }) {
  const mark = await renderMark(markSize);
  const offset = Math.round((size - markSize) / 2);

  await sharp({
    create: { width: size, height: size, channels: 4, background },
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .png()
    .toFile(path.join(imagesDir, output));
}

async function generate() {
  await renderCentered({
    size: 1024,
    background: SAND,
    markSize: 590,
    output: "icon.png",
  });

  await sharp({
    create: { width: 512, height: 512, channels: 4, background: SAND },
  })
    .png()
    .toFile(path.join(imagesDir, "android-icon-background.png"));

  const androidForeground = await renderMark(252);
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: androidForeground, left: 130, top: 130 }])
    .png()
    .toFile(path.join(imagesDir, "android-icon-foreground.png"));

  const androidMonochrome = await renderMark(214, "#000000");
  await sharp({
    create: {
      width: 432,
      height: 432,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: androidMonochrome, left: 109, top: 109 }])
    .png()
    .toFile(path.join(imagesDir, "android-icon-monochrome.png"));

  const faviconMark = await renderMark(31);
  const faviconTile = Buffer.from(
    `<svg width="48" height="48" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="46" height="46" rx="11" fill="${SURFACE}" stroke="#E8E4DC"/></svg>`,
  );
  await sharp(faviconTile)
    .composite([{ input: faviconMark, left: 9, top: 9 }])
    .png()
    .toFile(path.join(imagesDir, "favicon.png"));

  const splashTile = Buffer.from(
    `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><rect x="142" y="142" width="740" height="740" rx="176" fill="${SURFACE}"/></svg>`,
  );
  const splashMark = await renderMark(500);
  await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: splashTile, left: 0, top: 0 },
      { input: splashMark, left: 262, top: 262 },
    ])
    .png()
    .toFile(path.join(imagesDir, "splash-icon.png"));
}

generate()
  .then(() => console.log("Go Atleta brand assets generated."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
