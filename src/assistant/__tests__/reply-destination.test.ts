import { resolveReplyDestination } from "../reply-destination";
import type { OperationalSnapshot } from "../../copilot/operational-context";
const snapshot = { operationalFacts: [{ key: "class_records_pending", value: 13 }, { key: "attendance_pending", value: 2 }] } as OperationalSnapshot;
test("only links verified pending lists for authorized coordinators", () => {
 expect(resolveReplyDestination("Regularizar registros de aula atrasados", snapshot, true)?.section).toBe("reports");
 expect(resolveReplyDestination("Registrar as chamadas pendentes de duas turmas", snapshot, true)?.section).toBe("attendance");
 expect(resolveReplyDestination("Regularizar registros de aula atrasados", snapshot, false)).toBeNull();
 expect(resolveReplyDestination("Verificar faltas de Heloisa", snapshot, true)).toBeNull();
 expect(resolveReplyDestination("https://example.com", snapshot, true)).toBeNull();
 expect(resolveReplyDestination("Regularizar registros atrasados", { operationalFacts: [] } as unknown as OperationalSnapshot, true)).toBeNull();
});
