import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

// Execute the route's actual callback, retaining its await/guard ordering.
const source = ts.createSourceFile("classes.tsx", readFileSync(resolve(__dirname, "../../../../app/classes/index.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback: ts.ArrowFunction | undefined;
const visit = (node: ts.Node) => {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === "loadClasses" && node.initializer && ts.isCallExpression(node.initializer)) {
    const argument = node.initializer.arguments[0]; if (ts.isArrowFunction(argument)) callback = argument;
  }
  ts.forEachChild(node, visit);
};
visit(source);
if (!callback) throw new Error("Actual loadClasses callback not found");
const code = ts.transpileModule(`const load = ${callback.getText(source)}; return load;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let index = 0; index < 12; index++) await Promise.resolve(); };
function setup() {
  const calls = { classes: jest.fn().mockResolvedValue([{ id: "class-a", organizationId: "org-a" }]),
    students: jest.fn().mockResolvedValue([{ id: "student-a", name: "Atleta", classId: "class-a", organizationId: "org-a" }]),
    heads: jest.fn().mockResolvedValue([]), staff: jest.fn().mockResolvedValue([]), members: jest.fn().mockResolvedValue([]),
    coverage: jest.fn().mockResolvedValue([]), publish: jest.fn(), loading: jest.fn() };
  const scope = { activeOrganization: { id: "org-a" }, isCoordinationScope: true, setLoading: calls.loading,
    classFocused: true, classLoadScope: "scope-a", classLoadScopeRef: { current: "scope-a" }, classLoadRequestRef: { current: 0 },
    classDataScope: "data-a", loadedClassDataScopeRef: { current: null as string | null },
    classIdentity: { userId: "user-a", generation: 1 }, classCacheGeneration: 1,
    getSessionIdentity: () => ({ userId: "user-a", generation: 1 }), getReadCacheGeneration: () => 1,
    getClasses: calls.classes, getTrainingIntegrationRules: async () => [], getClassStudentRecords: calls.students,
    measureAsync: (_label: string, run: () => Promise<unknown>) => run(), listClassHeadsByClassIds: calls.heads,
    listClassStaffIdentitiesByClassIds: calls.staff, listOrgStaffCandidates: calls.members,
    mergeOrgStaffCandidates: () => [], applyMemberNamesToClassResponsibles: () => [], applyMemberIdentitiesToClassStaff: () => [],
    reconcileClassResponsiblesWithStaff: () => [], listUpcomingClassSessionCoverages: calls.coverage,
    toLocalDateKey: () => "2026-10-25", getCoverageSummary: () => null,
    setClasses: calls.publish, setIntegrationRules: calls.publish, setStudents: calls.publish,
    setOrganizationMembers: calls.publish, setClassHeadsById: calls.publish, setClassStaffById: calls.publish,
    setClassCoverageSummariesByClassId: calls.publish };
  const load = new Function(...Object.keys(scope), code)(...Object.values(scope)) as (alive: { current: boolean }) => Promise<void>;
  return { calls, load, scope };
}
test("blur during the shared base read skips subsequent identity/coverage requests without aborting the shared read", async () => {
  const { calls, load } = setup(); const gate = deferred<unknown[]>(); calls.students.mockReturnValue(gate.promise);
  const alive = { current: true }; const pending = load(alive); await flush(); alive.current = false;
  gate.resolve([]); await pending;
  expect(calls.heads).not.toHaveBeenCalled(); expect(calls.staff).not.toHaveBeenCalled(); expect(calls.coverage).not.toHaveBeenCalled();
  expect(calls.publish).not.toHaveBeenCalled(); expect(calls.students).toHaveBeenCalledWith({ organizationId: "org-a" });
  expect(await gate.promise).toEqual([]);
});
test("blur during the identity phase prevents the later coverage request and stale publication", async () => {
  const { calls, load } = setup(); const gate = deferred<unknown[]>(); calls.heads.mockReturnValue(gate.promise);
  const alive = { current: true }; const pending = load(alive); await flush(); expect(calls.heads).toHaveBeenCalledTimes(1);
  alive.current = false; gate.resolve([]); await pending;
  expect(calls.coverage).not.toHaveBeenCalled(); expect(calls.publish).not.toHaveBeenCalled();
});
test("a focused load retains the existing complete flow", async () => {
  const { calls, load } = setup(); await load({ current: true });
  expect(calls.coverage).toHaveBeenCalledTimes(1); expect(calls.publish).toHaveBeenCalled(); expect(calls.loading).toHaveBeenLastCalledWith(false);
});
test("manual refresh without an alive object cannot publish after its workspace context changes", async () => {
  const { calls, load, scope } = setup(); const gate = deferred<unknown[]>(); calls.heads.mockReturnValue(gate.promise);
  const pending = (load as (alive?: { current: boolean }) => Promise<void>)(); await flush();
  scope.classLoadScopeRef.current = "scope-b"; gate.resolve([]); await pending;
  expect(calls.coverage).not.toHaveBeenCalled(); expect(calls.publish).not.toHaveBeenCalled();
});
test("an old caller invoked only after the workspace switch cannot begin I/O or invalidate a current load", async () => {
  const { calls, load, scope } = setup(); scope.classLoadScopeRef.current = "scope-b";
  await (load as (alive?: { current: boolean }) => Promise<void>)();
  expect(scope.classLoadRequestRef.current).toBe(0);
  for (const call of [calls.classes, calls.students, calls.heads, calls.coverage, calls.loading]) expect(call).not.toHaveBeenCalled();
});


test("retained list revalidates without replacing its loaded content with a shimmer", async () => {
  const { calls, load, scope } = setup();
  await load({ current: true });
  expect(calls.loading).toHaveBeenNthCalledWith(1, true);
  expect(scope.loadedClassDataScopeRef.current).toBe("data-a");
  calls.loading.mockClear();
  await load({ current: true });
  expect(calls.classes).toHaveBeenCalledTimes(2);
  expect(calls.loading).not.toHaveBeenCalledWith(true);
  expect(calls.publish).toHaveBeenCalled();
});

test("a different authorization scope cannot reuse the prior loaded list", async () => {
  const { calls, load, scope } = setup();
  scope.loadedClassDataScopeRef.current = "other-user-org-permissions";
  await load({ current: true });
  expect(calls.loading).toHaveBeenNthCalledWith(1, true);
});
