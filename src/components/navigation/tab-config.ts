import type { ComponentProps } from "react";
import type { Href } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export type AppRole = "prof" | "student" | "coord";
export type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type TabItemConfig = {
  key: string;
  routeName: string;
  label: string;
  icon: IoniconName;
  isCenter?: boolean;
};

export type RadialAction = {
  id: string;
  label: string;
  icon: IoniconName;
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
    { key: "home", routeName: "home", label: "Hoje", icon: "home-outline" },
    { key: "classes", routeName: "classes", label: "Turmas", icon: "people-outline" },
    COMMON_CENTER_TAB,
    { key: "planning", routeName: "planning", label: "Planejamento", icon: "calendar-outline" },
    { key: "reports", routeName: "reports", label: "Relatórios", icon: "stats-chart-outline" },
  ],
  student: [
    { key: "home", routeName: "home", label: "Hoje", icon: "home-outline" },
    { key: "agenda", routeName: "agenda", label: "Agenda", icon: "today-outline" },
    COMMON_CENTER_TAB,
    { key: "achievements", routeName: "achievements", label: "Conquistas", icon: "ribbon-outline" },
    { key: "profile", routeName: "profile", label: "Perfil", icon: "person-outline" },
  ],
  coord: [
    { key: "dashboard", routeName: "dashboard", label: "Painel", icon: "grid-outline" },
    { key: "classes", routeName: "classes", label: "Turmas", icon: "people-outline" },
    COMMON_CENTER_TAB,
    { key: "reports", routeName: "reports", label: "Relatórios", icon: "stats-chart-outline" },
    { key: "management", routeName: "management", label: "Gestão", icon: "settings-outline" },
  ],
};

export const ROLE_RADIAL_ACTIONS: Record<AppRole, RadialAction[]> = {
  prof: [
    { id: "attendance", label: "Chamada", icon: "checkmark-done-outline", href: "/classes" },
    { id: "planning", label: "Criar plano", icon: "clipboard-outline", href: "/training" },
    { id: "students", label: "Adicionar aluno", icon: "person-add-outline", href: "/students" },
    { id: "assistant", label: "Assistente IA", icon: "sparkles-outline", href: "/assistant" },
  ],
  student: [
    { id: "plan", label: "Plano", icon: "fitness-outline", href: "/student-plan" },
    { id: "feedback", label: "Feedback", icon: "chatbox-ellipses-outline", href: "/absence-report" },
    { id: "communications", label: "Comunicados", icon: "megaphone-outline", href: "/communications" },
    { id: "scouting", label: "Scouting", icon: "analytics-outline", href: "/student-scouting" },
    { id: "assistant", label: "Assistente IA", icon: "sparkles-outline", href: "/assistant" },
  ],
  coord: [
    { id: "event", label: "Criar evento", icon: "calendar-clear-outline", href: "/events" },
    { id: "members", label: "Membros", icon: "people-circle-outline", href: "/org-members" },
    { id: "communications", label: "Comunicado", icon: "megaphone-outline", href: "/communications" },
    { id: "cycle", label: "Turma/Ciclo", icon: "layers-outline", href: "/periodization" },
    { id: "assistant", label: "Assistente IA", icon: "sparkles-outline", href: "/assistant" },
  ],
};
