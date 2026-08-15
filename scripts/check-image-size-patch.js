const { execFileSync } = require("child_process");

const probe = String.raw`
const { imageSize } = require("image-size");

const writeAscii = (buffer, offset, value) => buffer.write(value, offset, "ascii");

const icns = Buffer.alloc(16);
writeAscii(icns, 0, "icns");
icns.writeUInt32BE(16, 4);
writeAscii(icns, 8, "ic07");
icns.writeUInt32BE(0, 12);

const jxl = Buffer.alloc(40);
jxl.writeUInt32BE(12, 0);
writeAscii(jxl, 4, "JXL ");
jxl.writeUInt32BE(20, 12);
writeAscii(jxl, 16, "ftyp");
writeAscii(jxl, 20, "jxl ");
jxl.writeUInt32BE(0, 32);
writeAscii(jxl, 36, "jxlp");

for (const malformed of [icns, jxl]) {
  try {
    imageSize(malformed);
  } catch {
    continue;
  }
  throw new Error("Malformed image unexpectedly accepted");
}
`;

try {
  execFileSync(process.execPath, ["-e", probe], {
    stdio: "pipe",
    timeout: 2_000,
  });
  console.log("image-size DoS patch aplicado com sucesso.");
} catch {
  console.error(
    "Patch de segurança do image-size ausente ou inválido. Rode npm install e confirme patches/image-size+1.2.1.patch."
  );
  process.exit(1);
}
