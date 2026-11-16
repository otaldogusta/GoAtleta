import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { WhatsAppModal, type WhatsAppModalProps } from "../WhatsAppModal";
import { openWhatsApp } from "../../../../utils/whatsapp";

jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../../ui/ModalSheet", () => ({ ModalSheet: ({ children, dialogLabel }: any) => jest.requireActual("react").createElement(jest.requireActual("react-native").View, { accessibilityLabel: dialogLabel }, children) }));
jest.mock("../../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: ({ visible, layout, children }: any) => visible && layout ? children : null }));
jest.mock("../../../../ui/ConfirmCloseOverlay", () => ({ ConfirmCloseOverlay: () => null }));
jest.mock("../../../../utils/whatsapp", () => ({ ...jest.requireActual("../../../../utils/whatsapp"), openWhatsApp: jest.fn() }));

function props(): WhatsAppModalProps {
  return {
    visible: true, onClose: jest.fn(), cardStyle: {}, selectedStudentId: "qa-student",
    students: [{ id: "qa-student", name: "Atleta QA", organizationId: "qa-org", classId: "qa-class", phone: "11900000001", guardianPhone: "11900000002" }] as WhatsAppModalProps["students"],
    classById: new Map(), selectedContactType: "guardian", setSelectedContactType: jest.fn(),
    selectedTemplateId: null, selectedTemplateLabel: null, setSelectedTemplateId: jest.fn(), setSelectedTemplateLabel: jest.fn(),
    customFields: {}, setCustomFields: jest.fn(), customStudentMessage: "Mensagem fictícia", setCustomStudentMessage: jest.fn(),
    studentInviteBusy: false, showRevokeConfirm: false, setShowRevokeConfirm: jest.fn(), applyStudentInviteTemplate: jest.fn(),
    whatsappNotice: "", showTemplateList: false, setShowTemplateList: jest.fn(), showTemplateListContent: false,
    templateTriggerLayout: null, whatsappContainerWindow: null, templateListAnimStyle: {}, syncTemplateLayout: jest.fn(), closeAllPickers: jest.fn(),
    whatsappContainerRef: React.createRef(), templateTriggerRef: React.createRef(), groupInviteLinks: {}, colors: {} as WhatsAppModalProps["colors"],
    buildStudentMessage: jest.fn().mockReturnValue("Mensagem fictícia"),
  };
}

test("exposes contact selection and close without invoking an external send", () => {
  const value = props();
  const screen = render(React.createElement(WhatsAppModal, value));
  expect(screen.getByLabelText("Mensagem via WhatsApp")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Responsável,/, selected: true })).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: /Aluno,/ }));
  expect(value.setSelectedContactType).toHaveBeenCalledWith("student");
  screen.rerender(React.createElement(WhatsAppModal, { ...value, selectedContactType: "student" }));
  expect(screen.getByRole("button", { name: /Aluno,/, selected: true })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Mensagem", { exact: true }), "Nova mensagem QA");
  expect(value.setCustomStudentMessage).toHaveBeenCalledWith("Nova mensagem QA");
  fireEvent.press(screen.getByRole("button", { name: "Fechar WhatsApp" }));
  expect(value.onClose).toHaveBeenCalledTimes(1);
  expect(openWhatsApp).not.toHaveBeenCalled();
});

test("opens the model selector and exposes unavailable models as disabled", () => {
  const value = props();
  const screen = render(React.createElement(WhatsAppModal, value));
  fireEvent.press(screen.getByRole("button", { name: "Modelo de mensagem", expanded: false }));
  expect(value.syncTemplateLayout).toHaveBeenCalledTimes(1);
  expect(value.setShowTemplateList).toHaveBeenCalledWith(true);
  screen.rerender(React.createElement(WhatsAppModal, { ...value, showTemplateList: true, showTemplateListContent: true, templateTriggerLayout: { x: 10, y: 20, width: 320, height: 40 } }));
  expect(screen.getByRole("button", { name: "Modelo de mensagem", expanded: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Lembrete de aula", disabled: true })).toBeTruthy();
});

test("waits for the portalled list to mount and closes at Tab boundaries without losing the trigger", () => {
  const source = ts.createSourceFile("whatsapp.tsx", readFileSync(resolve("src/screens/students/modals/WhatsAppModal.tsx"), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let effect: ts.Node | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "useEffect" && node.arguments[0]?.getText(source).includes("handleTemplateKey")) effect = node.arguments[0];
    ts.forEachChild(node, visit);
  };
  visit(source); if (!effect) throw Error("Template focus effect missing");
  const code = ts.transpileModule(`return (${effect.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const frames: FrameRequestCallback[] = [];
  const options = [{ focus: jest.fn(), scrollIntoView: jest.fn() }, { focus: jest.fn(), scrollIntoView: jest.fn() }];
  const handlers = new Map<string, (event: any) => void>();
  const node = {
    querySelectorAll: () => options,
    addEventListener: jest.fn((type, handler) => handlers.set(type, handler)),
    removeEventListener: jest.fn((type, handler) => { if (handlers.get(type) === handler) handlers.delete(type); }),
  };
  const trigger = { focus: jest.fn() }, closeAllPickers = jest.fn(), templateWasOpen = { current: false };
  const scope = {
    Platform: { OS: "web" }, visible: true, showTemplateList: true, showTemplateListContent: true,
    templateListNode: null as typeof node | null, templateWasOpen,
    templateTriggerRef: { current: { querySelector: () => trigger } }, closeAllPickers,
    requestAnimationFrame: (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }, cancelAnimationFrame: jest.fn(),
  };
  const run = () => new Function(...Object.keys(scope), code)(...Object.values(scope))();
  expect(run()).toBeUndefined();
  expect(options[0].focus).not.toHaveBeenCalled();
  scope.templateListNode = node;
  const cleanup = run();
  frames.splice(0).forEach(frame => frame(0));
  expect(options[0].focus).toHaveBeenCalledWith({ preventScroll: true });
  const key = (index: number, shiftKey = false) => ({ key: "Tab", shiftKey, target: { closest: () => options[index] }, preventDefault: jest.fn() });
  const next = key(0); handlers.get("keydown")?.(next);
  expect(next.preventDefault).toHaveBeenCalled();
  expect(options[1].focus).toHaveBeenCalled();
  expect(options[1].scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  expect(closeAllPickers).not.toHaveBeenCalled();
  handlers.get("keydown")?.(key(1));
  expect(closeAllPickers).toHaveBeenCalledTimes(1);
  expect(trigger.focus).toHaveBeenCalled();
  handlers.get("keydown")?.(key(0, true));
  expect(closeAllPickers).toHaveBeenCalledTimes(2);
  cleanup();
  expect(handlers.has("keydown")).toBe(false);
  scope.showTemplateList = false;
  run();
  expect(templateWasOpen.current).toBe(false);
});

test("forwards the contact selection to the web renderer", () => {
  jest.replaceProperty(Platform, "OS", "web");
  try {
    const value = props();
    const screen = render(React.createElement(WhatsAppModal, value));
    expect(screen.getByRole("button", { name: /Responsável,/ }).props["aria-pressed"]).toBe(true);
    expect(screen.getByRole("button", { name: /Aluno,/ }).props["aria-pressed"]).toBe(false);
    expect(screen.getByRole("button", { name: "Modelo de mensagem", expanded: false })).toBeTruthy();
  } finally { jest.restoreAllMocks(); }
});
