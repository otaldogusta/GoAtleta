import { createElement, useState } from "react";
import { Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";

import { AssistantComposer } from "../AssistantComposer";

let mockVoiceActiveChange: ((active: boolean) => void) | undefined;
jest.mock("../../../ui/app-theme", () => ({
  useAppTheme: () => ({ colors: {} }),
}));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../screens/session/components/LessonVoiceInput", () => ({
  LessonVoiceInput: ({ onActiveChange }: { onActiveChange: (active: boolean) => void }) => {
    mockVoiceActiveChange = onActiveChange;
    return null;
  },
}));

function Composer({ onSend, busy = false }: { onSend: () => void; busy?: boolean }) {
  const [value, setValue] = useState("");
  return createElement(AssistantComposer, {
    value, onChangeText: setValue, onSend, busy,
    trailingControl: createElement(Text, null, "Automático"),
    voiceScope: { organizationId: "organization" },
  });
}

beforeEach(() => { mockVoiceActiveChange = undefined; });

test("keeps one editor and its draft while the composer moves between narrow and wide layouts", () => {
  const onSend = jest.fn();
  const screen = render(createElement(Composer, { onSend }));
  const input = screen.getByLabelText("Mensagem para o assistente");
  fireEvent.changeText(input, "Planejar a próxima aula");

  for (const width of [320, 740, 390, 1024]) {
    fireEvent(screen.getByTestId("assistant-composer"), "layout", { nativeEvent: { layout: { width, height: 100, x: 0, y: 0 } } });
    expect(screen.getByLabelText("Mensagem para o assistente")).toBe(input);
    expect(input.props.value).toBe("Planejar a próxima aula");
    expect(screen.getAllByText("Automático")).toHaveLength(1);
  }

  fireEvent.press(screen.getByRole("button", { name: "Enviar mensagem" }));
  expect(onSend).toHaveBeenCalledTimes(1);
});

test("preserves the draft during voice handoff and keeps submission blocked while busy", () => {
  const onSend = jest.fn();
  const screen = render(createElement(Composer, { onSend }));
  fireEvent.changeText(screen.getByLabelText("Mensagem para o assistente"), "Rascunho");
  act(() => { mockVoiceActiveChange?.(true); });
  expect(screen.queryByRole("button", { name: "Enviar mensagem" })).toBeNull();
  act(() => { mockVoiceActiveChange?.(false); });
  expect(screen.getByLabelText("Mensagem para o assistente").props.value).toBe("Rascunho");

  screen.rerender(createElement(Composer, { onSend, busy: true }));
  expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeDisabled();
  expect(screen.getByLabelText("Mensagem para o assistente")).toHaveProp("editable", false);
  expect(onSend).not.toHaveBeenCalled();
});
