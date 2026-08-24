import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const saveToastSource = readFileSync(resolve(__dirname, "../save-toast.tsx"), "utf8");

describe("SaveToastProvider interaction contract", () => {
  it("keeps the global overlay non-blocking while the toast remains dismissible", () => {
    expect(saveToastSource.match(/pointerEvents="box-none"/g)).toHaveLength(2);
    expect(saveToastSource).not.toContain('pointerEvents: "box-none"');
    expect(saveToastSource).toContain("onPress={hideToast}");
    expect(saveToastSource).toContain('accessibilityLabel={`Fechar aviso: ${toast.message}`}');
  });
});
