import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const parse = (path: string) => ts.createSourceFile(path, readFileSync(resolve(process.cwd(), path), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const route = parse("app/class/[id].tsx"), body = parse("src/screens/classes/components/ClassEditModalBody.tsx");
function find(source: ts.SourceFile, predicate: (node: ts.Node) => boolean): ts.Node {
  let match: ts.Node | undefined;
  const visit = (node: ts.Node) => { if (!match && predicate(node)) match = node; if (!match) ts.forEachChild(node, visit); };
  visit(source); if (!match) throw new Error("Class settings callback not found"); return match;
}
const entry = find(route, node => ts.isCallExpression(node) && node.expression.getText(route) === "useEffect" && Boolean(node.arguments[0]?.getText(route).includes("autoOpenedSettingsForClassRef"))) as ts.CallExpression;
function variableCallback(source: ts.SourceFile, name: string) {
  const declaration = find(source, node => ts.isVariableDeclaration(node) && node.name.getText(source) === name) as ts.VariableDeclaration;
  return (declaration.initializer as ts.CallExpression).arguments[0];
}
function callback(node: ts.Node, source: ts.SourceFile, scope: Record<string, unknown>): (...args: unknown[]) => unknown {
  const code = ts.transpileModule(`return (${node.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), code)(...Object.values(scope));
}

test("a retained class route can return from the agenda and edit another field", () => {
  const state = { classRouteFocused: true, showEditModal: false, cls: { id: "same-class" }, settings: "1", requestedSettingsSection: "agenda", autoOpenedSettingsForClassRef: { current: null as string | null }, resetEditFields: jest.fn(), setShowEditModal: jest.fn() };
  const render = () => callback(entry.arguments[0], route, state)();
  render(); render(); expect(state.setShowEditModal).toHaveBeenCalledTimes(1);
  state.showEditModal = true;
  state.classRouteFocused = false; render();
  state.classRouteFocused = true; state.requestedSettingsSection = "profile"; render();
  expect(state.setShowEditModal).toHaveBeenCalledTimes(2);
  expect(state.resetEditFields).toHaveBeenCalledTimes(1);
  expect(state.autoOpenedSettingsForClassRef.current).toBe("same-class:profile");
  state.requestedSettingsSection = "basics"; render(); expect(state.setShowEditModal).toHaveBeenCalledTimes(3);
});

test("closing consumes only the settings request and preserves other route context", () => {
  const fn = variableCallback(route, "closeEditModal");
  const state = { settings: "1", router: { setParams: jest.fn() }, closeEditPickers: jest.fn(), resetEditFields: jest.fn(), setShowEditModal: jest.fn(), setShowEditActionsMenu: jest.fn(), setShowEditCloseConfirm: jest.fn(), setShowEditCycleCalendar: jest.fn(), setShowEditCustomAgeBand: jest.fn(), setEditCustomAgeBand: jest.fn(), setShowEditCustomGoal: jest.fn(), setEditCustomGoal: jest.fn() };
  callback(fn, route, state)();
  expect(state.router.setParams).toHaveBeenCalledWith({ settings: undefined, settingsSection: undefined });
});

test("the retained editor measures each requested section once and rejects a late previous measurement", () => {
  const fn = variableCallback(body, "positionInitialSection"), onScroll = jest.fn();
  const callbacks: (() => void)[] = [];
  const node = (y: number) => ({ measureLayout: jest.fn((_root, done) => callbacks.push(() => done(0, y))) });
  const shared = { sectionRoot: { current: {} }, basicsSection: { current: node(0) }, agendaSection: { current: node(400) }, profileSection: { current: node(220) }, initialPositioned: { current: null as string | null }, initialRequest: { current: { section: "agenda", callback: onScroll } } };
  const measure = (section: string) => callback(fn, body, { ...shared, props: { initialSection: section } })();
  measure("agenda");
  shared.initialRequest.current.section = "profile"; measure("profile");
  callbacks.shift()!(); expect(onScroll).not.toHaveBeenCalled();
  callbacks.shift()!(); expect(onScroll).toHaveBeenLastCalledWith(220);
  measure("profile"); expect(callbacks).toHaveLength(0);
  shared.initialRequest.current.section = "agenda"; measure("agenda"); callbacks.shift()!();
  expect(onScroll).toHaveBeenLastCalledWith(400); expect(onScroll).toHaveBeenCalledTimes(2);
});
