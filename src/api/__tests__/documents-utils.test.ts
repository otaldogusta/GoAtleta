import { maskCpf, normalizeCpfDigits, validateCpf } from "../../utils/cpf";
import { normalizeRg } from "../../utils/document-normalization";

describe("documents utils", () => {
  test("normalizeCpfDigits keeps only 11 digits", () => {
    expect(normalizeCpfDigits("529.982.247-25")).toBe("52998224725");
    expect(normalizeCpfDigits("abc123")).toBe("123");
    expect(normalizeCpfDigits("123456789012345")).toBe("12345678901");
  });

  test("maskCpf formats partially typed values", () => {
    expect(maskCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998")).toBe("529.98");
    expect(maskCpf("")).toBe("");
  });

  test("validateCpf accepts valid cpf and rejects invalid", () => {
    expect(validateCpf("52998224725")).toBe(true);
    expect(validateCpf("11111111111")).toBe(false);
    expect(validateCpf("52998224724")).toBe(false);
  });

  test("normalizeRg strips symbols and accents", () => {
    expect(normalizeRg("12.345.678-9")).toBe("123456789");
    expect(normalizeRg("áB-12*")).toBe("AB12");
  });
});

