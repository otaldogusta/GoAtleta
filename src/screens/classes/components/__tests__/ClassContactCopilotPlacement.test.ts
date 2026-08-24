import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const classRoute = readFileSync(
  resolve(__dirname, "../../../../../app/class/[id].tsx"),
  "utf8"
);
const workspace = readFileSync(resolve(__dirname, "../ClassOperationsWorkspace.tsx"), "utf8");

describe("class contact reminder Copilot placement", () => {
  it("keeps missing-contact guidance in the Copilot instead of the overview grid", () => {
    expect(classRoute).toContain('key: "class_missing_contacts"');
    expect(classRoute).toContain('id: "class_update_missing_contacts"');
    expect(classRoute).toContain('title: "Atualizar contatos pendentes"');
    expect(classRoute).toContain("useCopilotActions(classCopilotActions)");
    expect(classRoute).not.toContain("<InsightCard");
    expect(classRoute).not.toContain("contextualInsight={");
    expect(workspace).not.toContain("contextualInsight");
  });
});
