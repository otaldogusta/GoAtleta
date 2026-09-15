import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

const mockRefresh = jest.fn();
const mockResend = jest.fn();
const mockSearchOrganizations = jest.fn();
const mockListRequests = jest.fn();
const mockRequestAthlete = jest.fn();
let mockReturnTo: string | undefined;
const mockClaimTrainerInvite = jest.fn();
const mockResumeStaffSignup = jest.fn();
const mockRouter = { replace: jest.fn(), push: jest.fn() };
let mockAccessStatus = "review_required";
let mockStaffSetupRequired = false;
const mockSession = { user: { id: "user", email: "student@example.test", app_metadata: { email_verified_hybrid_at: "verified", staff_invite_setup_required: false } }, access_token: "token", refresh_token: "refresh", expires_at: 4_000_000_000 };
const getMockSession = () => {
  mockSession.user.app_metadata.staff_invite_setup_required = mockStaffSetupRequired;
  return mockSession;
};

jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ returnTo: mockReturnTo }),
}));
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../auth", () => ({ useAuth: () => ({ session: getMockSession(), loading: false, signOut: jest.fn(), resendSignupCode: mockResend }) }));
jest.mock("../role", () => ({ useRole: () => ({ role: "pending", loading: false, refresh: mockRefresh, studentAccessResolution: mockAccessStatus }) }));
jest.mock("../../api/student-invite", () => ({ claimStudentInvite: jest.fn() }));
jest.mock("../../api/staff-invite", () => ({ resumeStaffSignup: (...args: unknown[]) => mockResumeStaffSignup(...args) }));
jest.mock("../../api/trainer-invite", () => ({ claimTrainerInvite: (...args: unknown[]) => mockClaimTrainerInvite(...args) }));
jest.mock("../../api/organization-access-requests", () => ({
  listMyOrganizationAccessRequests: (...args: unknown[]) => mockListRequests(...args),
  searchAccessRequestOrganizations: (...args: unknown[]) => mockSearchOrganizations(...args),
}));
jest.mock("../../api/family-access-request", () => ({ familyAccessErrorMessage: () => "Não foi possível concluir.", requestFamilyAccess: (...args: unknown[]) => mockRequestAthlete(...args) }));
jest.mock("../../observability/perf", () => ({ markRender: jest.fn(), measureAsync: (_name: string, work: () => unknown) => work() }));
jest.mock("../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { background: "#101827", text: "#ffffff", muted: "#8899bb", border: "#334155", primaryBg: "#2dd482", primaryText: "#101827", card: "#1e293b" } }) }));
jest.mock("../../ui/icon-registry", () => ({ GoAtletaIcon: () => null, PixLogoIcon: () => null }));
jest.mock("../../ui/AnchoredDropdown", () => ({
  AnchoredDropdown: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? children : null,
}));

const PendingScreen = jest.requireActual("../../../app/pending").default;
const mountPending = async () => {
  render(React.createElement(PendingScreen));
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockReturnTo = undefined;
  mockAccessStatus = "not_found";
  mockListRequests.mockResolvedValue([]);
  mockRequestAthlete.mockResolvedValue("request");
  mockRefresh.mockResolvedValue(undefined);
  mockResend.mockResolvedValue(undefined);
  mockSearchOrganizations.mockResolvedValue([
    { id: "org-1", name: "Rede Esportes Pinhais" },
    { id: "org-2", name: "Instituto Campeões" },
  ]);
  mockClaimTrainerInvite.mockResolvedValue({ status: "ok" });
  mockResumeStaffSignup.mockResolvedValue({ setup_required: true, organization_id: "org-1" });
  mockStaffSetupRequired = false;
});

it("submits an athlete link from profile without choosing a staff plan", async () => {
  mockReturnTo = "/student/profile";
  mockAccessStatus = "not_found";
  await mountPending();
  fireEvent.press(screen.getByText("Sou atleta"));
  fireEvent.changeText(screen.getByLabelText("Seu nome no cadastro de atleta"), "Ana Teste");
  fireEvent(screen.getByLabelText("Buscar instituição"), "focus");
  await waitFor(() => expect(screen.getByLabelText("Selecionar Rede Esportes Pinhais")).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Selecionar Rede Esportes Pinhais"));
  await act(async () => { fireEvent.press(screen.getByText("Solicitar vínculo")); });
  expect(mockRequestAthlete).toHaveBeenCalledWith({ organizationId: "org-1", kind: "athlete", studentName: "Ana Teste", relationshipLabel: "" });
});

it("offers explicit correction for a legacy staff request from the athlete profile", async () => {
  mockReturnTo = "/student/profile";
  mockListRequests.mockResolvedValue([{ id: "r", organizationId: "org-1", organizationName: "Rede", status: "pending", requestKind: "staff" }]);
  await mountPending();
  fireEvent.press(screen.getByText("Corrigir vínculo solicitado"));
  expect(mockRequestAthlete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Sou responsável"));
  fireEvent.changeText(screen.getByLabelText("Nome do atleta"), "Ana Teste");
  fireEvent.changeText(screen.getByLabelText("Parentesco"), "Mãe");
  await act(async () => { fireEvent.press(screen.getByText("Enviar correção")); });
  expect(mockRequestAthlete).toHaveBeenCalledWith({ organizationId: "org-1", kind: "guardian", studentName: "Ana Teste", relationshipLabel: "Mãe" });
});

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

it("keeps unmatched accounts pending without institution self-service", async () => {
  mockAccessStatus = "not_found";
  await mountPending();
  expect(screen.getByText("Encontre sua instituição")).toBeTruthy();
  expect(screen.getByLabelText("Buscar instituição")).toBeTruthy();
  expect(screen.queryByText("Acesso controlado")).toBeNull();
  expect(screen.queryByText("Criar instituição")).toBeNull();
  expect(screen.queryByLabelText("Nome da instituição")).toBeNull();
  fireEvent.press(screen.getByLabelText("Ir para início"));
  expect(mockRouter.replace).toHaveBeenCalledWith("/student/home");
  fireEvent.press(screen.getByLabelText("Inserir link ou código do convite"));
  expect(screen.getByLabelText("Link ou código do convite")).toBeTruthy();
  expect(screen.getByText("Continuar com convite")).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText("Link ou código do convite"), "h212134");
  fireEvent.press(screen.getByText("Continuar com convite"));
  expect(screen.getByText("Link ou código inválido.")).toBeTruthy();
  expect(mockClaimTrainerInvite).not.toHaveBeenCalled();
  expect(mockResumeStaffSignup).not.toHaveBeenCalled();
  fireEvent.press(screen.getByLabelText("Fechar convite"));
  await waitFor(() => expect(screen.queryByLabelText("Link ou código do convite")).toBeNull());
});

it("opens the institution catalog when the search field receives focus", async () => {
  mockAccessStatus = "not_found";
  await mountPending();
  expect(screen.queryByText("Rede Esportes Pinhais")).toBeNull();
  fireEvent(screen.getByLabelText("Buscar instituição"), "focus");
  await waitFor(() => expect(screen.getByText("Rede Esportes Pinhais")).toBeTruthy());
  expect(screen.getByText("Instituto Campeões")).toBeTruthy();
});

it("validates a structurally valid staff code before navigating or storing it", async () => {
  mockAccessStatus = "not_found";
  mockClaimTrainerInvite.mockRejectedValue(new Error("Invalid invite"));
  await mountPending();
  fireEvent.press(screen.getByLabelText("Inserir link ou código do convite"));
  fireEvent.changeText(screen.getByLabelText("Link ou código do convite"), "ABCD-EFGH");
  await act(async () => { fireEvent.press(screen.getByText("Continuar com convite")); });
  expect(mockClaimTrainerInvite).toHaveBeenCalledWith("ABCD-EFGH");
  expect(screen.getByText("O link informado não é válido.")).toBeTruthy();
  expect(mockRouter.replace).not.toHaveBeenCalledWith({ pathname: "/staff-invite", params: { code: "ABCD-EFGH" } });
});

it("does not open staff setup for an unknown valid-looking code on a flagged account", async () => {
  mockAccessStatus = "not_found";
  mockStaffSetupRequired = true;
  mockResumeStaffSignup.mockRejectedValue(new Error("Não foi possível retomar o convite. Confirme o e-mail da conta convidada."));
  await mountPending();
  fireEvent.press(screen.getByLabelText("Inserir link ou código do convite"));
  fireEvent.changeText(screen.getByLabelText("Link ou código do convite"), "ABCD-EFGH");
  await act(async () => { fireEvent.press(screen.getByText("Continuar com convite")); });
  expect(mockResumeStaffSignup).toHaveBeenCalledWith("ABCD-EFGH", expect.objectContaining({ access_token: "token" }));
  expect(mockRouter.replace).not.toHaveBeenCalledWith({ pathname: "/staff-invite", params: { code: "ABCD-EFGH" } });
  expect(screen.getByText("Tente novamente ou solicite outro convite.")).toBeTruthy();
});

it("requires an explicit guardian and athlete description without commercial enrollment", async () => {
  mockAccessStatus = "not_found";
  await mountPending();
  fireEvent(screen.getByLabelText("Buscar instituição"), "focus");
  await waitFor(() => expect(screen.getByText("Rede Esportes Pinhais")).toBeTruthy());
  fireEvent.press(screen.getByText("Rede Esportes Pinhais"));
  expect(screen.queryByText("Planos")).toBeNull();
  fireEvent.press(screen.getByText("Solicitar vínculo"));
  expect(mockRequestAthlete).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText("Sou responsável"));
  fireEvent.changeText(screen.getByLabelText("Nome do atleta"), "Ana Teste");
  fireEvent.press(screen.getByText("Solicitar vínculo"));
  expect(mockRequestAthlete).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText("Parentesco"), "Pai");
  await act(async () => { fireEvent.press(screen.getByText("Solicitar vínculo")); });
  expect(mockRequestAthlete).toHaveBeenCalledWith({ organizationId: "org-1", kind: "guardian", studentName: "Ana Teste", relationshipLabel: "Pai" });
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
