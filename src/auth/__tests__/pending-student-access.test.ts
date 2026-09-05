import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

const mockRefresh = jest.fn();
const mockResend = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn() };
let mockAccessStatus = "review_required";
const mockSession = { user: { id: "user", email: "student@example.test", app_metadata: { email_verified_hybrid_at: "verified" } } };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../auth", () => ({ useAuth: () => ({ session: mockSession, loading: false, signOut: jest.fn(), resendSignupCode: mockResend }) }));
jest.mock("../role", () => ({ useRole: () => ({ role: "pending", loading: false, refresh: mockRefresh, studentAccessResolution: mockAccessStatus }) }));
jest.mock("../../providers/OrganizationProvider", () => ({ useOrganization: () => ({ createOrganization: jest.fn() }) }));
jest.mock("../../api/student-invite", () => ({ claimStudentInvite: jest.fn() }));
jest.mock("../../api/trainer-invite", () => ({ claimTrainerInvite: jest.fn() }));
jest.mock("../../observability/perf", () => ({ markRender: jest.fn(), measureAsync: (_name: string, work: () => unknown) => work() }));
jest.mock("../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { background: "#101827", text: "#ffffff", muted: "#8899bb", border: "#334155", primaryBg: "#2dd482", primaryText: "#101827", card: "#1e293b" } }) }));
jest.mock("../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));

const PendingScreen = jest.requireActual("../../../app/pending").default;
const mountPending = async () => {
  render(React.createElement(PendingScreen));
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => { jest.clearAllMocks(); mockRefresh.mockResolvedValue(undefined); mockResend.mockResolvedValue(undefined); });

it.each([
  ["review_required", "Acesso aguardando liberação"],
  ["invite_required", "Entre pelo seu convite"],
  ["verification_required", "Confirme seu e-mail"],
  ["unavailable", "Não foi possível verificar seu acesso"],
])("renders %s without institution signup", async (status, title) => {
  mockAccessStatus = status;
  await mountPending();
  expect(screen.getByText(title)).toBeTruthy();
  expect(screen.queryByText("Quero gerenciar uma instituição")).toBeNull();
});

it("keeps the normal onboarding for unmatched accounts", async () => {
  mockAccessStatus = "not_found";
  await mountPending();
  expect(screen.getByText("Quero gerenciar uma instituição")).toBeTruthy();
});

it("requests the canonical code before opening email verification", async () => {
  mockAccessStatus = "verification_required";
  await mountPending();
  await act(async () => { fireEvent.press(screen.getByLabelText("Confirmar e-mail")); });
  expect(mockResend).toHaveBeenCalledWith("student@example.test", "verify-email");
  expect(mockRouter.push).toHaveBeenCalledWith("/verify-email?email=student%40example.test");
});

it("keeps the pending screen when code delivery fails", async () => {
  mockAccessStatus = "verification_required";
  mockResend.mockRejectedValue(new Error("offline"));
  await mountPending();
  await act(async () => { fireEvent.press(screen.getByLabelText("Confirmar e-mail")); });
  expect(screen.getByText("Não foi possível enviar o código. Tente novamente.")).toBeTruthy();
  expect(mockRouter.push).not.toHaveBeenCalled();
});
