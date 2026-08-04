import type { Href } from "expo-router";

import type { GoAtletaIconName } from "../../ui/icon-registry";

export type AppRole = "prof" | "student" | "coord";

type BaseTabItemConfig = {
  key: string;
  routeName: string;
  label: string;
  icon: GoAtletaIconName;
};

export type TabItemConfig =
  | (BaseTabItemConfig & {
      href: Href;
      isCenter?: false;
    })
  | (BaseTabItemConfig & {
      href?: never;
      isCenter: true;
    });

export type RadialAction = {
  id: string;
  label: string;
  icon: GoAtletaIconName;
  href: Href;
};

const COMMON_CENTER_TAB: TabItemConfig = {
  key: "actions",
  routeName: "actions",
  label: "+",
  icon: "add",
  isCenter: true,
};

export const ROLE_TABS: Record<AppRole, TabItemConfig[]> = {
  prof: [
    { key: "home", routeName: "home", label: "Hoje", icon: "home", href: "/prof/home" },
    { key: "classes", routeName: "classes", label: "Turmas", icon: "classes", href: "/prof/classes" },
    COMMON_CENTER_TAB,
    { key: "planning", routeName: "planning", label: "Planejamento", icon: "planning", href: "/prof/planning" },
    { key: "reports", routeName: "reports", label: "Relatórios", icon: "reports", href: "/prof/reports" },
  ],
  student: [
    { key: "home", routeName: "home", label: "Hoje", icon: "home", href: "/student/home" },
    { key: "agenda", routeName: "agenda", label: "Agenda", icon: "agenda", href: "/student/agenda" },
    COMMON_CENTER_TAB,
    { key: "achievements", routeName: "achievements", label: "Conquistas", icon: "achievements", href: "/student/achievements" },
    { key: "profile", routeName: "profile", label: "Perfil", icon: "profile", href: "/student/profile" },
  ],
  coord: [
    { key: "dashboard", routeName: "dashboard", label: "Painel", icon: "home", href: "/coord/dashboard" },
    { key: "classes", routeName: "classes", label: "Turmas", icon: "classes", href: "/coord/classes" },
    COMMON_CENTER_TAB,
    { key: "reports", routeName: "reports", label: "Relatórios", icon: "reports", href: "/coord/reports" },
    { key: "management", routeName: "management", label: "Gestão", icon: "management", href: "/coord/management" },
  ],
};

export const ROLE_RADIAL_ACTIONS: Record<AppRole, RadialAction[]> = {
  prof: [
    { id: "attendance", label: "Chamada", icon: "attendance", href: "/prof/classes" },
    { id: "planning", label: "Criar plano", icon: "planning", href: "/prof/planning" },
    { id: "students", label: "Adicionar aluno", icon: "addStudent", href: "/prof/students" },
    { id: "assistant", label: "Assistente", icon: "assistant", href: "/prof/assistant" },
  ],
  student: [
    { id: "plan", label: "Plano", icon: "plan", href: "/student-plan" },
    { id: "feedback", label: "Feedback", icon: "feedback", href: "/absence-report" },
    { id: "communications", label: "Comunicados", icon: "communications", href: "/communications" },
    { id: "scouting", label: "Scouting", icon: "scouting", href: "/student-scouting" },
    { id: "assistant", label: "Assistente", icon: "assistant", href: "/assistant" },
  ],
  coord: [
    { id: "event", label: "Criar evento", icon: "events", href: "/coord/events" },
    { id: "members", label: "Membros", icon: "members", href: "/coord/org-members" },
    { id: "communications", label: "Comunicado", icon: "communications", href: "/coord/communications" },
    { id: "cycle", label: "Turma/Ciclo", icon: "periodization", href: "/coord/periodization" },
    { id: "assistant", label: "Assistente", icon: "assistant", href: "/coord/assistant" },
  ],
};
