const fs = require("fs");
const path = require("path");

const assetsRoot = path.resolve(__dirname, "..", "assets");
const supportedExtensions = new Set([".jpg", ".jpeg", ".png"]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function detectImageType(filePath) {
  const signature = Buffer.alloc(8);
  const descriptor = fs.openSync(filePath, "r");

  try {
    fs.readSync(descriptor, signature, 0, signature.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }

  if (
    signature[0] === 0x89 &&
    signature[1] === 0x50 &&
    signature[2] === 0x4e &&
    signature[3] === 0x47
  ) {
    return ".png";
  }

  if (signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff) {
    return ".jpg";
  }

  return null;
}

const mismatches = walk(assetsRoot)
  .filter((filePath) => supportedExtensions.has(path.extname(filePath).toLowerCase()))
  .flatMap((filePath) => {
    const declaredExtension = path.extname(filePath).toLowerCase();
    const normalizedDeclared = declaredExtension === ".jpeg" ? ".jpg" : declaredExtension;
    const detectedExtension = detectImageType(filePath);

    if (!detectedExtension || detectedExtension === normalizedDeclared) {
      return [];
    }

    return [
      `${path.relative(path.resolve(__dirname, ".."), filePath)} declara ${declaredExtension}, mas contém ${detectedExtension}`,
    ];
  });

if (mismatches.length > 0) {
  console.error("Assets com extensão incompatível com o conteúdo:");
  mismatches.forEach((mismatch) => console.error(`- ${mismatch}`));
  process.exit(1);
}

console.log("Assinaturas dos assets PNG/JPEG conferidas.");
