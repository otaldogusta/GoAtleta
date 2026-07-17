import { buildOAuthAuthorizeUrl } from "../oauth-url";

describe("buildOAuthAuthorizeUrl", () => {
  it("forces Google to show the account chooser", () => {
    const url = new URL(
      buildOAuthAuthorizeUrl({
        supabaseUrl: "https://project.supabase.co/",
        provider: "google",
        redirectTo: "http://localhost:8081/login",
      })
    );

    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("redirect_to")).toBe("http://localhost:8081/login");
  });

  it("does not send the Google-specific prompt to other providers", () => {
    const url = new URL(
      buildOAuthAuthorizeUrl({
        supabaseUrl: "https://project.supabase.co",
        provider: "apple",
        redirectTo: "goatleta://login",
      })
    );

    expect(url.searchParams.has("prompt")).toBe(false);
  });

  it("keeps the mobile redirect control", () => {
    const url = new URL(
      buildOAuthAuthorizeUrl({
        supabaseUrl: "https://project.supabase.co",
        provider: "google",
        redirectTo: "goatleta://login",
        skipHttpRedirect: true,
      })
    );

    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("skip_http_redirect")).toBe("true");
  });
});
