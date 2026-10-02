import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { PageBreadcrumbHeader } from "../PageBreadcrumbHeader";
import { BackTitleHeader } from "../BackTitleHeader";
import { navigateToPrimaryRoute } from "../../../navigation/primary-route-navigation";
import { resolvePageHeaderContext, resolvePageBreadcrumbs } from "../../../navigation/page-header-context";
import { getTrainerScopedRoutes } from "../../../navigation/profile-route-scope";
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", secondaryBg: "#222" } }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("expo-router", () => ({ usePathname: () => "/class/123", useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock("../../../navigation/use-trainer-route-scope", () => ({ useTrainerRouteScope: () => jest.requireActual("../../../navigation/profile-route-scope").getTrainerScopedRoutes("coord") }));
jest.mock("../../../navigation/primary-route-navigation", () => ({ navigateToPrimaryRoute: jest.fn() }));
it("opens the classes tab through anchored primary navigation instead of landing on Home", () => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(React.createElement(BackTitleHeader, { title: "Hipopótamos", onBack: jest.fn() })); });
  const link = r.root.findAll(n => n.props.accessibilityRole === "link" && n.props.onPress).find(n => n.props.accessibilityLabel === "Ir para Turmas")!;
  act(() => link.props.onPress());
  expect(navigateToPrimaryRoute).toHaveBeenCalledWith(expect.objectContaining({ href: "/coord/classes" }));
  act(() => r.unmount());
});
it("keeps back navigation separate from the title and accessory", () => {
  const back = jest.fn(); let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(React.createElement(PageBreadcrumbHeader, { title: "Hipopótamos", context: "Turmas", onBack: back, accessory: React.createElement(Text, null, "Misto") })); });
  const button = r.root.findAll(n => n.props.accessibilityRole === "button" && n.props.onPress)[0];
  expect(button.props.accessibilityLabel).toBe("Voltar de Hipopótamos");
  expect(button.findAll(n => n.props.children === "Misto")).toHaveLength(0);
  expect(JSON.stringify(r.toJSON())).toContain("Turmas");
  expect(r.root.findAll(n => n.props.accessibilityRole === "header")[0].props.children).toBe("Hipopótamos");
  act(() => button.props.onPress()); expect(back).toHaveBeenCalledTimes(1); act(() => r.unmount());
});
it("navigates ancestors independently and keeps the current page non-clickable", () => {
  const home = jest.fn(), classes = jest.fn(), back = jest.fn(); let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(React.createElement(PageBreadcrumbHeader, { title: "Hipopótamos", onBack: back, breadcrumbs: [{ label: "Início", onPress: home }, { label: "Turmas", onPress: classes }] })); });
  const links = r.root.findAll(n => n.props.accessibilityRole === "link" && n.props.onPress);
  act(() => links.find(n => n.props.accessibilityLabel === "Ir para Turmas")!.props.onPress());
  expect(classes).toHaveBeenCalledTimes(1); expect(home).not.toHaveBeenCalled(); expect(back).not.toHaveBeenCalled();
  expect(links.some(n => n.props.accessibilityLabel === "Ir para Hipopótamos")).toBe(false);
  act(() => r.unmount());
});
it.each(["coord", "prof"] as const)("keeps ancestors inside the %s route scope", scope => {
  const routes = getTrainerScopedRoutes(scope);
  expect(resolvePageBreadcrumbs(`/${scope}/classes`, "Turmas", routes)).toEqual([{ label: "Início", href: routes.home }]);
  expect(resolvePageBreadcrumbs("/class/123", "Hipopótamos", routes)).toEqual([{ label: "Início", href: routes.home }, { label: "Turmas", href: routes.classes }]);
});
it.each([
  ["/class/123/attendance", "Chamada", "Turmas"],
  ["/coord/management", "Coordenação", "Gestão"],
  ["/prof/profile", "Configurações", "Meu perfil"],
  ["/classes", "Turmas", "Go Atleta"],
  ["/unknown", "Detalhes", "Go Atleta"],
])("resolves display context for %s", (path, title, expected) => {
  expect(resolvePageHeaderContext(path, title)).toBe(expected);
});
