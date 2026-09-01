import { logNavigation } from "../breadcrumbs";

const mockAddBreadcrumb = jest.fn();

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
}));

describe("logNavigation privacy", () => {
  beforeEach(() => {
    mockAddBreadcrumb.mockClear();
  });

  it("never sends a family invite token to Sentry", () => {
    logNavigation("/family-invite/private-token");

    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: "navigation",
      message: "Route: /family-invite/_token",
      level: "info",
    });
    expect(JSON.stringify(mockAddBreadcrumb.mock.calls)).not.toContain(
      "private-token",
    );
  });

  it("drops query and hash data without masking a normal route", () => {
    logNavigation("/prof/home?email=private@example.com#otp=123456");

    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: "navigation",
      message: "Route: /prof/home",
      level: "info",
    });
    expect(JSON.stringify(mockAddBreadcrumb.mock.calls)).not.toContain(
      "private@example.com",
    );
    expect(JSON.stringify(mockAddBreadcrumb.mock.calls)).not.toContain("123456");
  });
});
