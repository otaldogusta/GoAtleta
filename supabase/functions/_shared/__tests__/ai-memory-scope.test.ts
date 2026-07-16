import { readFileSync } from "node:fs";
import path from "node:path";

const aiMemorySource = readFileSync(
  path.resolve(__dirname, "..", "ai-memory.ts"),
  "utf8"
);
const assistantSource = readFileSync(
  path.resolve(__dirname, "..", "..", "assistant", "index.ts"),
  "utf8"
);

describe("AI memory scope", () => {
  test("usa a turma da ação mesmo quando a navegação não informa a entidade", () => {
    expect(aiMemorySource).toContain("context.action.classId");
    expect(aiMemorySource).toContain(
      "and(subject_type.eq.class,subject_id.eq.${activeClassId})"
    );
    expect(aiMemorySource).toContain('"ai_decision_traces.class_id"');
  });

  test("não recupera memória conversacional do mesmo usuário em outra turma", () => {
    expect(assistantSource).toContain('.eq("user_id", params.userId)');
    expect(assistantSource).toContain(
      "and(scope.eq.class,class_id.eq.${params.classId})"
    );
    expect(assistantSource).not.toContain(
      "scope.eq.organization,user_id.eq.${params.userId}"
    );
  });
});
