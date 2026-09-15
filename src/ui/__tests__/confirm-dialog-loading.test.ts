import { createElement } from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import { ConfirmDialogProvider, useConfirmDialog } from "../confirm-dialog";
jest.mock("../app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../ModalSheet", () => ({ ModalSheet: ({ children }: { children: unknown }) => children }));
let dialog: ReturnType<typeof useConfirmDialog>;
// eslint-disable-next-line react-hooks/globals -- test harness captures the provider API for imperative assertions.
function Consumer() { dialog = useConfirmDialog(); return null; }
it("waits for removal, blocks duplicate clicks, and closes after completion", async () => {
  const ui = render(createElement(ConfirmDialogProvider, null, createElement(Consumer)));
  let finish!: () => void;
  const task = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  let answer!: Promise<boolean>;
  act(() => { answer = dialog.confirm({ title: "Remover?", message: "Teste", confirmLabel: "Remover", cancelLabel: "Cancelar", onConfirm: task }); });
  fireEvent.press(ui.getByText("Remover"));
  expect(ui.getByText("Removendo…")).toBeTruthy();
  fireEvent.press(ui.getByText("Removendo…"));
  fireEvent.press(ui.getByText("Cancelar"));
  expect(task).toHaveBeenCalledTimes(1);
  expect(ui.getByText("Remover?")).toBeTruthy();
  await act(async () => { finish(); await answer; });
  expect(ui.queryByText("Remover?")).toBeNull();
});
it("keeps the confirmation open on rejection and allows retry", async () => {
  const ui = render(createElement(ConfirmDialogProvider, null, createElement(Consumer)));
  const task = jest.fn().mockRejectedValueOnce(new Error("Falha temporária")).mockResolvedValueOnce(undefined);
  act(() => { void dialog.confirm({ title: "Remover?", message: "Teste", confirmLabel: "Remover", cancelLabel: "Cancelar", onConfirm: task }); });
  await act(async () => { fireEvent.press(ui.getByText("Remover")); });
  expect(ui.getByText("Remover?")).toBeTruthy();
  await act(async () => { fireEvent.press(ui.getByText("Remover")); });
  expect(task).toHaveBeenCalledTimes(2);
  expect(ui.queryByText("Remover?")).toBeNull();
});
