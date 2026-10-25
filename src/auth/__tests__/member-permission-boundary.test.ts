import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import ProfCalendarRoute from "../../../app/prof/calendar";
import ProfPeriodizationRoute from "../../../app/prof/periodization";
import { OrganizationContext, type Organization, type OrganizationContextValue } from "../../providers/organization-context";

let mockCurrentHref = "";
const mockRouter = { replace: jest.fn((href: string) => { mockCurrentHref = href; }) };
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../../app/calendar", () => ({
  __esModule: true,
  default: () => jest.requireActual("react").createElement("protected-calendar"),
}));
jest.mock("../../../app/periodization", () => ({
  __esModule: true,
  default: () => jest.requireActual("react").createElement("protected-periodization"),
}));

const organization = (id = "org-a", roleLevel = 10): Organization => ({
  id, name: id, role_level: roleLevel, created_at: "2026-10-24T12:00:00Z",
});
const initialContext = (): OrganizationContextValue => ({
  organizations: [], activeOrganizationId: null, activeOrganization: null, isLoading: true,
  memberPermissions: {}, permissionsLoading: false, devProfilePreview: "auto",
  setActiveOrganizationId: async () => {}, fetchOrganizations: async () => {},
  createOrganization: async () => "", setDevProfilePreview: async () => {},
  refreshMemberPermissions: async () => {},
});
const routes = [
  { name: "calendar", Component: ProfCalendarRoute, permissionKey: "calendar", host: "protected-calendar", href: "/prof/calendar?targetClassId=class-a&targetDate=2026-10-24&openApply=1" },
  { name: "periodization", Component: ProfPeriodizationRoute, permissionKey: "periodization", host: "protected-periodization", href: "/prof/periodization?classId=class-a" },
] as const;

let renderer: TestRenderer.ReactTestRenderer | undefined;
beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { act(() => renderer?.unmount()); renderer = undefined; });

describe.each(routes)("professor $name entry", route => {
  const element = (context: OrganizationContextValue) => React.createElement(
    OrganizationContext.Provider, { value: context }, React.createElement(route.Component),
  );
  const render = (context: OrganizationContextValue) => {
    mockCurrentHref = route.href;
    act(() => { renderer = TestRenderer.create(element(context)); });
  };
  const update = (context: OrganizationContextValue) => { act(() => renderer!.update(element(context))); };
  const expectHiddenWithoutRedirect = () => {
    expect(renderer!.root.findAllByType(route.host)).toHaveLength(0);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockCurrentHref).toBe(route.href);
  };

  test.each(["member", "admin"] as const)("preserves the complete direct URL while bootstrapping an allowed %s", kind => {
    const context = initialContext();
    render(context);
    expectHiddenWithoutRedirect();
    const active = organization("org-a", kind === "admin" ? 50 : 10);
    const pending = { ...context, organizations: [active], activeOrganizationId: active.id, activeOrganization: active, isLoading: false, permissionsLoading: true };
    update(pending);
    expectHiddenWithoutRedirect();
    update({ ...pending, permissionsLoading: false, memberPermissions: kind === "admin" ? {} : { [route.permissionKey]: true } });
    expect(renderer!.root.findAllByType(route.host)).toHaveLength(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockCurrentHref).toBe(route.href);
  });

  test("redirects only after a member permission has resolved as denied", () => {
    const context = initialContext();
    render(context);
    expectHiddenWithoutRedirect();
    const active = organization();
    update({ ...context, organizations: [active], activeOrganizationId: active.id, activeOrganization: active, isLoading: false, memberPermissions: { [route.permissionKey]: false } });
    expect(renderer!.root.findAllByType(route.host)).toHaveLength(0);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockCurrentHref).toBe("/prof/home");
  });

  test("keeps access denied if organization loading finishes without an organization", () => {
    const context = initialContext();
    render(context);
    expectHiddenWithoutRedirect();
    update({ ...context, isLoading: false });
    expect(renderer!.root.findAllByType(route.host)).toHaveLength(0);
    expect(mockRouter.replace).toHaveBeenCalledWith("/prof/home");
  });

  test("hides previously allowed content throughout an organization switch and waits for the new permissions", () => {
    const active = organization();
    const allowed = { ...initialContext(), organizations: [active], activeOrganizationId: active.id, activeOrganization: active, isLoading: false, memberPermissions: { [route.permissionKey]: true } };
    render(allowed);
    expect(renderer!.root.findAllByType(route.host)).toHaveLength(1);
    update({ ...allowed, isLoading: true, activeOrganizationId: null, activeOrganization: null });
    expectHiddenWithoutRedirect();
    const next = organization("org-b");
    const pending = { ...allowed, organizations: [next], activeOrganizationId: next.id, activeOrganization: next, permissionsLoading: true };
    update(pending);
    expectHiddenWithoutRedirect();
    update({ ...pending, permissionsLoading: false, memberPermissions: { [route.permissionKey]: false } });
    expect(renderer!.root.findAllByType(route.host)).toHaveLength(0);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });
});
