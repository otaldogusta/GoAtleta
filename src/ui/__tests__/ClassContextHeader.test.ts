import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Text } from "react-native";
import { ClassContextHeader } from "../ClassContextHeader";
import { Pressable } from "../Pressable";
import { navigateBackOrReplace } from "../../navigation/safe-router";

jest.mock("expo-router", () => ({ useRouter: () => ({}) }));
jest.mock("../../navigation/safe-router", () => ({ navigateBackOrReplace: jest.fn() }));
jest.mock("../../hooks/use-is-online", () => ({ useIsOnline: () => true }));
jest.mock("../icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: {
  background: "#101827", text: "#fff", muted: "#aaa", border: "#222",
  secondaryBg: "#182234", infoBg: "#142133", infoText: "#abc",
} }) }));
jest.mock("../use-responsive-layout", () => ({ useResponsiveLayout: () => ({ density: {
  pageTitleFontSize: 16, pageTitleLineHeight: 22, sectionTitleFontSize: 14,
} }) }));

const props = {
  title: "Relatório da aula", className: "Voleibol QA", unit: "Unidade QA",
  ageBand: "14–17", gender: "misto" as const, dateLabel: "13/11/2026",
  timeLabel: "18:00", classColorKey: null,
};
let view: ReactTestRenderer;
afterEach(() => { if (view) act(() => view.unmount()); jest.clearAllMocks(); });

test("preserves the existing header and navigation when the optional action is absent", () => {
  act(() => { view = create(React.createElement(ClassContextHeader, props)); });
  const original = JSON.stringify(view.toJSON());
  const back = view.root.findAll(n => n.props.accessibilityLabel === "Voltar de Relatório da aula" && typeof n.props.onPress === "function")[0];
  const headerRow = back.parent!;
  expect(headerRow.findAllByType(Text).some(n => n.props.children === "Voleibol QA")).toBe(true);
  act(() => back.props.onPress());
  expect(navigateBackOrReplace).toHaveBeenCalledWith(expect.objectContaining({ fallback: "/classes" }));
  for (const headerAction of [null, false]) {
    act(() => view.update(React.createElement(ClassContextHeader, { ...props, headerAction })));
    expect(JSON.stringify(view.toJSON())).toBe(original);
  }
});

test("opens the provided assistant while retaining class context and schedule once", () => {
  const openAssistant = jest.fn();
  const headerAction = React.createElement(Pressable, {
    accessibilityRole: "button", accessibilityLabel: "Abrir Assistente do Relatório", onPress: openAssistant,
  });
  act(() => { view = create(React.createElement(ClassContextHeader, { ...props, headerAction })); });
  const action = view.root.findAll(n => n.props.accessibilityLabel === "Abrir Assistente do Relatório" && typeof n.props.onPress === "function")[0];
  act(() => action.props.onPress());
  expect(openAssistant).toHaveBeenCalledTimes(1);
  for (const label of ["Relatório da aula", "Voleibol QA", "Unidade QA", "Misto", "Data: 13/11/2026", "Horário: 18:00"]) {
    expect(view.root.findAllByType(Text).filter(n => n.props.children === label)).toHaveLength(1);
  }
});
