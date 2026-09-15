import { buildSecurityContactEmail } from "../security-contact-email";
describe("security contact email", () => {
  it("includes a readable code in HTML and plain text with the same expiry", () => {
    const email = buildSecurityContactEmail("12345678");
    expect(email.html).toContain("12345678");
    expect(email.text).toContain("12345678");
    expect(email.html).toContain("10 minutos");
    expect(email.text).toContain("10 minutos");
    expect(email.html).toContain('max-width:440px');
    expect(email.html).not.toContain("<script");
    expect(email.html).not.toContain("<img");
  });
  it("rejects malformed codes before HTML interpolation", () => {
    expect(() => buildSecurityContactEmail('<script>')).toThrow();
    expect(() => buildSecurityContactEmail('1234')).toThrow();
  });
});
