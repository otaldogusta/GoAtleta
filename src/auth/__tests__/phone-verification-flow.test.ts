import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../auth";
import type { AuthSession } from "../session";
import { forceRefreshAccessToken, getValidAccessToken, loadSession, saveSession } from "../session";
import { getConfirmedPhone } from "../phone-verification";
import { getFriendlyErrorMessage } from "../../ui/error-messages";

jest.mock("../../api/config", () => ({
  SUPABASE_URL: "https://auth.example.test",
  SUPABASE_ANON_KEY: "test-anon-key",
}));
jest.mock("../../api/ai", () => ({ clearAiCache: jest.fn() }));
jest.mock("../../db/client", () => ({ clearLocalReadCaches: jest.fn() }));
jest.mock("../../api/staff-invite", () => ({}));
jest.mock("../../api/auth-password", () => ({}));
jest.mock("../../api/email-verification", () => ({}));
jest.mock("../../api/auth-link-google", () => ({}));
jest.mock("../../observability/sentry", () => ({ setSentryUser: jest.fn(), clearSentryUser: jest.fn() }));
jest.mock("../../dev/profile-preview", () => ({ setDevProfilePreview: jest.fn() }));
jest.mock("../session", () => ({
  forceRefreshAccessToken: jest.fn(),
  getValidAccessToken: jest.fn(),
  loadSession: jest.fn(),
  loadValidatedSession: jest.fn(),
  saveSession: jest.fn(),
  subscribeSession: jest.fn(() => () => {}),
}));

const phone = "+12025550147";
const session: AuthSession = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_at: 2_000_000_000,
  user: { id: "test-user", email: "person@example.test", app_metadata: { providers: ["email"] } },
};
const response = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
});
const fetchMock = jest.fn();
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset().mockRejectedValue(new Error("Unexpected network request"));
  global.fetch = fetchMock as typeof fetch;
  jest.mocked(getValidAccessToken).mockResolvedValue(session.access_token);
  jest.mocked(loadSession).mockResolvedValue(session);
});
afterEach(() => { global.fetch = originalFetch; });

const mountAuth = async () => {
  const hook = renderHook(() => useAuth(), {
    wrapper: ({ children }) => React.createElement(AuthProvider, { initialSession: session }, children),
  });
  await act(async () => {});
  return hook;
};

it.each([
  ["wrong", { error_code: "otp_expired", msg: "Token is invalid" }, "Código inválido. Confira e tente novamente."],
  ["expired", { error_code: "otp_expired", msg: "Token has expired or is invalid" }, "O código expirou. Solicite um novo."],
])("keeps the session unverified after a %s code, without retrying or sending a new message", async (_label, body, message) => {
  fetchMock.mockResolvedValueOnce(response(403, body));
  const { result } = await mountAuth();
  let failure: unknown;
  await act(async () => {
    try { await result.current.verifyPhoneChange(phone, "654321"); } catch (error) { failure = error; }
  });
  expect(getFriendlyErrorMessage(failure)).toBe(message);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith("https://auth.example.test/auth/v1/verify", expect.objectContaining({
    method: "POST",
    headers: expect.objectContaining({ Authorization: "Bearer test-access-token" }),
    body: JSON.stringify({ phone, token: "654321", type: "phone_change" }),
  }));
  expect(forceRefreshAccessToken).not.toHaveBeenCalled();
  expect(saveSession).not.toHaveBeenCalled();
  expect(result.current.session).toEqual(session);
  expect(getConfirmedPhone(result.current.session?.user)).toBe("");
});

it("does not call the server for an incomplete code", async () => {
  const { result } = await mountAuth();
  await expect(result.current.verifyPhoneChange(phone, "123")).rejects.toThrow("6 dígitos");
  expect(fetchMock).not.toHaveBeenCalled();
  expect(saveSession).not.toHaveBeenCalled();
});

it("surfaces the server resend limit without automatically retrying or confirming the phone", async () => {
  fetchMock.mockResolvedValueOnce(response(429, { error_code: "over_sms_send_rate_limit" }));
  const { result } = await mountAuth();
  let failure: unknown;
  await act(async () => {
    try { await result.current.requestPhoneChange(phone); } catch (error) { failure = error; }
  });
  expect(getFriendlyErrorMessage(failure)).toBe("Aguarde um minuto antes de solicitar outro código.");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(forceRefreshAccessToken).not.toHaveBeenCalled();
  expect(saveSession).not.toHaveBeenCalled();
  expect(result.current.session).toEqual(session);
});

it("does not treat a successful send request as verified ownership", async () => {
  fetchMock.mockResolvedValueOnce(response(200, { ...session.user, phone_change: phone }));
  const { result } = await mountAuth();
  await act(async () => { await result.current.requestPhoneChange(phone); });
  expect(fetchMock).toHaveBeenCalledWith("https://auth.example.test/auth/v1/user", expect.objectContaining({
    method: "PUT", body: JSON.stringify({ phone }),
  }));
  expect(saveSession).not.toHaveBeenCalled();
  expect(getConfirmedPhone(result.current.session?.user)).toBe("");
});

it.each([
  { ...session.user, phone },
  { ...session.user, phone: "+12025550199", phone_confirmed_at: "2026-10-07T12:00:00Z" },
])("requires a matching confirmed phone in the server's refreshed user", async (user) => {
  fetchMock.mockResolvedValueOnce(response(200, {})).mockResolvedValueOnce(response(200, user));
  const { result } = await mountAuth();
  await act(async () => {
    await expect(result.current.verifyPhoneChange(phone, "123456")).rejects.toThrow("não confirmou este telefone");
  });
  expect(saveSession).not.toHaveBeenCalled();
  expect(result.current.session).toEqual(session);
});

it("persists verification only after the server confirms the matching phone", async () => {
  const confirmedUser = { ...session.user, phone, phone_confirmed_at: "2026-10-07T12:00:00Z" };
  fetchMock.mockResolvedValueOnce(response(200, {})).mockResolvedValueOnce(response(200, confirmedUser));
  const { result } = await mountAuth();
  await act(async () => { await result.current.verifyPhoneChange(phone, "123 456"); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenLastCalledWith("https://auth.example.test/auth/v1/user", expect.objectContaining({ method: "GET" }));
  expect(saveSession).toHaveBeenCalledWith({ ...session, user: confirmedUser }, true);
  expect(getConfirmedPhone(result.current.session?.user)).toBe(phone);
});
