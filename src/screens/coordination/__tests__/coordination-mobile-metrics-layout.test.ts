import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceSource = readFileSync(
  resolve(__dirname, "../CoordinationPeopleWorkspace.tsx"),
  "utf8"
);

describe("coordination mobile metrics layout", () => {
  it("keeps the four counts readable in two mobile rows and a single wide row", () => {
    expect(workspaceSource).toContain("compact ? [summaryMetrics.slice(0, 2), summaryMetrics.slice(2)] : [summaryMetrics]");
    expect(workspaceSource).toContain('accessibilityLabel={`Abrir fila. ${accessibleLabel}`}');
    expect(workspaceSource).toContain("onPress={() => openSummaryModule(section)}");
  });

  it("keeps the operational score explanation available as a separate expandable action", () => {
    expect(workspaceSource).toContain('accessibilityLabel={`Índice operacional:');
    expect(workspaceSource).toContain("accessibilityState={{ expanded: showHealthDetails }}");
    expect(workspaceSource).toContain("Parte de 100 e perde 2 pontos por chamada pendente");
  });
});
