import React from "react";
import { act, renderHook } from "@testing-library/react-native";
import { AuthProvider, useAuth } from "../auth";
import { clearPendingInvites } from "../pending-invite";
import { saveSession } from "../session";
import type { AuthSession, SessionIdentity } from "../session";

let mockStoredSession: AuthSession | null = null;
let mockGeneration = 0;
let mockListener: ((session: AuthSession | null) => void) | undefined;

jest.mock("expo-linking", () => ({ createURL: (path: string) => `goatleta:///${path}` }));
jest.mock("../../api/config", () => ({
  SUPABASE_URL: "https://auth.example.test",
  SUPABASE_ANON_KEY: "anon-key",
}));
jest.mock("../../api/ai", () => ({ clearAiCache: jest.fn() }));
jest.mock("../../db/client", () => ({ clearLocalReadCaches: jest.fn() }));
jest.mock("../../observability/sentry", () => ({ setSentryUser: jest.fn(), clearSentryUser: jest.fn() }));
jest.mock("../../dev/profile-preview", () => ({ setDevProfilePreview: jest.fn() }));
jest.mock("../pending-invite", () => ({ clearPendingInvites: jest.fn() }));
jest.mock("../session", () => ({
  loadSession: async () => mockStoredSession,
  loadValidatedSession: async () => mockStoredSession,
  subscribeSession: (listener: (session: AuthSession | null) => void) => {
    mockListener = listener;
    return () => { mockListener = undefined; };
  },
  getSessionIdentity: () => ({ userId: mockStoredSession?.user.id ?? "", generation: mockGeneration }),
  assertSessionIdentity: (identity: SessionIdentity) => {
    if (identity.userId !== (mockStoredSession?.user.id ?? "") || identity.generation !== mockGeneration) {
      throw new Error("A sessão mudou.");
    }
  },
  saveSession: jest.fn(async (session: AuthSession | null) => {
    if (!session || session.user.id !== mockStoredSession?.user.id) mockGeneration += 1;
    mockStoredSession = session;
    mockListener?.(session);
  }),
}));

const originalEmail = "typo@example.test";
const correctedEmail = "corrected@example.test";
const signupPassword = "SamplePassword123!";
const originalFetch = global.fetch;
const fetchMock = jest.fn();

const user = (id: string, email: string): AuthSession["user"] => ({
  id,
  email,
  identities: [{ provider: "email" }],
  app_metadata: { provider: "email" },
});

const reply = (status: number, payload: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(payload),
});

const withSignupAttempt = (signupUser: AuthSession["user"], init: RequestInit) => {
  const { data } = JSON.parse(String(init.body));
  return data.signup_attempt_id
    ? { ...signupUser, user_metadata: { signup_attempt_id: data.signup_attempt_id } }
    : signupUser;
};

const respondToSignupWithSession = (signupUser: AuthSession["user"]) => {
  let returnedUser = signupUser;
  fetchMock.mockImplementationOnce(async (_url, init: RequestInit) => {
    returnedUser = withSignupAttempt(signupUser, init);
    return reply(200, {
      access_token: `${signupUser.id}-access`,
      refresh_token: `${signupUser.id}-refresh`,
      expires_in: 3600,
      user: returnedUser,
    });
  });
  fetchMock.mockImplementationOnce(async () => reply(200, returnedUser));
};

const mount = async (initialSession: AuthSession | null = null) => {
  mockStoredSession = initialSession;
  const hook = renderHook(() => useAuth(), {
    wrapper: ({ children }) => React.createElement(AuthProvider, { initialSession }, children),
  });
  await act(async () => {});
  return hook;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStoredSession = null;
  mockGeneration = 0;
  fetchMock.mockReset().mockRejectedValue(new Error("Unexpected network request"));
  global.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test("uses a new user identity and sends the ordinary OTP to the corrected address", async () => {
  const { result } = await mount();
  respondToSignupWithSession(user("original-user", originalEmail));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email", "Atleta"); });

  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(true);
  expect(result.current.canReuseSignupPassword(correctedEmail)).toBe(false);
  respondToSignupWithSession(user("corrected-user", correctedEmail));
  fetchMock.mockResolvedValueOnce(reply(200, {}));
  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, ` ${correctedEmail.toUpperCase()} `))
      .resolves.toEqual({ deliveryFailed: false });
  });

  expect(result.current.session?.user).toMatchObject({ id: "corrected-user", email: correctedEmail });
  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(false);
  expect(fetchMock.mock.calls[2][0]).toContain("/auth/v1/signup");
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
    email: correctedEmail,
    password: signupPassword,
    data: { full_name: "Atleta", requires_email_hybrid_verification: true, signup_attempt_id: expect.any(String) },
  });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).data).not.toHaveProperty("signup_attempt_id");
  expect(fetchMock.mock.calls[4][0]).toContain("/auth/v1/otp");
  expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ email: correctedEmail, create_user: false });
  expect(clearPendingInvites).not.toHaveBeenCalled();
  expect(JSON.stringify(jest.mocked(saveSession).mock.calls)).not.toContain(signupPassword);
});

test("keeps the old signup and temporary password when the server does not start a replacement", async () => {
  const { result } = await mount();
  respondToSignupWithSession(user("original-user", originalEmail));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  fetchMock.mockResolvedValueOnce(reply(200, { ...user("opaque-id", correctedEmail), identities: [] }));

  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("iniciar o cadastro");
  });

  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(saveSession).toHaveBeenCalledTimes(1);
  expect(result.current.session?.user.id).toBe("original-user");
  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(true);
});

test("leaves the replacement session active if only the code delivery fails", async () => {
  const initialSession: AuthSession = {
    user: user("original-user", originalEmail),
    access_token: "old-access",
    refresh_token: "old-refresh",
    expires_at: 2_000_000_000,
  };
  const { result } = await mount(initialSession);
  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(false);
  await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("senha do cadastro");
  expect(fetchMock).not.toHaveBeenCalled();

  respondToSignupWithSession(user("corrected-user", correctedEmail));
  fetchMock.mockResolvedValueOnce(reply(503, { error: "Delivery unavailable" }));
  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail, signupPassword))
      .resolves.toEqual({ deliveryFailed: true });
  });
  expect(result.current.session?.user).toMatchObject({ id: "corrected-user", email: correctedEmail });
  expect(clearPendingInvites).not.toHaveBeenCalled();
});

test("keeps the signup code delivered by Supabase when it creates an account without a session", async () => {
  const { result } = await mount();
  fetchMock.mockResolvedValueOnce(reply(200, user("original-user", originalEmail)));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(true);
  fetchMock.mockImplementationOnce(async (_url, init: RequestInit) =>
    reply(200, withSignupAttempt(user("corrected-user", correctedEmail), init)));
  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).resolves.toEqual({ deliveryFailed: false });
  });
  expect(result.current.session).toBeNull();
  expect(result.current.canReuseSignupPassword(correctedEmail)).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("requires the signup password again after the temporary copy expires", async () => {
  const now = Date.now();
  const clock = jest.spyOn(Date, "now").mockReturnValue(now);
  const { result } = await mount();
  fetchMock.mockResolvedValueOnce(reply(200, user("original-user", originalEmail)));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  clock.mockReturnValue(now + 5 * 60 * 1000);

  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(false);
  await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("senha do cadastro");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("preserves the previous attempt when signup returns an existing unconfirmed user", async () => {
  const { result } = await mount();
  fetchMock.mockResolvedValueOnce(reply(200, user("original-user", originalEmail)));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  fetchMock.mockResolvedValueOnce(reply(200, user("existing-unconfirmed-user", correctedEmail)));

  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("iniciar o cadastro");
  });
  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(true);
  expect(result.current.canReuseSignupPassword(correctedEmail)).toBe(false);
  expect(saveSession).toHaveBeenCalledTimes(1);
});

test("rejects a replacement response that keeps the previous signup identity", async () => {
  const { result } = await mount();
  respondToSignupWithSession(user("original-user", originalEmail));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  respondToSignupWithSession(user("original-user", correctedEmail));

  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("iniciar o cadastro");
  });

  expect(fetchMock).toHaveBeenCalledTimes(4);
  expect(saveSession).toHaveBeenCalledTimes(1);
  expect(result.current.session?.user.email).toBe(originalEmail);
});

test("discards the password when another session replaces the signup", async () => {
  const { result } = await mount();
  respondToSignupWithSession(user("original-user", originalEmail));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  const original = result.current.session!;

  await act(async () => {
    await saveSession({ ...original, user: user("other-user", correctedEmail) });
    await saveSession(original);
  });

  expect(result.current.canReuseSignupPassword(originalEmail)).toBe(false);
  await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("senha do cadastro");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("continues with the signup response if hydrating the corrected account loses connectivity", async () => {
  const { result } = await mount();
  respondToSignupWithSession(user("original-user", originalEmail));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });

  fetchMock.mockImplementationOnce(async (_url, init: RequestInit) => reply(200, {
    access_token: "corrected-access",
    refresh_token: "corrected-refresh",
    expires_in: 3600,
    user: withSignupAttempt(user("corrected-user", correctedEmail), init),
  })).mockRejectedValueOnce(new Error("Network request failed")).mockResolvedValueOnce(reply(200, {}));

  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).resolves.toEqual({ deliveryFailed: false });
  });
  expect(result.current.session?.user).toMatchObject({ id: "corrected-user", email: correctedEmail });
  expect(fetchMock.mock.calls[4][0]).toContain("/auth/v1/otp");
});

test("ignores an OTP response from a signup that was replaced while verification was in progress", async () => {
  const { result } = await mount();
  const originalUser = user("original-user", originalEmail);
  respondToSignupWithSession(originalUser);
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });

  let completePreviousOtp!: (response: ReturnType<typeof reply>) => void;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { completePreviousOtp = resolve; }));
  const previousVerification = expect(result.current.verifySignupCode(originalEmail, "123456")).rejects.toThrow("A sessão mudou");

  respondToSignupWithSession(user("corrected-user", correctedEmail));
  fetchMock.mockResolvedValueOnce(reply(200, {}));
  await act(async () => { await result.current.correctPendingSignupEmail(originalEmail, correctedEmail); });

  completePreviousOtp(reply(200, { access_token: "old-otp-access", user: originalUser }));
  await previousVerification;
  expect(fetchMock).toHaveBeenCalledTimes(6);
  expect(result.current.session?.user.id).toBe("corrected-user");
  expect(result.current.canReuseSignupPassword(correctedEmail)).toBe(true);
});
