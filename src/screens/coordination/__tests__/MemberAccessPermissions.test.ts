import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { MEMBER_PERMISSION_OPTIONS } from "../../../api/members";
import { MemberAccessPermissions, MEMBER_PERMISSION_GROUPS } from "../MemberAccessPermissions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));

describe("member access groups", () => {
  it("covers every existing permission exactly once", () => {
    const keys = MEMBER_PERMISSION_GROUPS.flatMap(group => group.keys);
    expect(keys.slice().sort()).toEqual(MEMBER_PERMISSION_OPTIONS.map(option => option.key).sort());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("explains dependencies without silently granting another permission", () => {
    const onChange = jest.fn(); let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(React.createElement(MemberAccessPermissions, { selected: [], roleLevel: 10, disabled: false, protectOwnManagement: false, onChange })); });
    const row = r.root.findAll(n => n.props.accessibilityRole === "checkbox" && n.props.accessibilityLabel === "Criar turmas" && typeof n.props.onPress === "function")[0];
    expect(JSON.stringify(r.toJSON())).toContain("Para usar, libere também o acesso a Turmas.");
    act(() => row.props.onPress());
    expect(onChange).toHaveBeenCalledWith(["classes_create"]);
    for (const option of MEMBER_PERMISSION_OPTIONS) expect(JSON.stringify(r.toJSON())).toContain(option.description);
    act(() => r.unmount());
  });

  it("shows effective administrator access and protects own management", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(React.createElement(MemberAccessPermissions, { selected: [], roleLevel: 50, disabled: false, protectOwnManagement: false, onChange: jest.fn() })); });
    const rows = () => r.root.findAll(n => n.props.accessibilityRole === "checkbox" && typeof n.props.onPress === "function");
    expect(rows().every(n => n.props.accessibilityState.checked && n.props.disabled)).toBe(true);
    act(() => r.update(React.createElement(MemberAccessPermissions, { selected: [], roleLevel: 10, disabled: false, protectOwnManagement: true, onChange: jest.fn() })));
    const management = rows().find(n => n.props.accessibilityLabel === "Gestão de membros")!;
    expect(management.props.accessibilityState).toEqual({ checked: true, disabled: true });
    act(() => r.update(React.createElement(MemberAccessPermissions, { selected: [], roleLevel: 10, disabled: true, protectOwnManagement: false, onChange: jest.fn() })));
    expect(rows().every(n => n.props.disabled)).toBe(true);
    act(() => r.unmount());
  });
});
