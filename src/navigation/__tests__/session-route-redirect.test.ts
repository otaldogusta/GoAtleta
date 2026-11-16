import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = ts.createSourceFile(
  "session.tsx",
  readFileSync(resolve(__dirname, "../../../app/class/[id]/session.tsx"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const redirect = source.statements.find((node) =>
  ts.isFunctionDeclaration(node) && node.name?.text === "SessionRouteRedirect",
);
if (!redirect) throw new Error("SessionRouteRedirect not found");
const code = ts.transpileModule(`${redirect.getText(source)}; return SessionRouteRedirect;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
}).outputText;

// Execute only the real compatibility route; the embedded report screen is unrelated.
function runRedirect(params: { id?: string; date?: string }) {
  const router = { replace: jest.fn() };
  const useEffect = jest.fn((callback: () => void, _dependencies: unknown[]) => callback());
  const bindings = {
    React, useLocalSearchParams: () => params, useRouter: () => router,
    useEffect, ScreenLoadingState: () => null,
  };
  const component = new Function(...Object.keys(bindings), code)(...Object.values(bindings));
  component();
  return { router, dependencies: useEffect.mock.calls[0][1] };
}

test("keeps the lesson date when the old session route redirects to the class workspace", () => {
  const { router, dependencies } = runRedirect({ id: "class-qa", date: "2026-11-15" });
  expect(router.replace).toHaveBeenCalledWith({
    pathname: "/class/[id]", params: { id: "class-qa", date: "2026-11-15" },
  });
  expect(dependencies).toContain("2026-11-15");
});

test.each([undefined, ""])("keeps the existing class fallback when date is %s", (date) => {
  const { router } = runRedirect({ id: "class-qa", date });
  expect(router.replace).toHaveBeenCalledWith({ pathname: "/class/[id]", params: { id: "class-qa" } });
});

test("does not navigate before a class id is available", () => {
  const { router } = runRedirect({ date: "2026-11-15" });
  expect(router.replace).not.toHaveBeenCalled();
});
