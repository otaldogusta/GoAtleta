import type { TrainerScopedRoutes } from "./profile-route-scope";
import { getScopedProfilePath } from "./profile-routes";

/** Display context for the current section. */
export function resolvePageHeaderContext(pathname: string, title: string): string {
  const path = pathname.replace(/^\/(coord|prof|student|family)(?=\/)/, "");
  const sections: [RegExp, string][] = [
    [/^\/class(?:\/|$)/, "Turmas"], [/^\/students?(?:\/|$)/, "Atletas"],
    [/^\/classes(?:\/|$)/, "Turmas"], [/^\/(training|exercises)(?:\/|$)/, "Planejamento"],
    [/^\/periodization(?:\/|$)/, "Periodização"], [/^\/(management|coordination)(?:\/|$)/, "Gestão"],
    [/^\/(finance|financial)(?:\/|$)/, "Financeiro"], [/^\/(calendar|events|agenda)(?:\/|$)/, "Agenda"],
    [/^\/profile(?:\/|$)/, "Meu perfil"], [/^\/(reports|absence-report)(?:\/|$)/, "Relatórios"],
  ];
  const context = sections.find(([pattern]) => pattern.test(path))?.[1] ?? "Go Atleta";
  return context.toLocaleLowerCase("pt-BR") === title.toLocaleLowerCase("pt-BR") ? "Go Atleta" : context;
}

export function resolvePageBreadcrumbs(pathname: string, title: string, routes: TrainerScopedRoutes, context?: string) {
  const section = context ?? resolvePageHeaderContext(pathname, title);
  const destinations: Record<string, string> = {
    Turmas: routes.classes, Atletas: routes.students, Alunos: routes.students,
    Planejamento: routes.planning, Periodização: routes.periodization,
    Agenda: routes.events, "Meu perfil": getScopedProfilePath(pathname), Relatórios: routes.reports,
    ...(routes.scope === "coord" ? { Gestão: "/coord/management", Equipe: "/coord/management", Financeiro: "/coord/finance" } : {}),
  };
  const home = /^\/student(\/|$)/.test(pathname) ? "/student/home" : routes.home;
  const result = [{ label: "Início", href: home as string }];
  const href = destinations[section];
  if (href && section.toLocaleLowerCase("pt-BR") !== title.toLocaleLowerCase("pt-BR") && pathname !== href) {
    result.push({ label: section, href });
  }
  return result;
}
