import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const functionSource = readFileSync(
  resolve(__dirname, "../../request-access-review/index.ts"),
  "utf8",
);
const pendingScreenSource = readFileSync(
  resolve(__dirname, "../../../../app/pending.tsx"),
  "utf8",
);

describe("platform access email alert contract", () => {
  test("alerts the platform mailbox only for a newly inserted request", () => {
    expect(functionSource).toContain(
      'const DEFAULT_PLATFORM_ALERT_EMAIL = "uniquexperieence@gmail.com"',
    );
    expect(functionSource).toContain('Deno.env.get("PLATFORM_ALERT_EMAIL")');
    expect(functionSource).toContain('Deno.env.get("RESEND_API_KEY")');
    expect(functionSource).toContain('createdNewRequest = true');
    expect(functionSource).toContain(
      "if (createdNewRequest && !alertedRequestIds.has(accessRequestId))",
    );
    expect(functionSource).toContain("https://goatleta.com/platform/accesses");
  });

  test("keeps email delivery best effort so a provider failure does not lose the request", () => {
    expect(functionSource).toContain("return emailResponse.ok");
    expect(functionSource).toContain("catch {\n    return false;");
    expect(functionSource).not.toContain("throw new Error(\"EMAIL_ALERT_FAILED\")");
  });

  test("offers a professional request with an explicit product on the pending screen", () => {
    expect(pendingScreenSource).toContain(
      'const [requestMode, setRequestMode] = useState<"family" | "staff">',
    );
    expect(pendingScreenSource).toContain("await requestAccessReview({");
    expect(pendingScreenSource).toContain("requestedProduct,");
    expect(pendingScreenSource).toContain("Solicitar acesso profissional");
  });
});
