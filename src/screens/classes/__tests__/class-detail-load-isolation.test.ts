import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = ts.createSourceFile("class.tsx", readFileSync(resolve(__dirname, "../../../../app/class/[id].tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect: ts.ArrowFunction | undefined;
const visit = (node: ts.Node) => {
  if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" &&
      node.arguments[0] && ts.isArrowFunction(node.arguments[0]) && node.arguments[0].getText(source).includes("screen.classDetails.load.initial")) effect = node.arguments[0];
  ts.forEachChild(node, visit);
};
visit(source);
if (!effect) throw new Error("Class initial load effect not found");
const code = ts.transpileModule(`const effect = ${effect.getText(source)}; return effect;`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const flush = async () => { for (let index = 0; index < 15; index++) await Promise.resolve(); };
function setup() {
  let resolveClass!: (value: object) => void;
  const response = new Promise<object>(done => { resolveClass = done; });
  const current = { userId: "user-a", generation: 1, cacheGeneration: 1 };
  const setters = Object.fromEntries([...effect!.getText(source).matchAll(/\b(set[A-Z]\w*)\(/g)].map(match => [match[1], jest.fn()]));
  const getClassById = jest.fn(() => response);
  const scope = {
    ...setters, session: { user: { id: "user-a" } }, activeOrganization: { id: "org-a" }, id: "class-a", detailDataScope: "scope-a",
    getSessionIdentity: () => ({ userId: current.userId, generation: current.generation }),
    isSessionIdentityCurrent: (identity: { userId: string; generation: number }) => identity.userId === current.userId && identity.generation === current.generation,
    getReadCacheGeneration: () => current.cacheGeneration,
    getClassById, measureAsync: (_label: string, run: () => Promise<unknown>) => run(),
    resolveEndTime: () => "19:00", parseDurationFromTimeRange: () => 60, parseCycleLength: () => 12,
    DEFAULT_CLASS_CYCLE_LENGTH_WEEKS: 12, coachNameByClass: {},
    getStudentsByClass: jest.fn().mockResolvedValue([]), getContactPhone: () => ({ status: "ok" }),
    isAuthSessionError: () => false, isRequestCancellationError: () => false, Alert: { alert: jest.fn() },
  };
  const load = new Function(...Object.keys(scope), code)(...Object.values(scope)) as () => () => void;
  return { load, setters, resolveClass, current, getClassById, scope };
}
const group = { id: "class-a", organizationId: "org-a", name: "Turma A" };

test("retained class header loads using the explicit organization scope", async () => {
  const h = setup(); const cleanup = h.load(); h.resolveClass(group); await flush();
  expect(h.getClassById).toHaveBeenCalledWith("class-a", { organizationId: "org-a" });
  expect(h.setters.setCls).toHaveBeenCalledWith(group);
  expect(h.setters.setLoadedDetailDataScope).toHaveBeenCalledWith("scope-a");
  cleanup();
});

test.each(["session", "organization", "unmount"])("old class response is discarded after %s changes", async (kind) => {
  const h = setup(); const cleanup = h.load();
  if (kind === "session") h.current.generation++;
  else if (kind === "organization") h.current.cacheGeneration++;
  else cleanup();
  h.resolveClass(group); await flush();
  expect(h.setters.setCls).not.toHaveBeenCalled();
  expect(h.setters.setLoadedDetailDataScope).not.toHaveBeenCalled();
  expect(h.scope.getStudentsByClass).not.toHaveBeenCalled();
  cleanup();
});
