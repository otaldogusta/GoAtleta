import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { StaffInviteSignupForm } from "../StaffInviteSignupForm";

jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ mode: "dark", colors: { text: "white", inputBg: "black", muted: "gray" } }) }));
jest.mock("../../../ui/Button", () => ({ Button: ({ label, disabled, onPress }: any) => require("react").createElement(require("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: label, accessibilityState: { disabled }, disabled, onPress }) }));

describe("new employee signup", () => {
  it("requires a valid name and matching password before submitting once", () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onChange = jest.fn();
    const screen = render(React.createElement(StaffInviteSignupForm, { busy: false, error: "", onSubmit, onChange }));
    const button = screen.getByRole("button", { name: "Concluir e entrar" });
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Nome"), " Ana  Silva ");
    fireEvent.changeText(screen.getByLabelText("Criar senha"), "secret123");
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "wrong123");
    expect(button.props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(screen.getByLabelText("Confirmar senha"), "secret123");
    expect(button.props.accessibilityState.disabled).toBe(false);
    fireEvent.press(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ full_name: "Ana Silva", password: "secret123" });
    expect(onChange).toHaveBeenCalledTimes(4);
  });
  it("keeps fields locked during completion and displays a single error", () => {
    const screen = render(React.createElement(StaffInviteSignupForm, { busy: true, error: "Falha no cadastro", onSubmit: jest.fn(), onChange: jest.fn() }));
    expect(screen.getByLabelText("Nome").props.editable).toBe(false);
    expect(screen.getByRole("button", { name: "Concluindo..." }).props.accessibilityState.disabled).toBe(true);
    expect(screen.getAllByText("Falha no cadastro")).toHaveLength(1);
  });
});
