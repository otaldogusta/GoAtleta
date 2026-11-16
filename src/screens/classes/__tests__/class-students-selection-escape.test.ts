import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const parse = (path: string) => ts.createSourceFile(path, readFileSync(resolve(process.cwd(), path), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const route = parse("app/class/[id]/students.tsx");
const sheet = parse("src/ui/ModalSheet.tsx");
function find(source: ts.SourceFile, predicate: (node: ts.Node) => boolean): ts.Node {
  let match: ts.Node | undefined;
  const visit = (node: ts.Node) => { if (!match && predicate(node)) match = node; if (!match) ts.forEachChild(node, visit); };
  visit(source);
  if (!match) throw new Error("Selection keyboard callback not found");
  return match;
}
const selectionEffect = find(route, node => ts.isCallExpression(node) && node.expression.getText(route) === "useEffect" && Boolean(node.arguments[0]?.getText(route).includes("handleEscapeSelection"))) as ts.CallExpression;
function callback(name: string) {
  const declaration = find(route, node => ts.isVariableDeclaration(node) && node.name.getText(route) === name) as ts.VariableDeclaration;
  return (declaration.initializer as ts.CallExpression).arguments[0];
}
const sheetEscape = (find(sheet, node => ts.isVariableDeclaration(node) && node.name.getText(sheet) === "handleKeyDown" && Boolean(node.initializer?.getText(sheet).includes("isTopWebSheet"))) as ts.VariableDeclaration).initializer!;
function evaluate(node: ts.Node, source: ts.SourceFile, scope: Record<string, unknown>) {
  const code = ts.transpileModule(`return (${node.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), code)(...Object.values(scope));
}
type KeyEvent = { key: string; defaultPrevented: boolean; preventDefault: () => void; target?: { closest: (selector: string) => unknown } };
function event(key = "Escape", defaultPrevented = false): KeyEvent {
  const value = { key, defaultPrevented, preventDefault: jest.fn(() => { value.defaultPrevented = true; }) };
  return value;
}
function setup(moveOpen = false) {
  const state = { selected: ["student-a", "student-b"], selectionMode: true, moveOpen, search: "destino", error: "", target: "class-b" };
  const listeners = new Set<(event: KeyEvent) => void>();
  const blur = jest.fn();
  const document = {
    activeElement: { blur },
    addEventListener: (_type: string, listener: (event: KeyEvent) => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: (event: KeyEvent) => void) => listeners.delete(listener),
  };
  const exitSelectionMode = evaluate(callback("exitSelectionMode"), route, {
    setShowSelectionActionsMenu: jest.fn(),
    setSelectionModeEnabled: (value: boolean) => { state.selectionMode = value; },
    setSelectedStudentIds: (value: string[]) => { state.selected = value; },
  });
  const closeMoveClassModal = evaluate(callback("closeMoveClassModal"), route, {
    setShowMoveClassModal: (value: boolean) => { state.moveOpen = value; },
    setMoveClassSearch: (value: string) => { state.search = value; },
    setMoveClassError: (value: string) => { state.error = value; },
    setSelectedMoveClassId: (value: string) => { state.target = value; },
  });
  const register = () => evaluate(selectionEffect.arguments[0], route, {
    Platform: { OS: "web" }, isSelectionMode: state.selectionMode,
    showMoveClassModal: state.moveOpen, exitSelectionMode, document,
  })() as (() => void) | undefined;
  const handleSheetEscape = evaluate(sheetEscape, sheet, {
    isTopWebSheet: () => true, sheetId: { current: Symbol("move") }, onClose: closeMoveClassModal,
  }) as (event: KeyEvent) => void;
  return { state, listeners, blur, register, handleSheetEscape };
}

test("Escape closes the move sheet without consuming the selected students, then clears selection on the list", () => {
  const h = setup();
  const cleanup = h.register();
  expect(h.listeners.size).toBe(1);
  cleanup?.();
  h.state.moveOpen = true;
  h.register();
  expect(h.listeners.size).toBe(0);

  const closeEvent = event();
  h.listeners.forEach(listener => listener(closeEvent));
  h.handleSheetEscape(closeEvent);
  expect(h.state.moveOpen).toBe(false);
  expect(h.state.selectionMode).toBe(true);
  expect(h.state.selected).toEqual(["student-a", "student-b"]);
  expect(h.state.target).toBe("");
  expect(h.blur).not.toHaveBeenCalled();

  h.register();
  h.listeners.forEach(listener => listener(event()));
  expect(h.state.selectionMode).toBe(false);
  expect(h.state.selected).toEqual([]);
  expect(h.blur).toHaveBeenCalledTimes(1);
});

test("Escape already handled by a child leaves selection and focus untouched", () => {
  const h = setup(); h.register();
  const handled = event("Escape", true);
  h.listeners.forEach(listener => listener(handled));
  expect(h.state.selected).toEqual(["student-a", "student-b"]);
  expect(h.state.selectionMode).toBe(true);
  expect(handled.preventDefault).not.toHaveBeenCalled();
  expect(h.blur).not.toHaveBeenCalled();
});

test("other keys keep the list selection", () => {
  const h = setup(); h.register();
  h.listeners.forEach(listener => listener(event("Enter")));
  expect(h.state.selected).toEqual(["student-a", "student-b"]);
  expect(h.blur).not.toHaveBeenCalled();
});

test.each(["dialog", "alertdialog", "menu", "listbox"])("Escape originating in a %s does not clear the parent selection", (role) => {
  const h = setup(); h.register();
  const nested = event();
  const closest = jest.fn((selector: string) => selector.includes(`[role="${role}"]`) ? {} : null);
  nested.target = { closest };
  h.listeners.forEach(listener => listener(nested));
  expect(h.state.selected).toEqual(["student-a", "student-b"]);
  expect(h.state.selectionMode).toBe(true);
  expect(nested.preventDefault).not.toHaveBeenCalled();
  expect(h.blur).not.toHaveBeenCalled();
});
