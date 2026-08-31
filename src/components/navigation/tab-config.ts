import type { Href } from "expo-router";

import type { GoAtletaIconName } from "../../ui/icon-registry";

export type AppRole = "prof" | "student" | "family" | "coord";

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
    { key: "profile", routeName: "profile", label: "Perfil", icon: "profile", href: "/prof/profile" },
  ],
  student: [
    { key: "home", routeName: "home", label: "Hoje", icon: "home", href: "/student/home" },
    { key: "agenda", routeName: "agenda", label: "Agenda", icon: "agenda", href: "/student/agenda" },
    COMMON_CENTER_TAB,
    { key: "achievements", routeName: "achievements", label: "Conquistas", icon: "achievements", href: "/student/achievements" },
    { key: "profile", routeName: "profile", label: "Perfil", icon: "profile", href: "/student/profile" },
  ],
  family: [
    { key: "home", routeName: "home", label: "Hoje", icon: "home", href: "/family/home" },
    { key: "agenda", routeName: "agenda", label: "Agenda", icon: "agenda", href: "/family/agenda" },
    { key: "payments", routeName: "payments", label: "Pagamentos", icon: "payments", href: "/family/payments" },
    { key: "profile", routeName: "profile", label: "Perfil", icon: "profile", href: "/family/profile" },
  ],
  coord: [
    { key: "dashboard", routeName: "dashboard", label: "Painel", icon: "home", href: "/coord/dashboard" },
    { key: "classes", routeName: "classes", label: "Turmas", icon: "classes", href: "/coord/classes" },
    COMMON_CENTER_TAB,
    { key: "planning", routeName: "planning", label: "Planejamento", icon: "planning", href: "/coord/planning" },
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
    { id: "communications", label: "Avisos", icon: "absenceNotices", href: "/communications" },
    { id: "scouting", label: "Scouting", icon: "scouting", href: "/student-scouting" },
    { id: "assistant", label: "Assistente", icon: "assistant", href: "/assistant" },
  ],
  family: [],
  coord: [
    { id: "event", label: "Criar evento", icon: "events", href: "/coord/events" },
    { id: "communications", label: "Avisos", icon: "absenceNotices", href: "/coord/communications" },
    { id: "cycle", label: "Ciclos", icon: "periodization", href: "/coord/periodization" },
    { id: "finance", label: "Financeiro", icon: "payments", href: "/coord/finance" },
    { id: "assistant", label: "Assistente", icon: "assistant", href: "/coord/assistant" },
  ],
};
