import {
  hasWhatsAppEmbeddedSignupParams,
  parseWhatsAppEmbeddedSignupResult,
} from "../embedded-signup-result";

describe("WhatsApp Embedded Signup return", () => {
  it("recognizes an authorization return without retaining the code", () => {
    expect(parseWhatsAppEmbeddedSignupResult({ code: "secret-code" })).toEqual({ kind: "returned" });
  });

  it("maps cancellation without exposing provider details", () => {
    expect(parseWhatsAppEmbeddedSignupResult({ error: "access_denied" })).toEqual({ kind: "cancelled" });
  });

  it("maps provider failures to a stable user-facing message", () => {
    expect(parseWhatsAppEmbeddedSignupResult({
      error_code: "190",
      error_description: "private provider detail",
    })).toEqual({
      kind: "error",
      message: "A Meta não concluiu a conexão. Tente novamente quando a verificação empresarial estiver aprovada.",
    });
  });

  it("detects callback parameters supplied as arrays", () => {
    expect(hasWhatsAppEmbeddedSignupParams({ code: ["secret-code"] })).toBe(true);
    expect(hasWhatsAppEmbeddedSignupParams({})).toBe(false);
  });
});
