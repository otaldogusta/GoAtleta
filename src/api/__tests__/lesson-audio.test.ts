import { checkLessonAudioAvailability, transcribeLessonAudio } from "../lesson-audio";
import { getValidAccessToken } from "../../auth/session";
jest.mock("../../auth/session", () => ({ getValidAccessToken: jest.fn() }));
jest.mock("../config", () => ({ SUPABASE_URL: "https://example.invalid", SUPABASE_ANON_KEY: "test" }));
const originalFetch = global.fetch;
beforeEach(() => { (getValidAccessToken as jest.Mock).mockResolvedValue("test"); global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; jest.clearAllMocks(); });
test("missing function is detected before collecting audio", async () => {
  (fetch as jest.Mock).mockResolvedValue({ status: 404 });
  await expect(checkLessonAudioAvailability(new AbortController().signal)).rejects.toThrow("não está disponível no servidor");
  expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: "GET" }));
});
test("deployed endpoint accepts the availability probe via method rejection", async () => {
  (fetch as jest.Mock).mockResolvedValue({ status: 405 });
  await expect(checkLessonAudioAvailability(new AbortController().signal)).resolves.toBeUndefined();
});
test("expired session never sends a request", async () => {
  (getValidAccessToken as jest.Mock).mockResolvedValue(null);
  await expect(checkLessonAudioAvailability(new AbortController().signal)).rejects.toThrow("Entre novamente");
  expect(fetch).not.toHaveBeenCalled();
});
test("upload surfaces unavailable service even for a non JSON gateway response", async () => {
  (fetch as jest.Mock).mockResolvedValue({ status: 503, ok: false });
  await expect(transcribeLessonAudio("file:///test.m4a", { organizationId: "o", classId: "c" }, new AbortController().signal)).rejects.toThrow("não está disponível no servidor");
});

test("malformed successful response is not reported as missing speech", async () => {
  (fetch as jest.Mock).mockResolvedValue({ status: 200, ok: true, json: async () => ({ unexpected: true }) });
  await expect(transcribeLessonAudio("file:///test.m4a", { organizationId: "o", classId: "c" }, new AbortController().signal)).rejects.toThrow("resposta inválida");
});

test("general chat sends the organization without a fake class", async () => {
  (fetch as jest.Mock).mockResolvedValue({ ok:true, json:async()=>({text:"Planejar a semana"}) });
  await expect(transcribeLessonAudio("file:///test.m4a", {organizationId:"o"}, new AbortController().signal)).resolves.toBe("Planejar a semana");
  const form = (fetch as jest.Mock).mock.calls[0][1].body;
  expect(form.get('organizationId')).toBe('o');
  expect(form.has('classId')).toBe(false);
});
