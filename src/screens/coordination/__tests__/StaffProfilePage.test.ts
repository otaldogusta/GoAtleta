import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { StaffProfilePage } from "../StaffProfilePage";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", border: "#222", card: "#111", primaryBg: "#0f0" } }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle", Path: "Path", Rect: "Rect" }));
const base = { name: "Ana Silva", role: "Professor", organizationName: "Rede", classes: [{ id: "assigned", name: "Hipopótamos", unit: "Central" }], onBack: jest.fn() };
const buttons = (r: TestRenderer.ReactTestRenderer) => r.root.findAll(n => n.props.accessibilityRole === "button" && typeof n.props.onPress === "function");
describe("StaffProfilePage", () => {
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
