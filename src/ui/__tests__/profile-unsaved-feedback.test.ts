import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");

describe("profile unsaved feedback", () => {
  const source = fs.readFileSync(path.join(repoRoot, "app/profile.tsx"), "utf8");

  it("does not show a warning toast merely because a field was edited", () => {
    expect(source).not.toContain("previousMobileDirtyRef");
    expect(source).not.toContain('message: "Você tem alterações não salvas.",');
  });

  it("still confirms before abandoning an edited profile", () => {
    expect(source).toContain('title: "Sair sem salvar?"');
    expect(source).toContain('message: "Você tem alterações não salvas no perfil."');
    expect(source).toContain('window.addEventListener("beforeunload", handleBeforeUnload)');
  });
});
