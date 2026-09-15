import { getGoogleLinkUrl } from "../auth-link-google";
jest.mock("../config", () => ({ SUPABASE_URL: "https://test.supabase.co", SUPABASE_ANON_KEY: "test-key" }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
test("requests identity linking for the existing session and account selection", async () => {
  const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://accounts.google.com/o/oauth2/auth?state=test" }) });
  global.fetch = request;
  await expect(getGoogleLinkUrl("test-session", "http://localhost:8081/student/profile")).resolves.toContain("accounts.google.com");
  const [url, options] = request.mock.calls[0];
  expect(url).toContain("/user/identities/authorize?");
  expect(url).toContain("prompt=select_account");
  expect(options.headers.Authorization).toBe("Bearer test-session");
});
test("rejects missing sessions and unexpected redirect hosts", async () => {
  await expect(getGoogleLinkUrl("", "http://localhost:8081")).rejects.toThrow();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ url: "https://untrusted.example" }) });
  await expect(getGoogleLinkUrl("test-session", "http://localhost:8081")).rejects.toThrow("Endereço");
});
