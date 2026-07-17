import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Google Drive OAuth callback routing", () => {
  test("encaminha o callback autorizado ao Supabase antes do fallback SPA", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as {
      rewrites?: { source?: string; destination?: string }[];
    };

    expect(config.rewrites?.[0]).toEqual({
      source: "/oauth/google-drive/callback",
      destination:
        "https://hgmdpetpwclucvquoklv.supabase.co/functions/v1/document-drive-oauth",
    });
    expect(config.rewrites?.[1]).toEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });
});
