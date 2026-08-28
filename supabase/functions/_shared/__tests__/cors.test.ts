import { buildCorsHeaders, corsPreflight } from "../cors";

const requestFrom = (origin: string) => ({
  headers: {
    get: (name: string) => name.toLowerCase() === "origin" ? origin : null,
  },
}) as unknown as Request;

describe("Edge Function CORS contract", () => {
  test("supports the headers emitted by current Supabase browser clients", () => {
    const headers = buildCorsHeaders(requestFrom("https://goatleta.com"));

    expect(headers["Access-Control-Allow-Origin"]).toBe("https://goatleta.com");
    expect(headers["Access-Control-Allow-Headers"]).toContain("authorization");
    expect(headers["Access-Control-Allow-Headers"]).toContain("x-retry-count");
    expect(headers["Access-Control-Allow-Headers"]).toContain("traceparent");
    expect(headers["Access-Control-Allow-Headers"]).toContain("tracestate");
    expect(headers["Access-Control-Allow-Headers"]).toContain("baggage");
    expect(headers.Vary).toBe("Origin");
  });

  test("returns a successful preflight with the shared headers", () => {
    const response = corsPreflight(requestFrom("https://go-atleta.vercel.app"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://go-atleta.vercel.app"
    );
    expect(response.headers.get("Vary")).toBe("Origin");
  });
});
