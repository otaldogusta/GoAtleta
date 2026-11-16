import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = ts.createSourceFile("students.tsx", readFileSync(resolve("app/class/[id]/students.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate: (node: ts.Node) => boolean): ts.Node {
  let match: ts.Node | undefined;
  const visit = (node: ts.Node) => { if (!match && predicate(node)) match = node; if (!match) ts.forEachChild(node, visit); };
  visit(source); if (!match) throw Error("Duplicate editor handoff missing"); return match;
}
function evaluate(node: ts.Node, scope: Record<string, unknown>) {
  const code = ts.transpileModule(`return (${node.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(scope), code)(...Object.values(scope));
}
const modal = find(node => ts.isJsxOpeningElement(node) && node.tagName.getText(source) === "ModalSheet" && node.getText(source).includes("visible={Boolean(duplicateReviewTarget)}")) as ts.JsxOpeningElement;
const exit = modal.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === "onExited") as ts.JsxAttribute;
const onExited = (exit.initializer as ts.JsxExpression).expression!;

test("hands focus to the editor only after the duplicate review closes", () => {
  const duplicateEditorHandoff = { current: false };
  const student = { id: "qa-student" }, openEdit = jest.fn(), setDuplicateReviewTarget = jest.fn(), focus = jest.fn();
  const review = find(node => ts.isVariableDeclaration(node) && node.name.getText(source) === "reviewDuplicateStudent") as ts.VariableDeclaration;
  evaluate(review.initializer!, { duplicateReviewTarget: { student }, duplicateEditorHandoff, setDuplicateReviewTarget, openEdit })();
  expect(openEdit).toHaveBeenCalledWith(student);
  expect(setDuplicateReviewTarget).toHaveBeenCalledWith(null);
  expect(duplicateEditorHandoff.current).toBe(true);
  expect(focus).not.toHaveBeenCalled();
  const getElementById = jest.fn(() => ({ isConnected: true, closest: () => null, focus }));
  const completed = evaluate(onExited, { duplicateEditorHandoff, editingStudent: student, Platform: { OS: "web" }, document: { getElementById } });
  completed();
  expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  expect(getElementById).toHaveBeenCalledWith("class-student-edit-close");
  expect(duplicateEditorHandoff.current).toBe(false);
  completed();
  expect(focus).toHaveBeenCalledTimes(1);
});

test("does not move focus after cancellation, editor closure or to an inactive editor", () => {
  for (const [requested, editor, connected, inert, os] of [
    [false, true, true, false, "web"], [true, false, true, false, "web"],
    [true, true, false, false, "web"], [true, true, true, true, "web"],
    [true, true, true, false, "ios"],
  ] as const) {
    const focus = jest.fn(), duplicateEditorHandoff = { current: requested as boolean };
    evaluate(onExited, {
      duplicateEditorHandoff, editingStudent: editor ? { id: "qa-student" } : null,
      Platform: { OS: os }, document: { getElementById: () => ({ isConnected: connected, closest: () => inert ? {} : null, focus }) },
    })();
    expect(focus).not.toHaveBeenCalled();
    expect(duplicateEditorHandoff.current).toBe(false);
  }
});
