import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("student operational history layout", () => {
  it("keeps history out of the primary editing flow and opens it on demand", () => {
    const editModal = readSource(
      "src/screens/students/modals/StudentEditModal.tsx",
    );
    const historyModal = readSource(
      "src/screens/students/modals/StudentOperationalHistoryModal.tsx",
    );

    expect(editModal).toContain('accessibilityLabel="Ver histórico do aluno"');
    expect(editModal).toContain('accessibilityLabel="Fechar edição do aluno"');
    expect(editModal).toContain("setShowOperationalHistory(true)");
    expect(editModal).toContain("<StudentOperationalHistoryModal");
    expect(editModal).toMatch(
      /showOperationalHistory\s*\? \(\) => setShowOperationalHistory\(false\)/,
    );
    expect(editModal).not.toContain("operationalHistory.map");
    expect(editModal).not.toContain(
      "O financeiro não altera presença. Inativos saem de novas chamadas e mantêm o histórico.",
    );

    expect(historyModal).toContain("<ModalSheet");
    expect(historyModal).toContain("Histórico do aluno");
    expect(historyModal).toContain("events.map");
    expect(historyModal).toContain('accessibilityLabel="Fechar histórico"');
    expect(historyModal).toContain('accessibilityLabel="Tentar carregar o histórico novamente"');
    expect(historyModal).toContain('overflow: "hidden"');
    expect(historyModal).toContain("flexShrink: 1");
  });

  it("ignores a delayed history response after the selected student changes", () => {
    const studentsScreen = readSource("app/students/index.tsx");

    expect(studentsScreen).toContain("operationalHistoryRequestIdRef");
    expect(studentsScreen).toContain("operationalHistoryScopeKeyRef");
    expect(studentsScreen).toContain(
      "isStudentOperationalHistoryScopeCurrent",
    );
    expect(studentsScreen).toContain(
      "requestId !== operationalHistoryRequestIdRef.current",
    );
    expect(studentsScreen).toContain("setOperationalHistory([])");
  });
});
