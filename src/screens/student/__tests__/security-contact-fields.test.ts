import { createElement } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SecurityContactFields } from "../SecurityContactFields";
import type { useSecurityContactVerification } from "../useSecurityContactVerification";
const mockConfirm = jest.fn();
jest.mock("../../../ui/confirm-dialog", () => ({ useConfirmDialog: () => ({ confirm: mockConfirm }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
const model = (overrides = {}) => ({ draft: "email@example.com", verified: false, pending: true, status: { pendingEmail: "email@example.com" }, code: "", error: null, busy: false, retrySeconds: 0, canRequest: true, setCode: jest.fn(), setError: jest.fn(), run: jest.fn(), ...overrides } as unknown as ReturnType<typeof useSecurityContactVerification>);
const view = (m: ReturnType<typeof useSecurityContactVerification>) => render(createElement(SecurityContactFields, { model: m, Field: () => null, ErrorBalloon: () => null }));
it("renders eight cells and accepts a pasted, formatted code", () => {
  const m = model(); const ui = view(m);
  expect(ui.getAllByTestId(/security-code-cell-/, { includeHiddenElements: true })).toHaveLength(8);
  m.completeCode = jest.fn();
  ui.rerender(createElement(SecurityContactFields, { model: m, Field: () => null, ErrorBalloon: () => null }));
  fireEvent.changeText(ui.getByLabelText("Código de confirmação"), "1234 5678");
  expect(m.completeCode).toHaveBeenCalledWith("1234 5678");
});
it("shows verified icon and asks before removal", () => {
  const m = model({ verified: true, pending: false }); const ui = view(m);
  expect(ui.getByLabelText("E-mail confirmado")).toBeTruthy();
  fireEvent.press(ui.getByLabelText("Remover e-mail alternativo"));
  expect(mockConfirm).toHaveBeenCalled();
  expect(m.run).not.toHaveBeenCalled();
  mockConfirm.mock.calls.at(-1)[0].onConfirm();
  expect(m.run).toHaveBeenCalledWith("remove");
});
