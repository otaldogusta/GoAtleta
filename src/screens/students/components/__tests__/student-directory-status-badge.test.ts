import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { StudentDirectoryStatusBadge } from "../StudentDirectoryStatusBadge";
import { resolveStudentDirectoryStatus } from "../../application/student-list-status";

jest.mock("../../../../ui/app-theme", () => ({
  useAppTheme: () => ({ colors: { textMuted: "#999999", muted: "#999999", border: "#333333", successText: "#22cc88", successBg: "#113322" } }),
}));
jest.mock("../../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: () => null }));

const student = { membershipStatus: "active" as const, isExperimental: false, studentUserId: null };

describe("directory status badge", () => {
  it("keeps preregistration readable and exposes its reason without permanent subtext", () => {
    const status = resolveStudentDirectoryStatus(student, "none");
    const view = render(React.createElement(StudentDirectoryStatusBadge, { status }));
    expect(StyleSheet.flatten(view.getByText("Ativo").props.style).color).toBe("#999999");
    expect(view.getByLabelText("Cadastro: Ativo").props.accessibilityHint).toBe(status.reason);
    expect(view.queryByText(status.reason)).toBeNull();
    const stopPropagation = jest.fn();
    fireEvent.press(view.getByLabelText("Cadastro: Ativo"), { stopPropagation });
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("uses success styling only after access is linked", () => {
    const status = resolveStudentDirectoryStatus(student, "active");
    const view = render(React.createElement(StudentDirectoryStatusBadge, { status }));
    expect(StyleSheet.flatten(view.getByText("Ativo").props.style).color).toBe("#22cc88");
  });
});
