import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = ts.createSourceFile("students.tsx", readFileSync(resolve(__dirname, "../../../../app/students/index.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback: ts.ArrowFunction | undefined;
const visit = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "onSave" && node.initializer && ts.isArrowFunction(node.initializer)) callback = node.initializer;
  ts.forEachChild(node, visit);
};
visit(source);
if (!callback) throw new Error("Actual save callback not found");
const code = ts.transpileModule(`const save = ${callback.getText(source)}; return save;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function setup() {
  const full = { id: "a", organizationId: "org-a", name: "Nome canônico atualizado", healthIssueNotes: "Saúde canônica", address: "Endereço preservado" };
  const calls = { update: jest.fn().mockResolvedValue(undefined), getFull: jest.fn().mockResolvedValue(full), replace: jest.fn().mockReturnValue(true),
    reset: jest.fn(), reload: jest.fn().mockResolvedValue(undefined), invalidate: jest.fn(), notice: jest.fn() };
  const scope = { editingId: "a", operationalStudent: { ...full, name: "Nome anterior" }, editSelectionEpoch: { current: 1 },
    editSelectionScope: { current: "scope-a" }, studentScope: "scope-a", unit: "Unidade", classId: "class-a", name: "Nome editado",
    isOnline: true, ageNumber: 16, birthDate: "2010-01-01", calculateAge: () => 16, classById: new Map([["class-a", { organizationId: "org-a" }]]),
    activeOrganization: { id: "org-a" }, validateStudentRa: () => null, ra: "202610001", photoUrl: "https://fixture.test/photo.jpg",
    photoMimeType: "image/jpeg", editSnapshot: { photoUrl: "https://fixture.test/photo.jpg" }, phone: "11999990000", cpfDisplay: "***.***.***-00",
    rgDocument: "Documento", collegeCourse: "Curso", loginEmail: "fixture@example.test", formatEmail: (value: string) => value,
    normalizeRaDigits: (value: string) => value, guardianName: "Responsável", guardianPhone: "11999990001", guardianRelation: "Mãe",
    positionPrimary: "indefinido", positionSecondary: "indefinido", athleteObjective: "base", learningStyle: "misto", isExperimental: false,
    healthIssue: true, healthIssueNotes: "Nota editada", medicationUse: false, medicationNotes: "", healthObservations: "", editingCreatedAt: "2026-01-01",
    setStudentDocumentsError: jest.fn(), clearStudentValidationError: jest.fn(), reportStudentValidation: jest.fn(), setStudentFormError: jest.fn(),
    measure: (_label: string, run: () => Promise<unknown>) => run(), updateStudent: calls.update, getStudentById: calls.getFull,
    replaceProfileDetail: calls.replace, profileDetail: { invalidate: calls.invalidate }, logAction: jest.fn(),
    doResetForm: calls.reset, reload: calls.reload, showSaveNotice: calls.notice, showSaveToast: jest.fn() };
  calls.reset.mockImplementation(() => { scope.editSelectionEpoch.current++; });
  const save = new Function(...Object.keys(scope), code)(...Object.values(scope)) as () => Promise<boolean>;
  return { calls, scope, save, full };
}
test("editing reloads and caches the canonical full record before profile replacement and closing", async () => {
  const { calls, save, full } = setup(); const gate = deferred<unknown>(); calls.getFull.mockReturnValue(gate.promise);
  const pending = save(); await flush(); expect(calls.update).toHaveBeenCalledTimes(1); expect(calls.reset).not.toHaveBeenCalled();
  expect(calls.update.mock.calls[0][0]).toMatchObject({ address: "Endereço preservado", name: "Nome editado" });
  gate.resolve(full); expect(await pending).toBe(true);
  expect(calls.getFull).toHaveBeenCalledWith("a", { organizationId: "org-a", allowCached: false });
  expect(calls.replace).toHaveBeenCalledWith(full);
  expect(calls.replace.mock.invocationCallOrder[0]).toBeLessThan(calls.reset.mock.invocationCallOrder[0]);
});
test.each(["write", "full refresh"])("closing/reopening during %s preserves the new editor and never closes it through an old callback", async phase => {
  const { calls, scope, save, full } = setup(); const gate = deferred<unknown>();
  if (phase === "write") calls.update.mockReturnValue(gate.promise); else calls.getFull.mockReturnValue(gate.promise);
  const pending = save(); await flush(); scope.editSelectionEpoch.current += 2; gate.resolve(phase === "write" ? undefined : full);
  expect(await pending).toBe(false); expect(calls.replace).not.toHaveBeenCalled(); expect(calls.reset).not.toHaveBeenCalled();
});
test("a committed write with failed full refresh clears the stale profile explicitly rather than patching from form fields", async () => {
  const { calls, save } = setup(); calls.getFull.mockRejectedValue(new Error("offline"));
  expect(await save()).toBe(true); expect(calls.replace).not.toHaveBeenCalled();
  expect(calls.invalidate).toHaveBeenCalledWith(expect.stringContaining("Alterações salvas"));
});
