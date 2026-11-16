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

const mount = async (initialSession?: AuthSession | null) => {
  if (initialSession !== undefined) mockStoredSession = initialSession;
  const hook = renderHook(() => useAuth(), {
    wrapper: ({ children }) => React.createElement(AuthProvider, { initialSession }, children),
  });
  await act(async () => {});
  return hook;
};

const pendingSession = (pendingUser = user("original-user", originalEmail)): AuthSession => ({
  user: pendingUser,
  access_token: `${pendingUser.id}-access`,
  refresh_token: `${pendingUser.id}-refresh`,
  expires_at: 4_000_000_000,
});

const respondToCorrection = (deliveryFailed = false) => {
  fetchMock.mockResolvedValueOnce(reply(200, { deliveryFailed }));
};

const verifiedCorrection = {
  ...user("corrected-user", correctedEmail),
  app_metadata: { provider: "email", email_verified_hybrid_at: "2026-11-16T12:00:00Z" },
};

const respondToCorrectionVerification = () => {
  fetchMock
    .mockResolvedValueOnce(reply(200, { session: pendingSession(verifiedCorrection) }))
    .mockResolvedValueOnce(reply(200, verifiedCorrection));
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

test("corrects a reopened signup using its stored session and sends only the new email to the Edge", async () => {
  const original = await mount();
  respondToSignupWithSession(user("original-user", originalEmail));
  await act(async () => { await original.result.current.signUp(originalEmail, signupPassword, "verify-email", "Atleta"); });
  original.unmount();

  const { result } = await mount();
  expect(result.current.session?.user.email).toBe(originalEmail);
  respondToCorrection();
  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, ` ${correctedEmail.toUpperCase()} `))
      .resolves.toEqual({ deliveryFailed: false });
  });

  expect(result.current.session?.user).toMatchObject({ id: "original-user", email: originalEmail });
  expect(fetchMock).toHaveBeenCalledTimes(3);
  const [url, request] = fetchMock.mock.calls[2];
  expect(url).toContain("/functions/v1/correct-signup-email");
  expect(new Headers(request.headers).get("Authorization")).toBe("Bearer original-user-access");
  expect(JSON.parse(request.body)).toEqual({ email: correctedEmail });
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).data).not.toHaveProperty("signup_attempt_id");
  expect(clearPendingInvites).not.toHaveBeenCalled();
  expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ user: user("original-user", originalEmail) }), true);
  respondToCorrectionVerification();
  await act(async () => {
    await expect(result.current.verifySignupCode(correctedEmail, "123456", true))
      .resolves.toMatchObject({ user: verifiedCorrection });
  });
  expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ email: correctedEmail, code: "123456" });
  expect(saveSession).toHaveBeenLastCalledWith(expect.objectContaining({ user: verifiedCorrection }), true);
  expect(JSON.stringify(jest.mocked(saveSession).mock.calls)).not.toContain(signupPassword);
});

test("keeps the old signup when the new address already belongs to a different account", async () => {
  const { result } = await mount(pendingSession());
  fetchMock.mockResolvedValueOnce(reply(409, { error: "Este e-mail já está em uso." }));

  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("Este e-mail já está em uso.");
  });

  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(saveSession).not.toHaveBeenCalled();
  expect(result.current.session?.user.id).toBe("original-user");
});

test("keeps the original session if code delivery fails", async () => {
  const { result } = await mount(pendingSession());
  respondToCorrection(true);

  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail))
      .resolves.toEqual({ deliveryFailed: true });
  });
  expect(result.current.session?.user).toMatchObject({ id: "original-user", email: originalEmail });
  expect(clearPendingInvites).not.toHaveBeenCalled();
});

test("keeps the signup code delivered by Supabase when it creates an account without a session", async () => {
  const { result } = await mount();
  fetchMock.mockResolvedValueOnce(reply(200, user("original-user", originalEmail)));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  fetchMock.mockImplementationOnce(async (_url, init: RequestInit) =>
    reply(200, withSignupAttempt(user("corrected-user", correctedEmail), init)));
  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).resolves.toEqual({ deliveryFailed: false });
  });
  expect(result.current.session).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[1][0]).toContain("/auth/v1/signup");
});

test("does not send a correction when there is no session and the temporary signup expires", async () => {
  const now = Date.now();
  const clock = jest.spyOn(Date, "now").mockReturnValue(now);
  const { result } = await mount();
  fetchMock.mockResolvedValueOnce(reply(200, user("original-user", originalEmail)));
  await act(async () => { await result.current.signUp(originalEmail, signupPassword, "verify-email"); });
  clock.mockReturnValue(now + 5 * 60 * 1000);

  await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow();
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
  expect(saveSession).toHaveBeenCalledTimes(1);
});

test("rejects a replacement response that keeps the previous signup identity", async () => {
  const { result } = await mount(pendingSession());
  fetchMock.mockResolvedValueOnce(reply(200, { session: pendingSession(user("original-user", correctedEmail)) }))
    .mockResolvedValueOnce(reply(200, user("original-user", correctedEmail)));

  await act(async () => {
    await expect(result.current.verifySignupCode(correctedEmail, "123456", true)).rejects.toThrow();
  });

  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(saveSession).not.toHaveBeenCalled();
  expect(result.current.session?.user.email).toBe(originalEmail);
});

test("ignores a correction response after another session replaces the signup", async () => {
  const { result } = await mount(pendingSession());
  let finishCorrection!: (response: ReturnType<typeof reply>) => void;
  let startCorrection!: () => void;
  const correctionStarted = new Promise<void>((resolve) => { startCorrection = resolve; });
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => {
    finishCorrection = resolve;
    startCorrection();
  }));
  const correction = expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow("A sessão mudou");
  await correctionStarted;

  await act(async () => {
    await saveSession(pendingSession(user("other-user", "another@example.test")));
    finishCorrection(reply(200, { deliveryFailed: false }));
    await correction;
  });

  expect(result.current.session?.user.id).toBe("other-user");
  expect(saveSession).toHaveBeenCalledTimes(1);
});

test("does not call the correction Edge for a verified account", async () => {
  const verifiedUser = user("verified-user", originalEmail);
  const { result } = await mount(pendingSession({
    ...verifiedUser,
    app_metadata: { ...verifiedUser.app_metadata, email_verified_hybrid_at: "2026-11-12T12:00:00Z" },
  }));
  await act(async () => {
    await expect(result.current.correctPendingSignupEmail(originalEmail, correctedEmail)).rejects.toThrow();
  });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(saveSession).not.toHaveBeenCalled();
});

test("ignores an OTP response from a signup that was replaced while verification was in progress", async () => {
  const originalUser = user("original-user", originalEmail);
  const { result } = await mount(pendingSession(originalUser));

  let completePreviousOtp!: (response: ReturnType<typeof reply>) => void;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { completePreviousOtp = resolve; }));
  const previousVerification = expect(result.current.verifySignupCode(originalEmail, "123456")).rejects.toThrow("A sessão mudou");

  respondToCorrectionVerification();
  await act(async () => { await result.current.verifySignupCode(correctedEmail, "123456", true); });

  completePreviousOtp(reply(200, { access_token: "old-otp-access", user: originalUser }));
  await previousVerification;
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(result.current.session?.user.id).toBe("corrected-user");
});
