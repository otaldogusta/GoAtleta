import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "../auth/auth";
import { useRole } from "../auth/role";
import { ROLE_TABS, type AppRole, type IoniconName } from "../components/navigation/tab-config";
import type { ClassGroup } from "../core/models";
import type { DevProfilePreview } from "../dev/profile-preview";
import { getClasses } from "../db/classes";
import { getStudents } from "../db/students";
import { getScopedProfilePath } from "../navigation/profile-routes";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { brandPalette, radius } from "../theme/tokens";
import { Pressable } from "./Pressable";
import { buildWebSidebarViewModel } from "./web-sidebar-view-model";
import { webShellTokens } from "./web-shell-tokens";

type WebSidebarProps = {
  role: AppRole;
};

type SidebarItem = {
  key: string;
  label: string;
  href: string;
  icon: IoniconName;
  badge?: string;
};

type ProfileSwitchId = Exclude<DevProfilePreview, "auto">;

const SIDEBAR_COMPACT_WIDTH = 88;
const SIDEBAR_EXPANDED_WIDTH = 292;
const SIDEBAR_EXPANDED_STORAGE_KEY = "goatleta:web-sidebar-expanded";

const roleTitle: Record<AppRole, string> = {
  prof: "GoAtleta",
  coord: "GoAtleta",
  student: "GoAtleta",
};

const roleSubtitle: Record<AppRole, string> = {
  prof: "Painel do professor",
  coord: "Painel operacional",
  student: "Minha rotina",
};

const routePrefix: Record<AppRole, string> = {
  prof: "/prof",
  coord: "/coord",
  student: "/student",
};

const roleProfileLabel: Record<AppRole, string> = {
  prof: "Professor",
  coord: "Coordenação",
  student: "Aluno",
};

const rolePreview: Record<AppRole, ProfileSwitchId> = {
  prof: "professor",
  coord: "admin",
  student: "student",
};

const previewRoutes: Record<ProfileSwitchId, string> = {
  professor: "/prof/home",
  admin: "/coord/dashboard",
  student: "/student/home",
};

const profileSwitchOptions: ReadonlyArray<{
  id: ProfileSwitchId;
  label: string;
  subtitle: string;
  icon: IoniconName;
}> = [
  {
    id: "professor",
    label: "Professor",
    subtitle: "Painel do professor",
    icon: "school-outline",
  },
  {
    id: "admin",
    label: "Coordenação",
    subtitle: "Painel operacional",
    icon: "briefcase-outline",
  },
  {
    id: "student",
    label: "Aluno",
    subtitle: "Rotina do atleta",
    icon: "person-outline",
  },
];

const getDisplayName = (session: ReturnType<typeof useAuth>["session"]) => {
  const user = session?.user as
    | { email?: string; user_metadata?: Record<string, unknown> }
    | undefined;
  const metadataName = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }
  if (user?.email) return user.email.split("@")[0] ?? "Professor";
  return "Professor";
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || "P"
  );
};

const getUserEmail = (session: ReturnType<typeof useAuth>["session"]) => {
  const user = session?.user as { email?: string } | undefined;
  return user?.email ?? "";
};

export function WebSidebar({ role }: WebSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useAuth();
  const { refresh: refreshRole } = useRole();
  const organizationContext = useOptionalOrganization();
  const organizationId =
    organizationContext?.activeOrganizationId ?? organizationContext?.activeOrganization?.id ?? null;
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpandedState] = useState(false);
  const [hoveredCompactItemKey, setHoveredCompactItemKey] = useState<string | null>(null);
  const [compactTooltip, setCompactTooltip] = useState<{
    key: string;
    label: string;
    top: number;
  } | null>(null);
  const profileMenuRootRef = useRef<View | null>(null);

  const expanded = sidebarExpanded;
  const professorName = getDisplayName(session);
  const professorInitials = getInitials(professorName);
  const userEmail = getUserEmail(session);
  const setDevProfilePreview = organizationContext?.setDevProfilePreview;
  const canSwitchProfile = __DEV__ && Boolean(setDevProfilePreview);
  const selectedPreview = rolePreview[role];
  const profilePath = getScopedProfilePath(pathname || `${routePrefix[role]}/home`);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY);
    if (stored === "expanded") {
      setSidebarExpandedState(true);
    } else if (stored === "compact") {
      setSidebarExpandedState(false);
    }
  }, []);

  const setSidebarExpanded = useCallback((nextExpanded: boolean) => {
    setSidebarExpandedState(nextExpanded);
    if (!nextExpanded) {
      setProfileMenuOpen(false);
    }
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      SIDEBAR_EXPANDED_STORAGE_KEY,
      nextExpanded ? "expanded" : "compact"
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    if (role !== "prof") {
      setClasses([]);
      setStudentCount(0);
      return () => {
        mounted = false;
      };
    }

    const loadSidebarData = async () => {
      const [nextClasses, nextStudents] = await Promise.all([
        getClasses({ organizationId }).catch(() => [] as ClassGroup[]),
        getStudents({ organizationId }).catch(() => []),
      ]);

      if (!mounted) return;
      setClasses(nextClasses);
      setStudentCount(nextStudents.length);
    };

    void loadSidebarData();

    return () => {
      mounted = false;
    };
  }, [organizationId, role]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!expanded) {
      setProfileMenuOpen(false);
    }
  }, [expanded]);

  useEffect(() => {
    if (!profileMenuOpen || typeof document === "undefined") return;

    const isEventInsideMenu = (target: EventTarget | null) => {
      if (typeof Node === "undefined" || !(target instanceof Node)) return false;
      const rootElement = profileMenuRootRef.current as unknown as HTMLElement | null;
      return Boolean(rootElement?.contains(target));
    };

    const closeMenu = () => {
      setProfileMenuOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isEventInsideMenu(event.target)) return;
      closeMenu();
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isEventInsideMenu(event.target)) return;
      closeMenu();
    };

    const handleScroll = (event: Event) => {
      if (isEventInsideMenu(event.target)) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMenu();
    };

    const handleVisibilityOrBlur = () => {
      closeMenu();
    };

    window.addEventListener("blur", handleVisibilityOrBlur);
    document.addEventListener("visibilitychange", handleVisibilityOrBlur);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("blur", handleVisibilityOrBlur);
      document.removeEventListener("visibilitychange", handleVisibilityOrBlur);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [profileMenuOpen]);

  const viewModel = useMemo(
    () =>
      buildWebSidebarViewModel({
        classes,
        studentCount,
        unreadCount: 0,
      }),
    [classes, studentCount]
  );

  const applyProfilePreview = useCallback(
    async (preview: ProfileSwitchId) => {
      if (!setDevProfilePreview) return;
      setProfileMenuOpen(false);
      await setDevProfilePreview(preview);
      await refreshRole();
      router.replace(previewRoutes[preview] as never);
    },
    [refreshRole, router, setDevProfilePreview]
  );

  const compactTabs = ROLE_TABS[role].filter((tab) => !tab.isCenter);
  const tabItems = compactTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: `${routePrefix[role]}/${tab.routeName}`,
    icon: tab.icon,
  }));

  const mainItems: SidebarItem[] =
    role === "prof"
      ? tabItems.map((item) => {
          if (item.key === "home") {
            return {
              ...item,
              badge: viewModel.todayClassCount ? String(viewModel.todayClassCount) : undefined,
            };
          }
          if (item.key === "classes") {
            return {
              ...item,
              badge: viewModel.totalClasses ? String(viewModel.totalClasses) : undefined,
            };
          }
          return item;
        })
      : role === "coord"
        ? tabItems.map((item) =>
            item.key === "classes" && viewModel.totalClasses
              ? { ...item, badge: String(viewModel.totalClasses) }
              : item
          )
        : tabItems;

  const operationalItemsByRole: Record<AppRole, SidebarItem[]> = {
    prof: [
      {
        key: "students",
        label: "Alunos",
        href: "/prof/students",
        icon: "school-outline",
        badge: viewModel.totalStudents ? String(viewModel.totalStudents) : undefined,
      },
      {
        key: "calendar",
        label: "Calendário semanal",
        href: "/prof/calendar",
        icon: "calendar-outline",
      },
      {
        key: "absence",
        label: "Avisos de ausência",
        href: "/prof/absence-notices",
        icon: "notifications-outline",
      },
      {
        key: "exercises",
        label: "Biblioteca",
        href: "/prof/exercises",
        icon: "book-outline",
      },
      {
        key: "periodization",
        label: "Periodização",
        href: "/prof/periodization",
        icon: "trending-up-outline",
      },
      {
        key: "regulation-history",
        label: "Regulamentos",
        href: "/prof/regulation-history",
        icon: "layers-outline",
      },
    ],
    coord: [
      {
        key: "events",
        label: "Eventos",
        href: "/coord/events",
        icon: "calendar-clear-outline",
      },
      {
        key: "members",
        label: "Membros",
        href: "/coord/org-members",
        icon: "people-circle-outline",
      },
      {
        key: "communications",
        label: "Comunicados",
        href: "/coord/communications",
        icon: "megaphone-outline",
      },
      {
        key: "periodization",
        label: "Periodização",
        href: "/coord/periodization",
        icon: "layers-outline",
      },
      {
        key: "regulation-history",
        label: "Regulamentos",
        href: "/coord/regulation-history",
        icon: "reader-outline",
      },
      {
        key: "assistant",
        label: "Assistente",
        href: "/coord/assistant",
        icon: "sparkles-outline",
      },
    ],
    student: [
      {
        key: "plan",
        label: "Plano",
        href: "/student-plan",
        icon: "fitness-outline",
      },
      {
        key: "feedback",
        label: "Feedback",
        href: "/absence-report",
        icon: "chatbox-ellipses-outline",
      },
      {
        key: "communications",
        label: "Comunicados",
        href: "/communications",
        icon: "megaphone-outline",
      },
      {
        key: "scouting",
        label: "Scouting",
        href: "/student-scouting",
        icon: "analytics-outline",
      },
    ],
  };
  const operationalItems = operationalItemsByRole[role];

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === "/prof/home" && pathname === "/prof");

  const renderCompactNavItem = (item: SidebarItem) => {
    const active = isActive(item.href);
    const hovered = hoveredCompactItemKey === item.key;
    const showCompactTooltip = (event?: unknown) => {
      setHoveredCompactItemKey(item.key);

      const target = (event as { currentTarget?: { getBoundingClientRect?: () => DOMRect } } | undefined)
        ?.currentTarget;
      const rect = target?.getBoundingClientRect?.();
      if (!rect) {
        return;
      }

      setCompactTooltip({
        key: item.key,
        label: item.label,
        top: rect.top + rect.height / 2,
      });
    };
    const hideCompactTooltip = () => {
      setHoveredCompactItemKey((current) => (current === item.key ? null : current));
      setCompactTooltip((current) => (current?.key === item.key ? null : current));
    };
    const compactTooltipEvents = {
      dataSet: { goatletaSidebarTooltip: item.label },
      "data-goatleta-sidebar-tooltip": item.label,
      onMouseEnter: showCompactTooltip,
      onMouseLeave: hideCompactTooltip,
      onPointerEnter: showCompactTooltip,
      onPointerLeave: hideCompactTooltip,
    } as any;

    return (
      <Pressable
        {...compactTooltipEvents}
        key={item.key}
        accessibilityLabel={item.label}
        suppressWebHoverFeedback
        onHoverIn={showCompactTooltip}
        onHoverOut={hideCompactTooltip}
        onPress={() => {
          setProfileMenuOpen(false);
          router.push(item.href as never);
        }}
        style={{
          width: 58,
          minHeight: 52,
          borderRadius: radius.card,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active ? webShellTokens.primarySoft : "transparent",
          borderWidth: 1,
          borderColor: active ? webShellTokens.primary : "transparent",
        }}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? "rgba(65, 217, 132, 0.16)" : webShellTokens.sidebarSoft,
          }}
        >
          <Ionicons
            name={item.icon}
            size={20}
            color={active ? webShellTokens.primary : "rgba(255,255,255,0.70)"}
          />
        </View>
        {item.badge ? (
          <View
            style={{
              position: "absolute",
              top: 4,
              right: 5,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              paddingHorizontal: 5,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.14)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.12)",
            }}
          >
            <Text style={{ color: brandPalette.white, fontSize: 9, fontWeight: "900" }}>
              {item.badge}
            </Text>
          </View>
        ) : null}
        {hovered && !compactTooltip ? (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 68,
              top: 8,
              zIndex: 10000,
              minHeight: 34,
              justifyContent: "center",
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "rgba(15,23,42,0.98)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
            } as any}
          >
            <Text
              style={{
                color: brandPalette.white,
                fontSize: 12,
                fontWeight: "800",
                whiteSpace: "nowrap",
              } as any}
            >
              {item.label}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  if (!expanded) {
    return (
      <View
        style={{
          width: SIDEBAR_COMPACT_WIDTH,
          alignSelf: "stretch",
          backgroundColor: webShellTokens.sidebar,
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.06)",
          paddingVertical: 18,
          paddingHorizontal: 10,
          gap: 18,
          position: "relative",
          zIndex: 1000,
          overflow: "visible",
        }}
      >
        {compactTooltip ? (
          <View
            pointerEvents="none"
            style={{
              position: "fixed",
              left: SIDEBAR_COMPACT_WIDTH - 4,
              top: compactTooltip.top,
              zIndex: 10000,
              minHeight: 34,
              justifyContent: "center",
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: "rgba(15,23,42,0.98)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.28)",
              transform: [{ translateY: -17 }],
            } as any}
          >
            <Text
              style={{
                color: brandPalette.white,
                fontSize: 12,
                fontWeight: "800",
                whiteSpace: "nowrap",
              } as any}
            >
              {compactTooltip.label}
            </Text>
          </View>
        ) : null}
        <View style={{ alignItems: "center", gap: 10 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 16,
              backgroundColor: webShellTokens.sidebarSoft,
              borderWidth: 1,
              borderColor: webShellTokens.sidebarHover,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="football-outline" size={22} color={brandPalette.white} />
          </View>
          <Pressable
            accessibilityLabel="Expandir menu"
            onPress={() => setSidebarExpanded(true)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Ionicons name="chevron-forward-outline" size={18} color="rgba(255,255,255,0.76)" />
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1, minHeight: 0, overflow: "visible" } as any}
          contentContainerStyle={{ gap: 8, alignItems: "center", paddingVertical: 2 }}
          showsVerticalScrollIndicator={false}
        >
          {mainItems.map(renderCompactNavItem)}
          {operationalItems.length ? (
            <View
              style={{
                width: 34,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.10)",
                marginVertical: 4,
              }}
            />
          ) : null}
          {operationalItems.map(renderCompactNavItem)}
        </ScrollView>

        <Pressable
          accessibilityLabel="Abrir menu de perfil"
          onPress={() => setSidebarExpanded(true)}
          style={{
            width: 58,
            height: 58,
            borderRadius: 18,
            alignSelf: "center",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(65, 217, 132, 0.18)",
              borderWidth: 1,
              borderColor: "rgba(65, 217, 132, 0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: webShellTokens.primary, fontSize: 12, fontWeight: "900" }}>
              {professorInitials}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  }

  const renderNavItem = (item: SidebarItem) => {
    const active = isActive(item.href);
    return (
      <Pressable
        key={item.key}
        onPress={() => {
          setProfileMenuOpen(false);
          router.push(item.href as never);
        }}
        style={{
          minHeight: 46,
          borderRadius: radius.card,
          paddingHorizontal: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: active ? webShellTokens.primarySoft : "transparent",
          borderWidth: 1,
          borderColor: active ? webShellTokens.primary : "transparent",
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? "rgba(65, 217, 132, 0.16)" : webShellTokens.sidebarSoft,
          }}
        >
          <Ionicons
            name={item.icon}
            size={17}
            color={active ? webShellTokens.primary : "rgba(255,255,255,0.68)"}
          />
        </View>
        <Text
          style={{
            flex: 1,
            color: active ? brandPalette.white : "rgba(255,255,255,0.72)",
            fontSize: 13,
            fontWeight: active ? "800" : "700",
          }}
          numberOfLines={1}
        >
          {item.label}
        </Text>
        {item.badge ? (
          <View
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              paddingHorizontal: 7,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: webShellTokens.sidebarSoft,
              borderWidth: 1,
              borderColor: webShellTokens.sidebarHover,
            }}
          >
            <Text style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "800" }}>
              {item.badge}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        width: SIDEBAR_EXPANDED_WIDTH,
        alignSelf: "stretch",
        backgroundColor: webShellTokens.sidebar,
        borderRightWidth: 1,
        borderRightColor: "rgba(255,255,255,0.06)",
        paddingVertical: 18,
        paddingHorizontal: 14,
        gap: 14,
        position: "relative",
        zIndex: 1000,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            backgroundColor: webShellTokens.sidebarSoft,
            borderWidth: 1,
            borderColor: webShellTokens.sidebarHover,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="football-outline" size={22} color={brandPalette.white} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: brandPalette.white, fontSize: 15, fontWeight: "900" }}>
            {roleTitle[role]}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.58)", fontSize: 11 }}>
            {roleSubtitle[role]}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Recolher menu"
          onPress={() => setSidebarExpanded(false)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
          }}
        >
          <Ionicons name="chevron-back-outline" size={18} color="rgba(255,255,255,0.76)" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 6 }}>
          <Text
            style={{
              color: "rgba(255,255,255,0.46)",
              fontSize: 10,
              fontWeight: "900",
              paddingHorizontal: 4,
            }}
          >
            PRINCIPAL
          </Text>
          {mainItems.map(renderNavItem)}
        </View>

        {operationalItems.length ? (
          <View style={{ gap: 6 }}>
            <Text
              style={{
                color: "rgba(255,255,255,0.46)",
                fontSize: 10,
                fontWeight: "900",
                paddingHorizontal: 4,
              }}
            >
              OPERACIONAL
            </Text>
            {operationalItems.map(renderNavItem)}
          </View>
        ) : null}
      </ScrollView>

      <View ref={profileMenuRootRef} style={{ position: "relative" }}>
        {profileMenuOpen ? (
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 68,
              zIndex: 30,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.14)",
              backgroundColor: "rgba(31,41,55,0.98)",
              padding: 10,
              gap: 6,
              boxShadow: "0 18px 44px rgba(0,0,0,0.35)",
            } as any}
          >
            <View style={{ paddingHorizontal: 8, paddingVertical: 6, gap: 2 }}>
              <Text style={{ color: brandPalette.white, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
                {professorName}
              </Text>
              {userEmail ? (
                <Text style={{ color: "rgba(255,255,255,0.52)", fontSize: 11 }} numberOfLines={1}>
                  {userEmail}
                </Text>
              ) : null}
            </View>

            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 2 }} />

            <Pressable
              onPress={() => {
                setProfileMenuOpen(false);
                router.push(profilePath as never);
              }}
              style={{
                minHeight: 42,
                borderRadius: 12,
                paddingHorizontal: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <Ionicons name="person-circle-outline" size={18} color="rgba(255,255,255,0.78)" />
              <Text style={{ flex: 1, color: brandPalette.white, fontSize: 13, fontWeight: "700" }}>
                Perfil
              </Text>
            </Pressable>

            {canSwitchProfile ? (
              <>
                <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.10)", marginVertical: 2 }} />
                <Text
                  style={{
                    color: "rgba(255,255,255,0.44)",
                    fontSize: 10,
                    fontWeight: "900",
                    paddingHorizontal: 10,
                    paddingTop: 2,
                  }}
                >
                  TROCAR PERFIL
                </Text>
                {profileSwitchOptions.map((option) => {
                  const active = selectedPreview === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => void applyProfilePreview(option.id)}
                      style={{
                        minHeight: 44,
                        borderRadius: 12,
                        paddingHorizontal: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: active ? "rgba(255,255,255,0.10)" : "transparent",
                      }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={17}
                        color={active ? webShellTokens.primary : "rgba(255,255,255,0.70)"}
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{
                            color: active ? brandPalette.white : "rgba(255,255,255,0.86)",
                            fontSize: 13,
                            fontWeight: "800",
                          }}
                          numberOfLines={1}
                        >
                          {option.label}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.46)", fontSize: 10 }} numberOfLines={1}>
                          {option.subtitle}
                        </Text>
                      </View>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={16} color={webShellTokens.primary} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </View>
        ) : null}

        <Pressable
          onPress={() => setProfileMenuOpen((current) => !current)}
          style={{
            minHeight: 58,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: profileMenuOpen ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
            backgroundColor: profileMenuOpen ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.08)",
            paddingHorizontal: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: "rgba(65, 217, 132, 0.18)",
              borderWidth: 1,
              borderColor: "rgba(65, 217, 132, 0.35)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: webShellTokens.primary, fontSize: 12, fontWeight: "900" }}>
              {professorInitials}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: brandPalette.white, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
              {professorName}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.56)", fontSize: 11 }} numberOfLines={1}>
              {roleProfileLabel[role]}
            </Text>
          </View>
          <Ionicons
            name={profileMenuOpen ? "chevron-down-outline" : "chevron-up-outline"}
            size={17}
            color="rgba(255,255,255,0.62)"
          />
        </Pressable>
      </View>
    </View>
  );
}
