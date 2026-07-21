import { usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "../auth/auth";
import { useRole, type UserRole } from "../auth/role";
import {
  getTrainerPermissionKey,
  isTrainerPathAllowed,
} from "../auth/route-permissions";
import { ROLE_TABS, type AppRole } from "../components/navigation/tab-config";
import { getScopedProfilePath } from "../navigation/profile-routes";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { brandPalette, radius } from "../theme/tokens";
import { Pressable } from "./Pressable";
import { decorativeIconProps } from "./decorative-icon-props";
import { GoAtletaIcon, type GoAtletaIconName } from "./icon-registry";
import {
  resolveVisibleProfileSwitchIds,
  type ProfileSwitchId,
} from "./profile-switch-options";
import { webShellTokens } from "./web-shell-tokens";

type WebSidebarProps = {
  role: AppRole;
  canExpand: boolean;
};

type SidebarItem = {
  key: string;
  label: string;
  href: string;
  icon: GoAtletaIconName;
  badge?: string;
};

const SIDEBAR_COMPACT_WIDTH = 88;
const SIDEBAR_EXPANDED_WIDTH = 292;
const SIDEBAR_EXPANDED_STORAGE_KEY = "goatleta:web-sidebar-expanded";

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
  icon: GoAtletaIconName;
}> = [
  {
    id: "professor",
    label: "Professor",
    subtitle: "Painel do professor",
    icon: "professor",
  },
  {
    id: "admin",
    label: "Coordenação",
    subtitle: "Painel operacional",
    icon: "coordination",
  },
  {
    id: "student",
    label: "Aluno",
    subtitle: "Rotina do atleta",
    icon: "student",
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

function BrandMark({ size = 46 }: { size?: number }) {
  const outerRadius = Math.round(size * 0.36);
  return (
    <View
      {...decorativeIconProps}
      style={{
        width: size,
        height: size,
        borderRadius: outerRadius,
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Text
        style={{
          color: brandPalette.white,
          fontSize: Math.round(size * 0.30),
          fontWeight: "900",
          lineHeight: Math.round(size * 0.34),
        }}
      >
        GA
      </Text>
    </View>
  );
}

function BrandWordmark({ role, fill = true }: { role: AppRole; fill?: boolean }) {
  return (
    <View style={{ flex: fill ? 1 : undefined, minWidth: 0, gap: 2 }}>
      <Text
        style={{ color: brandPalette.white, fontSize: 16, fontWeight: "900", lineHeight: 19 }}
        numberOfLines={1}
      >
        GoAtleta
      </Text>
      <Text
        style={{
          color: "rgba(255,255,255,0.56)",
          fontSize: 11,
          fontWeight: "600",
          lineHeight: 14,
        }}
        numberOfLines={1}
      >
        {roleSubtitle[role]}
      </Text>
    </View>
  );
}

function SidebarToggleButton({
  expanded,
  onPress,
}: {
  expanded: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={expanded ? "Recolher menu" : "Expandir menu"}
      onPress={onPress}
      style={{
        width: 24,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        borderLeftWidth: 1,
        borderLeftColor: "rgba(255,255,255,0.12)",
      }}
    >
      <GoAtletaIcon
        name={expanded ? "chevronBack" : "chevronForward"}
        size={16}
        color="rgba(255,255,255,0.68)"
      />
    </Pressable>
  );
}

export function WebSidebar({ role, canExpand }: WebSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  const { availableRoles, refresh: refreshRole, setActiveRole } = useRole();
  const organizationContext = useOptionalOrganization();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpandedState] = useState(false);
  const [hoveredCompactItemKey, setHoveredCompactItemKey] = useState<string | null>(null);
  const [compactTooltip, setCompactTooltip] = useState<{
    key: string;
    label: string;
    top: number;
  } | null>(null);
  const profileMenuRootRef = useRef<View | null>(null);

  const expanded = canExpand && sidebarExpanded;
  const professorName = getDisplayName(session);
  const professorInitials = getInitials(professorName);
  const setDevProfilePreview = organizationContext?.setDevProfilePreview;
  const memberPermissions = organizationContext?.memberPermissions ?? {};
  const permissionsLoading = organizationContext?.permissionsLoading ?? true;
  const isOrgAdmin = (organizationContext?.activeOrganization?.role_level ?? 0) >= 50;
  const hasHybridAccount = availableRoles.includes("trainer") && availableRoles.includes("student");
  const canSwitchProfile = hasHybridAccount || (__DEV__ && Boolean(setDevProfilePreview));
  const selectedPreview = rolePreview[role];
  const profilePath = getScopedProfilePath(pathname || "/");

  const navigateTo = useCallback(
    (href: string) => {
      if (href === pathname) return;
      router.push(href as never);
    },
    [pathname, router]
  );

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
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!profileMenuOpen) {
      setProfileSwitcherOpen(false);
    }
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!expanded) {
      setProfileMenuOpen(false);
    }
  }, [expanded]);

  useEffect(() => {
    if (!canExpand) {
      setSidebarExpandedState(false);
    }
  }, [canExpand]);

  useEffect(() => {
    if (!expanded || typeof document === "undefined") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarExpanded(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded, setSidebarExpanded]);

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

  const applyProfilePreview = useCallback(
    async (preview: ProfileSwitchId) => {
      setProfileMenuOpen(false);
      const realRole: Extract<UserRole, "trainer" | "student"> =
        preview === "student" ? "student" : "trainer";
      if (hasHybridAccount) {
        if (setDevProfilePreview) {
          await setDevProfilePreview("auto");
        }
        const changed = await setActiveRole(realRole);
        if (!changed) return;
      } else {
        if (!setDevProfilePreview) return;
        await setDevProfilePreview(preview);
        await refreshRole();
      }
      router.replace(previewRoutes[preview] as never);
    },
    [hasHybridAccount, refreshRole, router, setActiveRole, setDevProfilePreview]
  );

  const visibleProfileSwitchIds = resolveVisibleProfileSwitchIds({
    hasHybridAccount,
    isOrgAdmin,
  });
  const visibleProfileSwitchOptions = profileSwitchOptions.filter((option) =>
    visibleProfileSwitchIds.includes(option.id)
  );

  const closeProfileMenu = () => {
    setProfileSwitcherOpen(false);
    setProfileMenuOpen(false);
  };

  const toggleProfileMenu = () => {
    setProfileSwitcherOpen(false);
    setProfileMenuOpen((current) => !current);
  };

  const openProfile = () => {
    closeProfileMenu();
    navigateTo(profilePath);
  };

  const handleSignOut = async () => {
    closeProfileMenu();
    await signOut();
  };

  const renderProfileSwitcher = () => (
    <View
      {...({
        dataSet: { goatletaWorkspaceMenu: "true" },
        "data-goatleta-workspace-menu": "true",
      } as any)}
      accessibilityLabel="Alternar workspace"
      style={{
        position: "absolute",
        zIndex: 3201,
        width: 236,
        left: "calc(100% - 2px)",
        top: 10,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        backgroundColor: "#1F2937",
        padding: 10,
        gap: 4,
        boxShadow: "0 24px 60px rgba(0,0,0,0.42)",
      } as any}
    >
      <Text
        style={{
          color: "rgba(255,255,255,0.48)",
          fontSize: 10,
          fontWeight: "900",
          paddingHorizontal: 10,
          paddingTop: 4,
          paddingBottom: 6,
        }}
      >
        ALTERNAR WORKSPACE
      </Text>

      {visibleProfileSwitchOptions.map((option) => {
        const active = selectedPreview === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityLabel={`Abrir workspace ${option.label}`}
            accessibilityState={{ selected: active }}
            onPress={() => void applyProfilePreview(option.id)}
            style={{
              minHeight: 54,
              borderRadius: radius.card,
              paddingHorizontal: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              backgroundColor: active ? "rgba(255,255,255,0.10)" : "transparent",
            }}
          >
            <GoAtletaIcon
              name={option.icon}
              size={19}
              color={active ? brandPalette.quadra : "rgba(255,255,255,0.70)"}
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
              <Text
                style={{ color: "rgba(255,255,255,0.46)", fontSize: 10 }}
                numberOfLines={1}
              >
                {option.subtitle}
              </Text>
            </View>
            {active ? (
              <GoAtletaIcon
                name="checkmarkCircle"
                size={17}
                color={brandPalette.quadra}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  const renderProfileMenu = (placement: "compact" | "expanded") => (
    <View
      {...({ onMouseLeave: () => setProfileSwitcherOpen(false) } as any)}
      accessibilityLabel="Menu de perfil"
      style={[
        {
          position: placement === "compact" ? "fixed" : "absolute",
          zIndex: 3200,
          width: placement === "compact" ? 304 : undefined,
          left: placement === "compact" ? 14 : 0,
          right: placement === "compact" ? undefined : 0,
          bottom: placement === "compact" ? 88 : 68,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.14)",
          backgroundColor: "#1F2937",
          padding: 10,
          gap: 4,
          boxShadow: "0 24px 60px rgba(0,0,0,0.42)",
        } as any,
      ]}
    >
      {canSwitchProfile && profileSwitcherOpen ? renderProfileSwitcher() : null}

      <Pressable
        {...({
          dataSet: { goatletaWorkspaceTrigger: "true" },
          "data-goatleta-workspace-trigger": "true",
          onMouseEnter: () => canSwitchProfile && setProfileSwitcherOpen(true),
          onPointerEnter: () => canSwitchProfile && setProfileSwitcherOpen(true),
        } as any)}
        accessibilityLabel={canSwitchProfile ? "Alternar workspace" : "Abrir perfil e configurações"}
        accessibilityState={canSwitchProfile ? { expanded: profileSwitcherOpen } : undefined}
        onFocus={() => canSwitchProfile && setProfileSwitcherOpen(true)}
        onHoverIn={() => canSwitchProfile && setProfileSwitcherOpen(true)}
        onPress={() => {
          if (canSwitchProfile) {
            setProfileSwitcherOpen(true);
            return;
          }
          openProfile();
        }}
        style={{
          minHeight: 62,
          borderRadius: radius.card,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
          backgroundColor: profileSwitcherOpen ? "rgba(255,255,255,0.08)" : "transparent",
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(65, 217, 132, 0.18)",
            borderWidth: 1,
            borderColor: "rgba(65, 217, 132, 0.35)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: brandPalette.quadra, fontSize: 12, fontWeight: "900" }}>
            {professorInitials}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            style={{ color: brandPalette.white, fontSize: 14, fontWeight: "800" }}
            numberOfLines={1}
          >
            {professorName}
          </Text>
          <Text
            style={{ color: "rgba(255,255,255,0.56)", fontSize: 11, fontWeight: "600" }}
            numberOfLines={1}
          >
            {roleProfileLabel[role]}
          </Text>
        </View>
        <GoAtletaIcon
          name="chevronForward"
          size={17}
          color="rgba(255,255,255,0.62)"
        />
      </Pressable>

      <View
        style={{
          height: 1,
          backgroundColor: "rgba(255,255,255,0.10)",
          marginHorizontal: 8,
          marginVertical: 4,
        }}
      />

      <Pressable
        onHoverIn={() => setProfileSwitcherOpen(false)}
        onPress={openProfile}
        style={{
          minHeight: 44,
          borderRadius: radius.card,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
        }}
      >
        <GoAtletaIcon
          name="management"
          size={19}
          color="rgba(255,255,255,0.78)"
        />
        <Text style={{ flex: 1, color: brandPalette.white, fontSize: 13, fontWeight: "700" }}>
          Perfil e configurações
        </Text>
      </Pressable>

      <View
        style={{
          height: 1,
          backgroundColor: "rgba(255,255,255,0.10)",
          marginHorizontal: 8,
          marginVertical: 4,
        }}
      />

      <Pressable
        accessibilityLabel="Sair da conta"
        onHoverIn={() => setProfileSwitcherOpen(false)}
        onPress={() => void handleSignOut()}
        style={{
          minHeight: 44,
          borderRadius: radius.card,
          paddingHorizontal: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 11,
        }}
      >
        <GoAtletaIcon name="logout" size={19} color="#FCA5A5" />
        <Text style={{ flex: 1, color: "#FCA5A5", fontSize: 13, fontWeight: "700" }}>
          Sair
        </Text>
      </Pressable>
    </View>
  );

  const compactTabs = ROLE_TABS[role].filter((tab) => !tab.isCenter);
  const tabItems = compactTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: `${routePrefix[role]}/${tab.routeName}`,
    icon: tab.icon,
  }));

  const canShowItem = (item: SidebarItem) => {
    if (role === "student" || isOrgAdmin) return true;
    if (permissionsLoading && getTrainerPermissionKey(item.href)) return false;
    return isTrainerPathAllowed(item.href, memberPermissions, false);
  };

  const mainItems: SidebarItem[] = tabItems.filter(canShowItem);

  const operationalItemsByRole: Record<AppRole, SidebarItem[]> = {
    prof: [
      {
        key: "consultation",
        label: "Consultoria online",
        href: "/prof/consultation",
        icon: "consultation",
      },
      {
        key: "students",
        label: "Alunos",
        href: "/prof/students",
        icon: "students",
      },
      {
        key: "calendar",
        label: "Calendário mensal",
        href: "/prof/calendar",
        icon: "calendar",
      },
      {
        key: "absence",
        label: "Avisos de ausência",
        href: "/prof/absence-notices",
        icon: "absenceNotices",
      },
      {
        key: "nfc",
        label: "Presença NFC",
        href: "/prof/nfc-attendance",
        icon: "nfc",
      },
      {
        key: "exercises",
        label: "Exercícios",
        href: "/prof/exercises",
        icon: "exercises",
      },
      {
        key: "periodization",
        label: "Periodização",
        href: "/prof/periodization",
        icon: "periodization",
      },
      {
        key: "regulation-history",
        label: "Regulamentos",
        href: "/prof/regulation-history",
        icon: "regulations",
      },
      {
        key: "assistant",
        label: "Assistente IA",
        href: "/prof/assistant",
        icon: "assistant",
      },
    ],
    coord: [
      {
        key: "events",
        label: "Eventos",
        href: "/coord/events",
        icon: "events",
      },
      {
        key: "members",
        label: "Membros",
        href: "/coord/org-members",
        icon: "members",
      },
      {
        key: "nfc",
        label: "Presença NFC",
        href: "/prof/nfc-attendance",
        icon: "nfc",
      },
      {
        key: "communications",
        label: "Comunicados",
        href: "/coord/communications",
        icon: "communications",
      },
      {
        key: "periodization",
        label: "Periodização",
        href: "/coord/periodization",
        icon: "periodization",
      },
      {
        key: "regulation-history",
        label: "Regulamentos",
        href: "/coord/regulation-history",
        icon: "regulations",
      },
      {
        key: "assistant",
        label: "Assistente",
        href: "/coord/assistant",
        icon: "assistant",
      },
    ],
    student: [
      {
        key: "plan",
        label: "Plano",
        href: "/student-plan",
        icon: "plan",
      },
      {
        key: "feedback",
        label: "Feedback",
        href: "/absence-report",
        icon: "feedback",
      },
      {
        key: "communications",
        label: "Comunicados",
        href: "/communications",
        icon: "communications",
      },
      {
        key: "scouting",
        label: "Scouting",
        href: "/student-scouting",
        icon: "scouting",
      },
    ],
  };
  const operationalItems = operationalItemsByRole[role].filter(canShowItem);

  const isClassRoute =
    pathname === "/classes" || pathname === "/class" || pathname.startsWith("/class/");
  const isActiveItem = (item: SidebarItem) =>
    (isClassRoute && item.key === "classes") ||
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`) ||
    (item.href === "/prof/home" && pathname === "/prof");

  const renderCompactNavItem = (item: SidebarItem) => {
    const active = isActiveItem(item);
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
          setSidebarExpanded(false);
          navigateTo(item.href);
        }}
        style={{
          width: 52,
          minHeight: 46,
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
            width: 30,
            height: 30,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: active ? "rgba(65, 217, 132, 0.16)" : webShellTokens.sidebarSoft,
          }}
        >
          <GoAtletaIcon
            name={item.icon}
            size={17}
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
        accessibilityLabel="Navegação principal"
        style={{
          width: SIDEBAR_COMPACT_WIDTH,
          alignSelf: "stretch",
          backgroundColor: webShellTokens.sidebar,
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.06)",
          paddingVertical: 18,
          paddingHorizontal: 10,
          gap: 18,
          flexShrink: 0,
          height: "100%",
          maxHeight: "100%",
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <BrandMark size={44} />
          {canExpand ? (
            <SidebarToggleButton expanded={false} onPress={() => setSidebarExpanded(true)} />
          ) : null}
        </View>

        <ScrollView
          style={{ flex: 1, minHeight: 0 }}
          contentContainerStyle={{ gap: 6, alignItems: "center", paddingVertical: 2, paddingBottom: 6 }}
          showsVerticalScrollIndicator={false}
        >
          {mainItems.map(renderCompactNavItem)}
          {operationalItems.length ? (
            <View
              style={{
                width: 34,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.10)",
                marginVertical: 2,
              }}
            />
          ) : null}
          {operationalItems.map(renderCompactNavItem)}
        </ScrollView>

        <View ref={profileMenuRootRef} style={{ position: "relative", alignSelf: "center" }}>
          {profileMenuOpen ? renderProfileMenu("compact") : null}
          <Pressable
            accessibilityLabel={profileMenuOpen ? "Fechar menu de perfil" : "Abrir menu de perfil"}
            accessibilityState={{ expanded: profileMenuOpen }}
            onPress={toggleProfileMenu}
            style={{
              width: 58,
              height: 58,
              borderRadius: 18,
              alignSelf: "center",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: profileMenuOpen
                ? "rgba(255,255,255,0.13)"
                : "rgba(255,255,255,0.08)",
              borderWidth: 1,
              borderColor: profileMenuOpen
                ? "rgba(65, 217, 132, 0.62)"
                : "rgba(255,255,255,0.10)",
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
      </View>
    );
  }

  const renderNavItem = (item: SidebarItem) => {
    const active = isActiveItem(item);
    return (
      <Pressable
        key={item.key}
        onPress={() => {
          setProfileMenuOpen(false);
          navigateTo(item.href);
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
          <GoAtletaIcon
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
      accessibilityLabel="Navegação principal"
      style={{
        width: SIDEBAR_COMPACT_WIDTH,
        alignSelf: "stretch",
        flexShrink: 0,
        height: "100%",
        maxHeight: "100%",
        position: "relative",
        zIndex: 1000,
      }}
    >
      <Pressable
        accessibilityLabel="Fechar menu lateral"
        suppressWebHoverFeedback
        onPress={() => setSidebarExpanded(false)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1090,
          backgroundColor: webShellTokens.scrim,
        } as any}
      />

      <View
        style={{
          width: SIDEBAR_EXPANDED_WIDTH,
          backgroundColor: webShellTokens.sidebar,
          borderRightWidth: 1,
          borderRightColor: "rgba(255,255,255,0.06)",
          paddingVertical: 18,
          paddingHorizontal: 14,
          gap: 14,
          height: "100vh",
          maxHeight: "100vh",
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 1100,
          boxShadow: "18px 0 42px rgba(0,0,0,0.28)",
        } as any}
      >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <BrandMark size={46} />
        <BrandWordmark role={role} fill={false} />
        <SidebarToggleButton expanded onPress={() => setSidebarExpanded(false)} />
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
        {profileMenuOpen ? renderProfileMenu("expanded") : null}

        <Pressable
          accessibilityLabel={profileMenuOpen ? "Fechar menu de perfil" : "Abrir menu de perfil"}
          accessibilityState={{ expanded: profileMenuOpen }}
          onPress={toggleProfileMenu}
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
          <GoAtletaIcon
            name={profileMenuOpen ? "chevronDown" : "chevronUp"}
            size={17}
            color="rgba(255,255,255,0.62)"
          />
        </Pressable>
      </View>
      </View>
    </View>
  );
}
