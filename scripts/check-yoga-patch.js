const fs = require("fs");

const file = "node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js";

try {
  const content = fs.readFileSync(file, "utf8");

  if (content.includes("import.meta.url")) {
    console.error(`
yoga-layout patch nao aplicado (import.meta.url ainda existe).

Isso quebra o Web com:
  "Cannot use import.meta outside a module"

Como resolver:
  1) Rode: npm install
  2) Verifique se o patch existe em: patches/yoga-layout+3.2.1.patch
  3) Confirme que o postinstall esta rodando patch-package

Se voce atualizou o yoga-layout, regenere o patch:
  npx patch-package yoga-layout
`);
    process.exit(1);
  }

  console.log("yoga-layout patch aplicado com sucesso.");
} catch (err) {
  console.error(`
Nao foi possivel validar o patch do yoga-layout.

Arquivo esperado nao encontrado:
  ${file}

Como resolver:
  - Rode: npm install
  - Verifique se yoga-layout@3.2.1 esta instalado corretamente
`);
  process.exit(1);
}
