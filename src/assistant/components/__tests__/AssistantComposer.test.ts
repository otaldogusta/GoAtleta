import { createElement, useState } from "react";
import { Platform, StyleSheet, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

import { AssistantComposer } from "../AssistantComposer";

let mockVoiceActiveChange: ((active: boolean) => void) | undefined;
let mockVoiceText: ((text: string) => void) | undefined;
jest.mock("../../../ui/app-theme", () => ({
  useAppTheme: () => ({ colors: {} }),
}));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../screens/session/components/LessonVoiceInput", () => ({
  LessonVoiceInput: ({ onActiveChange, onText }: { onActiveChange: (active: boolean) => void; onText: (text: string) => void }) => {
    mockVoiceActiveChange = onActiveChange;
    mockVoiceText = onText;
    return null;
  },
}));

function Composer({ onSend, busy = false, variant }: { onSend: () => void; busy?: boolean; variant?: "inline" | "page" }) {
  const [value, setValue] = useState("");
  return createElement(AssistantComposer, {
    value, onChangeText: setValue, onSend, busy, variant,
    trailingControl: createElement(Text, null, "Automático"),
    voiceScope: { organizationId: "organization" },
  });
}

beforeEach(() => { mockVoiceActiveChange = undefined; mockVoiceText = undefined; });

test.each([undefined, "page"] as const)("keeps one editor and its draft across widths in the %s variant", variant => {
  const onSend = jest.fn();
  const screen = render(createElement(Composer, { onSend, variant }));
  const input = screen.getByLabelText("Mensagem para o assistente");
  fireEvent.changeText(input, "Planejar a próxima aula");

  for (const width of [320, 740, 390, 1024]) {
    fireEvent(screen.getByTestId("assistant-composer"), "layout", { nativeEvent: { layout: { width, height: 100, x: 0, y: 0 } } });
    expect(screen.getByLabelText("Mensagem para o assistente")).toBe(input);
    expect(input.props.value).toBe("Planejar a próxima aula");
    expect(screen.getAllByText("Automático")).toHaveLength(1);
    expect(Boolean(screen.queryByRole("button", { name: "Escrever mensagem" }))).toBe(variant !== "page");
  }

  fireEvent.press(screen.getByRole("button", { name: "Enviar mensagem" }));
  expect(onSend).toHaveBeenCalledTimes(1);
});

test.each([undefined, "page"] as const)("preserves voice transcription and blocks submission while busy in the %s variant", variant => {
  const onSend = jest.fn();
  const screen = render(createElement(Composer, { onSend, variant }));
  fireEvent.changeText(screen.getByLabelText("Mensagem para o assistente"), "Rascunho");
  act(() => { mockVoiceActiveChange?.(true); });
  expect(screen.queryByRole("button", { name: "Enviar mensagem" })).toBeNull();
  act(() => { mockVoiceActiveChange?.(false); });
  expect(screen.getByLabelText("Mensagem para o assistente").props.value).toBe("Rascunho");
  act(() => { mockVoiceText?.("Fala transcrita"); });
  expect(screen.getByLabelText("Mensagem para o assistente").props.value).toBe("Rascunho\nFala transcrita");

  screen.rerender(createElement(Composer, { onSend, busy: true, variant }));
  expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  expect(screen.getByLabelText("Mensagem para o assistente")).toHaveProp("editable", false);
  expect(onSend).not.toHaveBeenCalled();
});

test("keeps multiline editing, Enter submission and 44px send target on the dedicated page", () => {
  const platform = Object.getOwnPropertyDescriptor(Platform, "OS")!;
  Object.defineProperty(Platform, "OS", { configurable: true, value: "web" });
  try {
    const onSend = jest.fn();
    const screen = render(createElement(Composer, { onSend, variant: "page" }));
    const input = screen.getByLabelText("Mensagem para o assistente");
    const enter = (shiftKey: boolean) => {
      const event = { nativeEvent: { key: "Enter", shiftKey }, preventDefault: jest.fn() };
      fireEvent(input, "keyPress", event);
      return event;
    };
    enter(false);
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.changeText(input, "Primeira linha\nSegunda linha");
    expect(enter(true).preventDefault).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    expect(enter(false).preventDefault).toHaveBeenCalled();
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(input.props.multiline).toBe(true);
    expect(StyleSheet.flatten(input.props.style)).toEqual(expect.objectContaining({ fontSize: 14, lineHeight: 20 }));
    expect(StyleSheet.flatten(screen.getByRole("button", { name: "Enviar mensagem" }).props.style)).toEqual(expect.objectContaining({ width: 44, height: 44 }));
  } finally {
    Object.defineProperty(Platform, "OS", platform);
  }
});
