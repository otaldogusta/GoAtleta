import { resolvePageBreadcrumbs } from "../page-header-context";
import { getTrainerScopedRoutes } from "../profile-route-scope";
import { getScopedProfilePath, getScopedProfileSettingsPath } from "../profile-routes";

it("returns from athlete settings to the overview rather than another role or the form itself", () => {
  const overview = "/student/profile";
  const settings = getScopedProfileSettingsPath(overview);
  expect(settings).toBe("/student/profile/settings");
  expect(getScopedProfilePath(settings)).toBe(overview);
  expect(resolvePageBreadcrumbs(settings, "Configurações", getTrainerScopedRoutes("prof"))).toEqual([
    { label: "Início", href: "/student/home" },
    { label: "Meu perfil", href: overview },
  ]);
});
