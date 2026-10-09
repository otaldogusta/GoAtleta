import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TextInput } from "react-native";
import { PersonProfilePage } from "../PersonProfilePage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", border: "#222", card: "#111", primaryBg: "#0f0" } }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle", Path: "Path", Rect: "Rect" }));

it("edits below the same header and preserves the caller's draft across tabs", () => {
  function Profile() {
    const [tab, setTab] = useState("overview");
    const [draft, setDraft] = useState("Ana");
    return React.createElement(PersonProfilePage, { name: "Ana", role: "Atleta", organizationName: "Rede", classes: [], ownProfile: true, onBack: jest.fn(), selectedTab: tab, onTabChange: setTab, onEditProfile: () => setTab("settings"), settingsContent: React.createElement(TextInput, { testID: "draft", value: draft, onChangeText: setDraft }) });
  }
  let view!: TestRenderer.ReactTestRenderer;
  act(() => { view = TestRenderer.create(React.createElement(Profile)); });
  const tab = (label: string) => view.root.findAll(n => n.props.accessibilityRole === "tab" && typeof n.props.onPress === "function").find(n => n.props.accessibilityLabel === label || n.findAll(x => x.props.children === label).length)!;
  expect(view.root.findAllByType(TextInput)).toHaveLength(0);
  act(() => tab("Configurações").props.onPress());
  expect(tab("Configurações").props.accessibilityState.selected).toBe(true);
  expect(view.root.findAllByType(Text).filter(n => n.props.accessibilityRole === "header" && n.props.children === "Meu perfil")).toHaveLength(1);
  act(() => view.root.findByType(TextInput).props.onChangeText("Ana editada"));
  act(() => tab("Visão geral").props.onPress());
  expect(view.root.findAllByType(TextInput)).toHaveLength(0);
  act(() => view.root.findAll(n => n.props.accessibilityRole === "button" && n.props.accessibilityLabel === "Editar perfil" && n.props.onPress)[0].props.onPress());
  expect(view.root.findByType(TextInput).props.value).toBe("Ana editada");
  expect(tab("Configurações").props.accessibilityState.selected).toBe(true);
  act(() => view.unmount());
});

it("does not expose settings when viewing another person", () => {
  let view!: TestRenderer.ReactTestRenderer;
  act(() => { view = TestRenderer.create(React.createElement(PersonProfilePage, { name: "Ana", role: "Atleta", organizationName: "Rede", classes: [], onBack: jest.fn(), selectedTab: "settings", settingsContent: React.createElement(TextInput) })); });
  expect(view.root.findAllByType(TextInput)).toHaveLength(0);
  expect(view.root.findAll(n => n.props.accessibilityLabel === "Configurações")).toHaveLength(0);
  act(() => view.unmount());
});

it("keeps the caller's workspace control on the own profile across tabs only", () => {
  const props = { name: "Ana", role: "Atleta", organizationName: "Rede", classes: [], onBack: jest.fn(), workspaceControl: React.createElement(Text, { testID: "workspace-control" }, "Workspace atual"), settingsContent: React.createElement(Text, null, "Dados pessoais") };
  let view!: TestRenderer.ReactTestRenderer;
  act(() => { view = TestRenderer.create(React.createElement(PersonProfilePage, { ...props, ownProfile: true })); });
  expect(view.root.findAllByType(Text).filter(n => n.props.testID === "workspace-control")).toHaveLength(1);
  act(() => { view.update(React.createElement(PersonProfilePage, { ...props, ownProfile: true, selectedTab: "settings" })); });
  expect(view.root.findAllByType(Text).filter(n => n.props.testID === "workspace-control")).toHaveLength(1);
  act(() => { view.update(React.createElement(PersonProfilePage, props)); });
  expect(view.root.findAllByType(Text).filter(n => n.props.testID === "workspace-control")).toHaveLength(0);
  act(() => view.unmount());
});
it("keeps classes and count visible during refresh and applies an empty final result", () => {
  const props = { name: "Ana", role: "Professora", organizationName: "Rede", classes: [{ id: "c1", name: "Turma existente", unit: "", daysOfWeek: [1], startTime: "14:00", endTime: "15:00" }] as any, onBack: jest.fn() };
  let view!: TestRenderer.ReactTestRenderer;
  act(() => { view = TestRenderer.create(React.createElement(PersonProfilePage, props)); });
  act(() => { view.update(React.createElement(PersonProfilePage, { ...props, loading: true })); });
  const during = JSON.stringify(view.toJSON());
  expect(during).toContain("Turma existente");
  expect(during).toContain("turmas atribuídas");
  expect(during).not.toContain("Carregando turmas");
  act(() => { view.update(React.createElement(PersonProfilePage, { ...props, loading: false, classes: [] })); });
  expect(JSON.stringify(view.toJSON())).toContain("Nenhuma turma vinculada");
  expect(JSON.stringify(view.toJSON())).not.toContain("Turma existente");
  act(() => view.unmount());
});
