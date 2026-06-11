import { buildLoginRedirectHref, sanitizePostLoginRedirect } from "../post-login-redirect";

describe("post-login redirect", () => {
  it("accepts internal protected routes with query params", () => {
    expect(sanitizePostLoginRedirect("/class/c_1?date=2026-06-20")).toBe(
      "/class/c_1?date=2026-06-20"
    );
    expect(buildLoginRedirectHref("/class/c_1")).toBe("/login?next=%2Fclass%2Fc_1");
  });

  it("rejects external and protocol-relative URLs", () => {
    expect(sanitizePostLoginRedirect("https://evil.example/class/c_1")).toBeNull();
    expect(sanitizePostLoginRedirect("//evil.example/class/c_1")).toBeNull();
    expect(sanitizePostLoginRedirect("/\\evil.example")).toBeNull();
  });

  it("rejects public auth routes as return targets", () => {
    expect(sanitizePostLoginRedirect("/login")).toBeNull();
    expect(sanitizePostLoginRedirect("/signup")).toBeNull();
    expect(sanitizePostLoginRedirect("/welcome")).toBeNull();
    expect(sanitizePostLoginRedirect("/reset-password")).toBeNull();
    expect(sanitizePostLoginRedirect("/invite/abc")).toBeNull();
  });

  it("falls back to plain login when target is unsafe", () => {
    expect(buildLoginRedirectHref("https://evil.example")).toBe("/login");
    expect(buildLoginRedirectHref("/login")).toBe("/login");
  });
});
