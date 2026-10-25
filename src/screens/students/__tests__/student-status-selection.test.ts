import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = ts.createSourceFile("students.tsx", readFileSync(resolve(__dirname, "../../../../app/students/index.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback: ts.ArrowFunction | undefined;
const visit = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleUpdateOperationalStatus" && node.initializer && ts.isCallExpression(node.initializer)) {
    const argument = node.initializer.arguments[0]; if (ts.isArrowFunction(argument)) callback = argument;
  }
  ts.forEachChild(node, visit);
};
visit(source);
if (!callback) throw new Error("Actual status callback not found");
const code = ts.transpileModule(`const change = ${callback.getText(source)}; return change;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
function setup() {
  const calls = { update: jest.fn().mockResolvedValue({ id: "a", organizationId: "org-a" }), confirm: jest.fn().mockResolvedValue(true),
    directory: jest.fn(), detail: jest.fn(), replace: jest.fn().mockReturnValue(true), history: jest.fn(), toast: jest.fn(), saving: jest.fn() };
  const scope = { operationalStudent: { id: "a" }, operationalStatusSaving: false, operationalOrganizationId: "org-a", studentScope: "scope-a",
    editSelectionEpoch: { current: 1 }, editSelectionScope: { current: "scope-a" }, confirmDialog: calls.confirm,
    setOperationalStatusSaving: calls.saving, updateStudentOperationalStatus: calls.update,
    setStudents: calls.directory, setEditingStudentFull: calls.detail, replaceProfileDetail: calls.replace,
    refreshOperationalHistory: calls.history, showSaveToast: calls.toast, projectStudentDirectoryRecord: (row: unknown) => row };
  const change = new Function(...Object.keys(scope), code)(...Object.values(scope)) as (patch: { membershipStatus: "active" | "inactive" }) => Promise<boolean>;
  return { calls, scope, change };
}
test("closing/reopening only the editor during a status write prevents all obsolete UI publication", async () => {
  const { calls, scope, change } = setup(); const gate = deferred<unknown>(); calls.update.mockReturnValue(gate.promise);
  const pending = change({ membershipStatus: "inactive" }); await flush();
  scope.editSelectionEpoch.current += 2; gate.resolve({ id: "a", organizationId: "org-a" });
  expect(await pending).toBe(false); expect(calls.update).toHaveBeenCalledTimes(1);
  for (const call of [calls.directory, calls.detail, calls.replace, calls.history, calls.toast]) expect(call).not.toHaveBeenCalled();
});
test("a stale confirmation cannot issue a write after its editor selection closes", async () => {
  const { calls, scope, change } = setup(); const gate = deferred<boolean>(); calls.confirm.mockReturnValue(gate.promise);
  const pending = change({ membershipStatus: "active" }); await flush(); scope.editSelectionEpoch.current++; gate.resolve(true);
  expect(await pending).toBe(false); expect(calls.update).not.toHaveBeenCalled();
});
test("a closed/reopened profile prevents publication before directory or editor setters", async () => {
  const { calls, change } = setup(); calls.replace.mockReturnValue(false);
  expect(await change({ membershipStatus: "inactive" })).toBe(false);
  expect(calls.directory).not.toHaveBeenCalled(); expect(calls.detail).not.toHaveBeenCalled(); expect(calls.toast).not.toHaveBeenCalled();
});
test("the current editor preserves the existing write and notification flow", async () => {
  const { calls, change } = setup(); expect(await change({ membershipStatus: "inactive" })).toBe(true);
  expect(calls.directory).toHaveBeenCalledTimes(1); expect(calls.detail).toHaveBeenCalledTimes(1); expect(calls.toast).toHaveBeenCalledTimes(1);
});
