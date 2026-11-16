import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import StudentInviteScreen from "../../../../app/invite/[token]";
import { validateStudentInvite, claimStudentInvite } from "../../../api/student-invite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const mockRefresh = jest.fn();
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ token: "qa-invite" }), useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: null }) }));
jest.mock("../../../auth/role", () => ({ useRole: () => ({ role: "pending", loading: false, refresh: mockRefresh }) }));
jest.mock("../../../auth/pending-invite", () => ({ savePendingInvite: jest.fn().mockResolvedValue(undefined), clearPendingInvite: jest.fn(), requiresInviteEmailVerification: jest.fn() }));
jest.mock("../../../api/student-invite", () => ({ validateStudentInvite: jest.fn(), claimStudentInvite: jest.fn() }));
jest.mock("../../../api/config", () => ({ ENABLE_SOCIAL_LOGIN: false }));
jest.mock("../../../observability/perf", () => ({ markRender: jest.fn(), measureAsync: (_name: string, run: () => Promise<unknown>) => run() }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../components/ui/ScreenBackdrop", () => ({ ScreenBackdrop: () => null }));
jest.mock("../../../ui/ScreenHeader", () => ({ ScreenHeader: () => null }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));

beforeEach(() => { jest.clearAllMocks(); jest.mocked(validateStudentInvite).mockResolvedValue({} as never); });

test("renders visibility controls only for filled password fields, preserving text and mode", async () => {
  const screen = render(React.createElement(StudentInviteScreen));
  await act(async () => { await Promise.resolve(); });
  expect(screen.queryByRole("button", { name: "Mostrar senha", includeHiddenElements: true })).toBeNull();
  expect(screen.queryByRole("button", { name: "Mostrar confirmação de senha", includeHiddenElements: true })).toBeNull();
  fireEvent.changeText(screen.getByLabelText("Senha", { exact: true }), "Senha QA");
  fireEvent.press(screen.getByRole("button", { name: "Mostrar senha" }));
  expect(screen.getByLabelText("Senha", { exact: true }).props.secureTextEntry).toBe(false);
  fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "Senha QA");
  fireEvent.press(screen.getByRole("button", { name: "Mostrar confirmação de senha" }));
  expect(screen.getByLabelText("Confirmar senha").props.secureTextEntry).toBe(false);
  fireEvent.changeText(screen.getByLabelText("Senha", { exact: true }), "");
  fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "");
  expect(screen.queryByRole("button", { name: /Ocultar.*senha/, includeHiddenElements: true })).toBeNull();
  fireEvent.press(screen.getByRole("tab", { name: "Entrar" }));
  expect(screen.queryByLabelText("Confirmar senha")).toBeNull();
  expect(screen.getByRole("tab", { name: "Entrar", selected: true })).toBeTruthy();
  expect(claimStudentInvite).not.toHaveBeenCalled();
});

test("activates the actual tab keyboard handler with Space, Enter and arrows without submitting auth", () => {
  const source = ts.createSourceFile("invite.tsx", readFileSync(resolve("app/invite/[token].tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleKey") callback = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!callback) throw Error("Tab keyboard handler missing");
  const tabs = [{ focus: jest.fn() }, { focus: jest.fn() }], setMode = jest.fn();
  const code = ts.transpileModule(`return (${callback.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const handle = new Function("node", "setMode", code)({ querySelectorAll: () => tabs }, setMode);
  const event = (key: string, index = 1) => ({ key, target: { closest: () => tabs[index] }, preventDefault: jest.fn() });
  const space = event(" "); handle(space);
  expect(space.preventDefault).toHaveBeenCalled();
  expect(setMode).toHaveBeenLastCalledWith("login");
  handle(event("Enter", 0)); expect(setMode).toHaveBeenLastCalledWith("signup");
  handle(event("ArrowRight", 0)); expect(setMode).toHaveBeenLastCalledWith("login");
  handle(event("Home")); expect(setMode).toHaveBeenLastCalledWith("signup");
  const count = setMode.mock.calls.length;
  handle({ ...event(" "), ctrlKey: true }); handle(event("Tab"));
  expect(setMode).toHaveBeenCalledTimes(count);
  expect(claimStudentInvite).not.toHaveBeenCalled();
});
