const mockGetValidAccessToken = jest.fn();

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

jest.mock("../config", () => ({
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_URL: "https://example.supabase.co",
}));

import { analyzeTrainingPlanPdf } from "../training-plan-pdf-import";

describe("training plan PDF import retries", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    mockGetValidAccessToken.mockResolvedValue("access-token");
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        code: "AI_RATE_LIMITED",
        error: "A análise atingiu um limite temporário e será retomada.",
        retryable: true,
        retryAfterSeconds: 15,
      }),
    } as Response);
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("waits a full minute, retries once, and ends with a truthful message", async () => {
    const onRetry = jest.fn();
    const analysis = analyzeTrainingPlanPdf({
      organizationId: "org-1",
      classId: "class-1",
      filename: "planos.pdf",
      mimeType: "application/pdf",
      base64: "JVBERi0xLjQ=",
      lessonDate: "2026-08-11",
      currentPlan: {} as never,
    }, { onRetry });
    const rejection = expect(analysis).rejects.toThrow(
      "O limite da análise continua ativo. Aguarde alguns minutos e tente novamente."
    );

    await jest.advanceTimersByTimeAsync(60_000);
    await rejection;

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith({
      code: "AI_RATE_LIMITED",
      attempt: 1,
      retryAfterSeconds: 60,
    });
  });
});
