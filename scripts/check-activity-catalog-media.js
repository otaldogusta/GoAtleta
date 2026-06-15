const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "src/core/volleyball/activity-catalog.ts");
const registryPath = path.join(root, "src/screens/library/activity-catalog-media.ts");
const manifestPath = path.join(
  root,
  "docs/catalog-pedagogico/media/activity-catalog-media-manifest.v2.json"
);

const fail = (message) => {
  console.error(`[activity-catalog-media] ${message}`);
  process.exitCode = 1;
};

const read = (filePath) => fs.readFileSync(filePath, "utf8");

const readPngSize = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  const signature = buffer.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") {
    throw new Error(`${filePath} is not a PNG`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const catalog = read(catalogPath);
const registry = read(registryPath);
const manifest = JSON.parse(read(manifestPath));

if (/volleyballxl/i.test(catalog) || /volleyballxl/i.test(registry)) {
  fail("Executable catalog media code must not mention volleyballxl.");
}

if (/https?:\/\//i.test(catalog) || /https?:\/\//i.test(registry)) {
  fail("Catalog media code must not contain external URLs.");
}

const registryEntries = {};
for (const match of registry.matchAll(
  /(\w+): require\("\.\.\/\.\.\/\.\.\/assets\/activity-catalog\/thumbnails\/([^"]+\.png)"\)/g
)) {
  registryEntries[match[1]] = `assets/activity-catalog/thumbnails/${match[2]}`;
}

if (!registryEntries.genericCourt) {
  fail("Registry must define genericCourt fallback.");
}

const catalogMediaKeys = new Set(
  [...catalog.matchAll(/mediaKey: "(\w+)"/g)].map((match) => match[1])
);
catalogMediaKeys.forEach((mediaKey) => {
  if (!registryEntries[mediaKey]) {
    fail(`Catalog mediaKey ${mediaKey} is missing from the registry.`);
  }
});

const manifestAssets = Array.isArray(manifest.assets) ? manifest.assets : [];
const manifestByKey = new Map(manifestAssets.map((asset) => [asset.mediaKey, asset]));
const validProviders = new Set(["higgsfield", "imagegen", "manual"]);

Object.entries(registryEntries).forEach(([mediaKey, relativeFile]) => {
  const asset = manifestByKey.get(mediaKey);
  if (!asset) {
    fail(`Registry mediaKey ${mediaKey} is missing from the manifest.`);
    return;
  }
  if (asset.file !== relativeFile) {
    fail(`Manifest file mismatch for ${mediaKey}: expected ${relativeFile}, got ${asset.file}.`);
  }
  if (asset.width !== 1280 || asset.height !== 720) {
    fail(`Manifest dimensions for ${mediaKey} must be 1280x720.`);
  }
  if (!asset.promptId) {
    fail(`Manifest asset ${mediaKey} must define promptId.`);
  }
  if (!validProviders.has(asset.provider)) {
    fail(`Manifest asset ${mediaKey} has invalid provider ${asset.provider}.`);
  }

  const filePath = path.join(root, relativeFile);
  if (!fs.existsSync(filePath)) {
    fail(`Missing thumbnail file for ${mediaKey}: ${relativeFile}.`);
    return;
  }
  try {
    const size = readPngSize(filePath);
    if (size.width !== 1280 || size.height !== 720) {
      fail(`Thumbnail ${relativeFile} is ${size.width}x${size.height}; expected 1280x720.`);
    }
  } catch (error) {
    fail(error.message);
  }
});

manifestAssets.forEach((asset) => {
  if (!registryEntries[asset.mediaKey]) {
    fail(`Manifest mediaKey ${asset.mediaKey} is not present in the registry.`);
  }
  if (!Array.isArray(asset.familyIds) || asset.familyIds.length === 0) {
    fail(`Manifest asset ${asset.mediaKey} must list at least one familyId.`);
  }
  if (!Array.isArray(asset.skills) || asset.skills.length === 0) {
    fail(`Manifest asset ${asset.mediaKey} must list at least one skill.`);
  }
});

if (!process.exitCode) {
  console.log(
    `[activity-catalog-media] OK: ${Object.keys(registryEntries).length} local thumbnails validated.`
  );
}
