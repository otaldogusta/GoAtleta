import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";
import { CourtEditableTitle } from "../CourtEditableTitle";

describe("inline court title", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const commit = jest.fn();
  const mount = (disabled = false) => act(() => { tree = TestRenderer.create(React.createElement(CourtEditableTitle, { title: "Recepção", color: "#ffffff", disabled, onCommit: commit })); });
  const start = () => act(() => tree.root.findByProps({ accessibilityLabel: "Editar nome da quadra: Recepção" }).props.onPress());
  const change = (value: string) => act(() => tree.root.findByType(TextInput).props.onChangeText(value));
  beforeEach(() => commit.mockClear());
  afterEach(() => act(() => tree.unmount()));
  it("confirms one trimmed change on Enter, even if blur follows", () => {
    mount(); start(); change("  Saque  ");
    const input = tree.root.findByType(TextInput);
    expect(input.props.autoFocus).toBe(true);
    act(() => { input.props.onSubmitEditing(); input.props.onBlur(); });
    expect(commit.mock.calls).toEqual([["Saque"]]);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });
  it("confirms on leaving the input", () => {
    mount(); start(); change("Defesa");
    act(() => tree.root.findByType(TextInput).props.onBlur());
    expect(commit).toHaveBeenCalledWith("Defesa");
  });
  it("cancels on Escape without committing on the following blur", () => {
    mount(); start(); change("Cancelar");
    const input = tree.root.findByType(TextInput);
    act(() => { input.props.onKeyPress({ nativeEvent: { key: "Escape" }, stopPropagation: jest.fn() }); input.props.onBlur(); });
    expect(commit).not.toHaveBeenCalled();
  });
  it.each(["   ", "Recepção", " Recepção "])("keeps the original for empty or unchanged input %p", value => {
    mount(); start(); change(value);
    act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
    expect(commit).not.toHaveBeenCalled();
  });
  it("disables the edit trigger during document operations", () => {
    mount(true);
    expect(tree.root.findByProps({ accessibilityLabel: "Editar nome da quadra: Recepção" }).props.disabled).toBe(true);
  });
});
