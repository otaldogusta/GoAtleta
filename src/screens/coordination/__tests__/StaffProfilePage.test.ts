import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text, TextInput } from "react-native";
import { StaffProfilePage } from "../StaffProfilePage";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", border: "#222", card: "#111", primaryBg: "#0f0" } }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle", Path: "Path", Rect: "Rect" }));
const base = { name: "Ana Silva", role: "Professor", organizationName: "Rede", classes: [{ id: "assigned", name: "Hipopótamos", unit: "Central" }], onBack: jest.fn() };
const buttons = (r: TestRenderer.ReactTestRenderer) => r.root.findAll(n => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");
describe("StaffProfilePage", () => {
  it.each(["Professor", "Coordenação"])("embeds %s settings under the same profile and preserves the draft across tabs", (role) => {
    function OwnProfile() {
      const [tab, setTab] = React.useState("overview");
      const [name, setName] = React.useState("Ana");
      return React.createElement(StaffProfilePage, { ...base, role, ownProfile: true, selectedTab: tab, onTabChange: setTab, onEditProfile: () => setTab("settings"), workspaceControl: React.createElement(Text, { testID: "workspace" }, "Rede"), roleControl: React.createElement(Text, { testID: "role" }, role), settingsContent: React.createElement(TextInput, { value: name, onChangeText: setName }) });
    }
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(React.createElement(OwnProfile)); });
    const tab = (label: string) => r.root.findAll(n => n.props.accessibilityRole === "tab" && typeof n.props.onPress === "function").find(n => n.props.accessibilityLabel === label || n.findAll(x => x.props.children === label).length)!;
    act(() => tab("Configurações").props.onPress());
    expect(r.root.findAllByType(Text).filter(n => n.props.children === "Meu perfil" && n.props.accessibilityRole === "header")).toHaveLength(1);
    expect(r.root.findAllByType(Text).filter(n => n.props.testID === "workspace")).toHaveLength(1);
    act(() => r.root.findByType(TextInput).props.onChangeText("Ana editada"));
    act(() => tab("Visão geral").props.onPress());
    expect(r.root.findAllByType(TextInput)).toHaveLength(0);
    act(() => buttons(r).find(n => n.props.accessibilityLabel === "Editar perfil")!.props.onPress());
    expect(r.root.findByType(TextInput).props.value).toBe("Ana editada");
    act(() => r.unmount());
  });
  it("opens own settings from a named tab without exposing account controls on colleagues", () => {
    const settings = jest.fn(); let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(React.createElement(StaffProfilePage, { ...base, ownProfile: true, onSettings: settings })); });
    const settingsTab = r.root.findAll(n => n.props.accessibilityRole === "tab" && n.props.accessibilityLabel === "Configurações" && typeof n.props.onPress === "function")[0];
    expect(settingsTab.props.accessibilityState.selected).toBe(false);
    act(() => settingsTab.props.onPress());
    expect(settings).toHaveBeenCalledTimes(1);
    act(() => r.update(React.createElement(StaffProfilePage, { ...base, onSettings: settings })));
    expect(r.root.findAll(n => n.props.accessibilityLabel === "Configurações")).toHaveLength(0);
    act(() => r.unmount());
  });
  it("keeps a colleague profile read-only and opens management separately", () => {
    const manage = jest.fn(); let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(React.createElement(StaffProfilePage, { ...base, onManageAccess: manage })); });
    expect(JSON.stringify(r.toJSON())).toContain("Hipopótamos");
    expect(JSON.stringify(r.toJSON())).not.toContain("Editar foto do perfil");
    expect(r.root.findAll(n => n.props.accessibilityRole === "checkbox")).toHaveLength(0);
    act(() => buttons(r).find(n => n.props.accessibilityLabel === "Gerenciar acesso")!.props.onPress());
    expect(manage).toHaveBeenCalledTimes(1); act(() => r.unmount());
  });
  it("connects own photo and personal editing to caller actions", () => {
    const photo = jest.fn(), edit = jest.fn(); let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(React.createElement(StaffProfilePage, { ...base, ownProfile: true, onEditPhoto: photo, onEditProfile: edit })); });
    act(() => buttons(r).find(n => n.props.accessibilityLabel === "Editar foto do perfil")!.props.onPress());
    act(() => buttons(r).find(n => n.props.accessibilityLabel === "Editar perfil")!.props.onPress());
    expect(photo).toHaveBeenCalledTimes(1); expect(edit).toHaveBeenCalledTimes(1); act(() => r.unmount());
  });
  it("does not invent zero assignments after an error or during loading", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(React.createElement(StaffProfilePage, { ...base, classes: [], loading: true })); });
    expect(JSON.stringify(r.toJSON())).not.toContain("Nenhuma turma vinculada.");
    act(() => r.update(React.createElement(StaffProfilePage, { ...base, classes: [], error: true })));
    expect(JSON.stringify(r.toJSON())).toContain("Não foi possível carregar");
    expect(JSON.stringify(r.toJSON())).not.toContain("Nenhuma turma vinculada."); act(() => r.unmount());
  });
});
