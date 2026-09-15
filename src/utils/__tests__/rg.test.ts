import { formatRg } from "../rg";

describe("RG presentation", () => {
  it("formats common numeric documents without validating ownership", () => {
    expect(formatRg("123456789")).toBe("12.345.678-9");
    expect(formatRg("12345678x")).toBe("12.345.678-X");
    expect(formatRg("12345678")).toBe("1.234.567-8");
  });
  it("preserves letters, leading zeroes and longer formats", () => {
    expect(formatRg("mg-00123456")).toBe("MG00123456");
    expect(formatRg("00123456789")).toBe("0.012.345.678-9");
  });
  it("limits excessive input and handles clearing", () => {
    expect(formatRg("1".repeat(40)).replace(/\D/g, "")).toHaveLength(14);
    expect(formatRg("90909090909090")).toBe("9.090.909.090.909-0");
    expect(formatRg("")).toBe("");
    expect(formatRg("12.345.678-9")).toBe("12.345.678-9");
  });
});
