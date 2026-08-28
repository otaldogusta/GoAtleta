import { createClientId } from "../client-id";

describe("createClientId", () => {
  it("usa randomUUID quando o runtime oferece a API", () => {
    expect(createClientId({ randomUUID: () => "runtime-uuid" })).toBe("runtime-uuid");
  });

  it("mantém IDs distintos quando o mobile não expõe crypto", () => {
    const first = createClientId(null);
    const second = createClientId(null);

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(12);
    expect(second.length).toBeGreaterThan(12);
  });

  it("forma UUID v4 com getRandomValues", () => {
    const value = createClientId({
      getRandomValues: (bytes) => {
        bytes.fill(1);
        return bytes;
      },
    });

    expect(value).toMatch(/^01010101-0101-4101-8101-010101010101$/);
  });
});
