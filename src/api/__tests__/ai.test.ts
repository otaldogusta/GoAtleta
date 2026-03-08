/* eslint-disable import/first */
const mockGetValidAccessToken = jest.fn();

jest.mock("../../auth/session", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

jest.mock("../config", () => ({
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "anon-key",
}));

import { clearAiCache, rewriteReportText } from "../ai";

describe("ai api - rewriteReportText", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    clearAiCache();
    mockGetValidAccessToken.mockResolvedValue("token-1");
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("returns rewrittenText from valid json", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          reply: '{"rewrittenText":"Texto final profissional."}',
          sources: [],
          draftTraining: null,
        }),
    } as Response);

    const result = await rewriteReportText({
      field: "activity",
      text: "texto base",
      mode: "projeto_social",
      maxChars: 1200,
      classId: "class_1",
    });

    expect(result).toEqual({ rewrittenText: "Texto final profissional." });
    expect(global.fetch).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/assistant",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          apikey: "anon-key",
        }),
      })
    );
  });

  test("parses json inside code fence", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          reply: '```json\n{"rewrittenText":"Texto com cerca semântica."}\n```',
          sources: [],
          draftTraining: null,
        }),
    } as Response);

    const result = await rewriteReportText({
      field: "conclusion",
      text: "texto base 2",
      mode: "projeto_social",
      maxChars: 1200,
    });

    expect(result.rewrittenText).toBe("Texto com cerca semântica.");
  });

  test("throws friendly error when payload has no rewrittenText", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          reply: '{"unexpected":"shape"}',
          sources: [],
          draftTraining: null,
        }),
    } as Response);

    await expect(
      rewriteReportText({
        field: "activity",
        text: "texto base 3",
        mode: "projeto_social",
        maxChars: 1200,
      })
    ).rejects.toThrow("Nao foi possivel gerar sugestao de texto agora.");
  });

  test("accepts plain text response when json shape is missing", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          reply: "Texto reescrito em formato profissional.",
          sources: [],
          draftTraining: null,
        }),
    } as Response);

    const result = await rewriteReportText({
      field: "conclusion",
      text: "texto base 4",
      mode: "projeto_social",
      maxChars: 1200,
    });

    expect(result.rewrittenText).toBe("Texto reescrito em formato profissional.");
  });

  test("blocks empty and oversized input before request", async () => {
    await expect(
      rewriteReportText({
        field: "activity",
        text: "   ",
        mode: "projeto_social",
        maxChars: 1200,
      })
    ).rejects.toThrow("Digite um texto antes de usar o assistente.");

    await expect(
      rewriteReportText({
        field: "activity",
        text: "a".repeat(1201),
        mode: "projeto_social",
        maxChars: 1200,
      })
    ).rejects.toThrow("Limite de 1200 caracteres excedido.");

    expect(global.fetch).toBe(originalFetch);
  });
});
