import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { OrgMember } from "../../../api/members";
import { MemberProfileOverview } from "../MemberProfileOverview";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", primaryBg: "#0f0", primaryText: "#000", infoText: "#88f" } }) }));

const member: OrgMember = { userId: "member", organizationId: "org", displayName: "Ana Silva", email: null, roleLevel: 10, createdAt: "2026-01-01", lastAccessAt: null };
const classes = [{ id: "assigned", name: "Hipopótamos", unit: "Unidade Central", daysOfWeek: [1, 3], startTime: "18:00", endTime: "19:00" }];

describe("MemberProfileOverview", () => {
  it("shows a read-only profile and its assigned classes, with a separate access action", () => {
    const onManageAccess = jest.fn();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(React.createElement(MemberProfileOverview, { member, organizationName: "Rede", assignedClasses: classes, loading: false, onManageAccess })); });
    const output = JSON.stringify(renderer.toJSON());
    expect(output).toContain("Ana Silva");
    expect(output).toContain("Hipopótamos");
    expect(output).toContain("Unidade Central");
    expect(renderer.root.findAll((node) => node.props.accessibilityRole === "checkbox")).toHaveLength(0);
    const action = renderer.root.findAll((node) => node.props.accessibilityRole === "button" && typeof node.props.onPress === "function")[0];
    act(() => { action.props.onPress(); });
    expect(onManageAccess).toHaveBeenCalledTimes(1);
    act(() => renderer.unmount());
  });

  it("does not show an empty assignment state while data is loading", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(React.createElement(MemberProfileOverview, { member, organizationName: "Rede", assignedClasses: [], loading: true, onManageAccess: jest.fn() })); });
    const output = JSON.stringify(renderer.toJSON());
    expect(output).toContain("Carregando turmas...");
    expect(output).not.toContain("Nenhuma turma vinculada.");
    act(() => renderer.unmount());
  });
});
