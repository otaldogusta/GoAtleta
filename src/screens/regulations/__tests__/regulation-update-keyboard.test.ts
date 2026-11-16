import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

function loadKeyboardHandler(openSource: jest.Mock) {
  const source = ts.createSourceFile("regulation-history.tsx", readFileSync(resolve("app/regulation-history.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleUpdateKeyDown" && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!callback) throw new Error("The update keyboard handler was not found");
  const code = ts.transpileModule(`return (${callback.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function("openSource", code)(openSource);
}

const keyEvent = (key: string, extra = {}) => ({ key, repeat: false, defaultPrevented: false, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, preventDefault: jest.fn(), ...extra });

test("Enter opens the captured source once and ignores held-key repeats", () => {
  const openSource = jest.fn().mockResolvedValue(undefined);
  const handle = loadKeyboardHandler(openSource);
  const event = keyEvent("Enter");
  handle(event, "https://example.test/qa-update.pdf");
  handle(keyEvent("Enter", { repeat: true }), "https://example.test/qa-update.pdf");
  expect(event.preventDefault).toHaveBeenCalledTimes(1);
  expect(openSource).toHaveBeenCalledTimes(1);
  expect(openSource).toHaveBeenCalledWith("https://example.test/qa-update.pdf");
});

test("Tab, Space and arrows preserve their normal navigation behavior", () => {
  const openSource = jest.fn();
  const handle = loadKeyboardHandler(openSource);
  for (const key of ["Tab", " ", "ArrowDown", "Escape"]) {
    const event = keyEvent(key);
    handle(event, "https://example.test/qa-update.pdf");
    expect(event.preventDefault).not.toHaveBeenCalled();
  }
  expect(openSource).not.toHaveBeenCalled();
});

test("modified or already handled Enter never opens an external source", () => {
  const openSource = jest.fn();
  const handle = loadKeyboardHandler(openSource);
  for (const flag of ["altKey", "ctrlKey", "metaKey", "shiftKey", "defaultPrevented"]) {
    const event = keyEvent("Enter", { [flag]: true });
    handle(event, "https://example.test/qa-update.pdf");
    expect(event.preventDefault).not.toHaveBeenCalled();
  }
  expect(openSource).not.toHaveBeenCalled();
});
