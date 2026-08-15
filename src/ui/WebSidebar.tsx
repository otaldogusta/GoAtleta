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
import { stripExpoRouterInternalParams } from "../navigation/web-route-state";
import { formatUnreadNotificationBadge } from "../notifications/unread-notification-count";
import { useUnreadNotificationCount } from "../notifications/useUnreadNotificationCount";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { brandPalette, radius } from "../theme/tokens";
import { Pressable } from "./Pressable";
import { GoAtletaBrandMark, GoAtletaBrandWordmark } from "./GoAtletaBrand";
import { GoAtletaIcon, type GoAtletaIconName } from "./icon-registry";
import {
  resolveVisibleProfileSwitchIds,
  type ProfileSwitchId,
} from "./profile-switch-options";
import { useAppTheme } from "./app-theme";
import { webShellTokens } from "./web-shell-tokens";
import {
  orderWebSidebarItems,
  shouldNavigateAcrossWebShell,
} from "./web-sidebar-navigation";

type WebSidebarProps = {
  role: AppRole;
  showCompact: boolean;
  canExpand: boolean;
  canPersistExpansion: boolean;
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
const SIDEBAR_EXPANSION_DISTANCE = SIDEBAR_EXPANDED_WIDTH - SIDEBAR_COMPACT_WIDTH;
const SIDEBAR_EXPANDED_STORAGE_KEY = "goatleta:web-sidebar-expanded";

const roleSubtitle: Record<AppRole, string> = {
  prof: "Painel do professor",
  coord: "Painel operacional",
  student: "Minha rotina",
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

function BrandMark({
  size = 46,
  decorative = false,
}: {
  size?: number;
  decorative?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <GoAtletaBrandMark size={size - 2} tone="light" decorative={decorative} />
    </View>
  );
}

function BrandWordmark({ role, fill = true }: { role: AppRole; fill?: boolean }) {
  return (
    <View style={{ flex: fill ? 1 : undefined, minWidth: 0, gap: 2 }}>
      <GoAtletaBrandWordmark height={18} tone="light" />
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
  revealed,
  reduceMotion,
  edgeOffset = 0,
  edgeDuration = 220,
}: {
  expanded: boolean;
  onPress: () => void;
  revealed: boolean;
  reduceMotion: boolean;
  edgeOffset?: number;
  edgeDuration?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const highlighted = hovered || focused;
  const visible = revealed || focused;

  return (
    <Pressable
      accessibilityLabel={expanded ? "Recolher menu" : "Expandir menu"}
      accessibilityState={{ expanded }}
      suppressWebHoverFeedback
      disableWebPressScale
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={({ pressed }) =>
        ({
          position: "absolute",
          top: 18,
          right: -22,
          height: 44,
          width: 44,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1120,
          opacity: pressed ? 0.82 : visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transform: `translateX(${edgeOffset + (visible ? 0 : -14)}px)`,
          transition: reduceMotion
            ? "none"
            : `opacity 150ms ease, transform ${edgeDuration}ms cubic-bezier(0.16, 1, 0.3, 1)`,
        }) as any
      }
    >
      <View
        style={
          ({
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: highlighted
              ? "rgba(255,255,255,0.16)"
              : webShellTokens.sidebar,
            borderWidth: focused ? 2 : 1,
            borderColor: focused
              ? webShellTokens.primaryLight
              : "rgba(255,255,255,0.16)",
            boxShadow: "0 6px 18px rgba(2,6,23,0.28)",
            transition: "background-color 140ms ease, border-color 140ms ease",
          }) as any
        }
      >
        <GoAtletaIcon
          name={expanded ? "chevronBack" : "chevronForward"}
          size={14}
          color={highlighted ? brandPalette.white : "rgba(255,255,255,0.72)"}
        />
      </View>
    </Pressable>
  );
}

export function WebSidebar({
  role,
  showCompact,
  canExpand,
  canPersistExpansion,
}: WebSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { mode, colors } = useAppTheme();
  const { session, signOut } = useAuth();
  const { availableRoles, refresh: refreshRole, setActiveRole } = useRole();
  const organizationContext = useOptionalOrganization();
  const { unreadCount: unreadNotificationCount } = useUnreadNotificationCount(
    organizationContext?.activeOrganization?.id,
    true,
    role,
  );
  const unreadNotificationBadge = formatUnreadNotificationBadge(unreadNotificationCount);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileSwitcherOpen, setProfileSwitcherOpen] = useState(false);
  const [profileSwitcherTop, setProfileSwitcherTop] = useState(12);
  const [sidebarExpanded, setSidebarExpandedState] = useState(() => {
    if (!canPersistExpansion || typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY);
    return stored === "expanded";
  });
  const [supportsHoverPointer, setSupportsHoverPointer] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [sidebarHovered, setSidebarHovered] = useState(false);
  const [hoveredCompactItemKey, setHoveredCompactItemKey] = useState<string | null>(null);
  const [compactTooltip, setCompactTooltip] = useState<{
    key: string;
    label: string;
    top: number;
  } | null>(null);
  const profileMenuRootRef = useRef<View | null>(null);
  const profileSwitcherTriggerRef = useRef<View | null>(null);

  useEffect(() => {
    if (canPersistExpansion) return;
    setSidebarExpandedState(false);
  }, [canPersistExpansion, showCompact]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const hoverQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncInteractionPreferences = () => {
      setSupportsHoverPointer(hoverQuery.matches);
      setPrefersReducedMotion(motionQuery.matches);
    };

    syncInteractionPreferences();
    hoverQuery.addEventListener("change", syncInteractionPreferences);
    motionQuery.addEventListener("change", syncInteractionPreferences);

    return () => {
      hoverQuery.removeEventListener("change", syncInteractionPreferences);
      motionQuery.removeEventListener("change", syncInteractionPreferences);
    };
  }, []);

  const expanded = sidebarExpanded && (canExpand || !showCompact);
  const revealSidebarToggle = !supportsHoverPointer || sidebarHovered;
  const sidebarRevealEvents = {
    onMouseEnter: () => setSidebarHovered(true),
    onMouseLeave: () => setSidebarHovered(false),
  } as any;
  const sidebarBackgroundColor =
    mode === "dark" ? colors.background : webShellTokens.sidebar;
  const professorName = getDisplayName(session);
  const professorInitials = getInitials(professorName);
  const setDevProfilePreview = organizationContext?.setDevProfilePreview;
  const memberPermissions = organizationContext?.memberPermissions ?? {};
  const permissionsLoading = organizationContext?.permissionsLoading ?? true;
  const isOrgAdmin = (organizationContext?.activeOrganization?.role_level ?? 0) >= 50;
  const hasHybridAccount = availableRoles.includes("trainer") && availableRoles.includes("student");
  const canSwitchProfile = hasHybridAccount || (__DEV__ && Boolean(setDevProfilePreview));
  const canUseDevPreview = __DEV__ && Boolean(setDevProfilePreview);
  const selectedPreview = rolePreview[role];
  const profilePath = getScopedProfilePath(pathname || "/");
  const isProfileMenuOpen = profileMenuOpen;
  const isProfileSwitcherOpen = isProfileMenuOpen && profileSwitcherOpen;
  const closeProfileMenu = useCallback(() => {
    setProfileSwitcherOpen(false);
    setProfileMenuOpen(false);
  }, []);

  const navigateTo = useCallback(
    (href: string) => {
      if (href === pathname) {
        if (
          typeof window !== "undefined" &&
          (href === "/prof/students" || href === "/coord/students")
        ) {
          window.dispatchEvent(new Event("goatleta:open-students-list"));
        }
        return;
      }
      closeProfileMenu();
      const currentPathname =
        typeof window !== "undefined" ? window.location.pathname : pathname;
      if (
        typeof window !== "undefined" &&
        shouldNavigateAcrossWebShell(currentPathname)
      ) {
        router.push(href as never, { withAnchor: true });
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            const currentHref = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            const sanitizedHref = stripExpoRouterInternalParams(currentHref);
            const currentState = window.history.state;

            if (sanitizedHref === currentHref || currentState == null) return;
            window.history.replaceState(currentState, "", sanitizedHref);
          });
        });
        return;
      }
      router.push(href as never);
    },
    [pathname, router, closeProfileMenu]
  );

  const setSidebarExpanded = useCallback(
    (nextExpanded: boolean) => {
      setSidebarExpandedState(nextExpanded);
      closeProfileMenu();
      if (!canPersistExpansion || typeof window === "undefined") return;
      window.localStorage.setItem(
        SIDEBAR_EXPANDED_STORAGE_KEY,
        nextExpanded ? "expanded" : "compact"
      );
    },
    [canPersistExpansion, closeProfileMenu]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleToggle = () => {
      setSidebarExpanded(!expanded);
    };
    window.addEventListener("goatleta:toggle-sidebar", handleToggle);
    return () => window.removeEventListener("goatleta:toggle-sidebar", handleToggle);
  }, [expanded, setSidebarExpanded]);

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
    if (!isProfileMenuOpen || typeof document === "undefined") return;

    const isEventInsideMenu = (target: EventTarget | null) => {
      if (typeof Node === "undefined" || !(target instanceof Node)) return false;
      const rootElement = profileMenuRootRef.current as unknown as HTMLElement | null;
      if (rootElement?.contains(target)) return true;
      const targetEl = target as HTMLElement;
      if (targetEl.closest?.('[data-goatleta-profile-menu="true"]')) return true;
      return false;
    };

    const closeMenu = () => {
      closeProfileMenu();
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
  }, [isProfileMenuOpen, closeProfileMenu]);

  const applyProfilePreview = useCallback(
    async (preview: ProfileSwitchId) => {
      closeProfileMenu();
      setSidebarExpanded(false);
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
    [closeProfileMenu, setSidebarExpanded, hasHybridAccount, refreshRole, router, setActiveRole, setDevProfilePreview]
  );

  const visibleProfileSwitchIds = resolveVisibleProfileSwitchIds({
    hasHybridAccount,
    isOrgAdmin,
    canUseDevPreview,
  });
  const visibleProfileSwitchOptions = profileSwitchOptions.filter((option) =>
    visibleProfileSwitchIds.includes(option.id)
  );

  const openProfileSwitcher = () => {
    const triggerElement = profileSwitcherTriggerRef.current as unknown as HTMLElement | null;
    const triggerRect = triggerElement?.getBoundingClientRect?.();
    if (triggerRect && typeof window !== "undefined") {
      const estimatedHeight = 56 + visibleProfileSwitchOptions.length * 54;
      setProfileSwitcherTop(
        Math.max(12, Math.min(triggerRect.top, window.innerHeight - estimatedHeight - 12))
      );
    }
    setProfileSwitcherOpen(true);
  };

  const toggleProfileMenu = () => {
    setProfileSwitcherOpen(false);
    setProfileMenuOpen((current) => !current);
  };

  const openProfile = () => {
    closeProfileMenu();
    setSidebarExpanded(false);
    navigateTo(profilePath);
  };

  const handleSignOut = async () => {
    closeProfileMenu();
    await signOut();
  };

  const renderProfileSwitcher = (placement: "compact" | "expanded") => (
    <View
      {...({
        dataSet: { goatletaWorkspaceMenu: "true", goatletaProfileMenu: "true" },
        "data-goatleta-workspace-menu": "true",
        "data-goatleta-profile-menu": "true",
      } as any)}
      accessibilityLabel="Alternar workspace"
      style={{
        position: "absolute",
        zIndex: 3201,
        width: 236,
        left: placement === "expanded" ? SIDEBAR_EXPANDED_WIDTH - 12 : "calc(100% - 2px)",
        top: placement === "expanded" ? profileSwitcherTop : 10,
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
      {...({
        dataSet: { goatletaProfileMenu: "true" },
        "data-goatleta-profile-menu": "true",
      } as any)}
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
      {canSwitchProfile && isProfileSwitcherOpen && placement === "compact"
        ? renderProfileSwitcher("compact")
        : null}

      {canSwitchProfile ? (
        <>
          <Pressable
            ref={profileSwitcherTriggerRef}
            {...({
              dataSet: { goatletaWorkspaceTrigger: "true" },
              "data-goatleta-workspace-trigger": "true",
              onMouseEnter: openProfileSwitcher,
              onPointerEnter: openProfileSwitcher,
            } as any)}
            accessibilityLabel="Alternar perfil"
            onFocus={openProfileSwitcher}
            onHoverIn={openProfileSwitcher}
            onPress={openProfileSwitcher}
            style={{
              minHeight: 48,
              borderRadius: radius.card,
              paddingHorizontal: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              backgroundColor: isProfileSwitcherOpen ? "rgba(255,255,255,0.08)" : "transparent",
            }}
          >
            <GoAtletaIcon name="swap" size={18} color="rgba(255,255,255,0.72)" />
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ color: brandPalette.white, fontSize: 13, fontWeight: "800" }}>
                Alternar perfil
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.56)", fontSize: 11 }} numberOfLines={1}>
                Atual: {roleProfileLabel[role]}
              </Text>
            </View>
            <GoAtletaIcon name="chevronForward" size={17} color="rgba(255,255,255,0.62)" />
          </Pressable>

          <View
            style={{
              height: 1,
              backgroundColor: "rgba(255,255,255,0.10)",
              marginHorizontal: 8,
              marginVertical: 4,
            }}
          />
        </>
      ) : null}

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

  const compactTabs = ROLE_TABS[role].filter(
    (tab) => !tab.isCenter && !(role === "prof" && tab.key === "profile")
  );
  const tabItems = compactTabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    href: String(tab.href),
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
        label: "Notificações",
        href: "/prof/absence-notices",
        icon: "absenceNotices",
        badge: unreadNotificationBadge,
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
        key: "students",
        label: "Alunos",
        href: "/coord/students",
        icon: "students",
      },
      {
        key: "events",
        label: "Eventos",
        href: "/coord/events",
        icon: "events",
      },
      {
        key: "nfc",
        label: "Presença NFC",
        href: "/coord/nfc-attendance",
        icon: "nfc",
      },
      {
        key: "communications",
        label: "Avisos",
        href: "/coord/communications",
        icon: "absenceNotices",
        badge: unreadNotificationBadge,
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
        label: "Avisos",
        href: "/communications",
        icon: "absenceNotices",
        badge: unreadNotificationBadge,
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
  const navigationItems = orderWebSidebarItems(role, [...mainItems, ...operationalItems]);

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
    const accessibilityLabel = item.badge
      ? `${item.label}, ${item.badge} notificações não lidas`
      : item.label;
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
        accessibilityLabel={accessibilityLabel}
        suppressWebHoverFeedback
        onHoverIn={showCompactTooltip}
        onHoverOut={hideCompactTooltip}
        onPress={() => {
          closeProfileMenu();
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
          overflow: "hidden",
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

  const renderNavItem = (item: SidebarItem) => {
    const active = isActiveItem(item);
    const accessibilityLabel = item.badge
      ? `${item.label}, ${item.badge} notificações não lidas`
      : item.label;
    return (
      <Pressable
        key={item.key}
        accessibilityLabel={expanded ? accessibilityLabel : undefined}
        onPress={() => {
          closeProfileMenu();
          if (!showCompact) {
            setSidebarExpanded(false);
          }
          navigateTo(item.href);
        }}
        style={{
          minHeight: 46,
          borderRadius: radius.card,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: active ? webShellTokens.primarySoft : "transparent",
          borderWidth: 1,
          borderColor: active ? webShellTokens.primary : "transparent",
          overflow: "hidden",
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
          style={
            ({
              flex: 1,
              color: active ? brandPalette.white : "rgba(255,255,255,0.72)",
              fontSize: 13,
              fontWeight: active ? "800" : "700",
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateX(0px)" : "translateX(-8px)",
              transition: prefersReducedMotion
                ? "none"
                : expanded
                  ? "opacity 150ms ease 70ms, transform 220ms cubic-bezier(0.16, 1, 0.3, 1) 50ms"
                  : "opacity 80ms ease, transform 120ms ease",
            }) as any
          }
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

  const sidebarScrimTransition = prefersReducedMotion
    ? "none"
    : expanded
      ? "opacity 180ms ease, visibility 0s"
      : "opacity 160ms ease, visibility 0s linear 160ms";
  const sidebarPanelTransition = prefersReducedMotion
    ? "none"
    : expanded
      ? "clip-path 280ms cubic-bezier(0.16, 1, 0.3, 1)"
      : "clip-path 200ms cubic-bezier(0.4, 0, 0.2, 1)";
  const sidebarLabelRevealStyle = {
    opacity: expanded ? 1 : 0,
    transform: expanded ? "translateX(0px)" : "translateX(-8px)",
    transition: prefersReducedMotion
      ? "none"
      : expanded
        ? "opacity 150ms ease 70ms, transform 220ms cubic-bezier(0.16, 1, 0.3, 1) 50ms"
        : "opacity 80ms ease, transform 120ms ease",
  } as any;

  const renderExpandedContent = () => (
    <>
      <Pressable
        accessibilityLabel={expanded ? "Fechar menu lateral" : undefined}
        suppressWebHoverFeedback
        onPress={() => setSidebarExpanded(false)}
        style={({ pressed }) =>
          ({
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1090,
            backgroundColor: webShellTokens.scrim,
            cursor: "default",
            outlineStyle: "none",
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? "auto" : "none",
            visibility: expanded ? "visible" : "hidden",
            transition: sidebarScrimTransition,
          }) as any
        }
      />

      <View
        {...sidebarRevealEvents}
        accessibilityElementsHidden={!expanded}
        importantForAccessibility={expanded ? "auto" : "no-hide-descendants"}
        style={
          ({
            width: SIDEBAR_EXPANDED_WIDTH,
            height: "100vh",
            maxHeight: "100vh",
            position: "fixed",
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 1100,
            opacity: 1,
            pointerEvents: expanded ? "auto" : "none",
            visibility: expanded ? "visible" : "hidden",
            transition: prefersReducedMotion
              ? "none"
              : expanded
                ? "visibility 0s"
                : "visibility 0s linear 200ms",
            outlineStyle: "none",
            userSelect: "none",
            WebkitTapHighlightColor: "transparent",
          }) as any
        }
      >
        <SidebarToggleButton
          expanded
          onPress={() => setSidebarExpanded(false)}
          revealed={revealSidebarToggle}
          reduceMotion={prefersReducedMotion}
          edgeOffset={expanded ? 0 : -SIDEBAR_EXPANSION_DISTANCE}
          edgeDuration={expanded ? 280 : 200}
        />

        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: SIDEBAR_EXPANDED_WIDTH,
            overflow: "hidden",
            backgroundColor: sidebarBackgroundColor,
            borderRightWidth: 1,
            borderRightColor: "rgba(255,255,255,0.06)",
            clipPath: expanded
              ? "inset(0 0 0 0)"
              : `inset(0 ${SIDEBAR_EXPANSION_DISTANCE}px 0 0)`,
            transition: sidebarPanelTransition,
            willChange: "clip-path",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            contain: "paint",
          } as any}
        >
          <View
            style={{
              width: SIDEBAR_EXPANDED_WIDTH,
              height: "100%",
              paddingVertical: 18,
              paddingHorizontal: 10,
              gap: 18,
            }}
          >
            <View
              style={{
                height: 44,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                overflow: "hidden",
              }}
            >
              <View style={{ width: 68, alignItems: "center", justifyContent: "center" }}>
                <BrandMark size={44} decorative />
              </View>
              <View style={[{ flex: 1, minWidth: 0 }, sidebarLabelRevealStyle]}>
                <BrandWordmark role={role} />
              </View>
            </View>

            <ScrollView
              style={{ flex: 1, minHeight: 0, overflow: "hidden" }}
              contentContainerStyle={{ gap: 6, paddingVertical: 2, paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
            >
              <View style={{ gap: 6 }}>
                {navigationItems.map(renderNavItem)}
              </View>
            </ScrollView>

            <View ref={profileMenuRootRef} style={{ position: "relative" }}>
              {expanded && isProfileMenuOpen ? renderProfileMenu("expanded") : null}

              <Pressable
                accessibilityLabel={
                  expanded
                    ? isProfileMenuOpen
                      ? "Fechar menu de perfil"
                      : "Abrir menu de perfil"
                    : undefined
                }
                accessibilityState={{ expanded: isProfileMenuOpen }}
                onPress={toggleProfileMenu}
                style={{
                  minHeight: 58,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: isProfileMenuOpen ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
                  backgroundColor: isProfileMenuOpen ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.08)",
                  paddingLeft: 14,
                  paddingRight: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  overflow: "hidden",
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
                <View style={[{ flex: 1, minWidth: 0 }, sidebarLabelRevealStyle]}>
                  <Text style={{ color: brandPalette.white, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
                    {professorName}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.56)", fontSize: 11 }} numberOfLines={1}>
                    {roleProfileLabel[role]}
                  </Text>
                </View>
                <GoAtletaIcon
                  name={isProfileMenuOpen ? "chevronDown" : "chevronUp"}
                  size={17}
                  color="rgba(255,255,255,0.68)"
                />
              </Pressable>
            </View>
          </View>
        </View>

        {expanded && isProfileMenuOpen && isProfileSwitcherOpen
          ? renderProfileSwitcher("expanded")
          : null}
      </View>
    </>
  );

  return (
    <View
      accessibilityLabel="Navegação principal"
      style={{
        width: showCompact ? SIDEBAR_COMPACT_WIDTH : 0,
        alignSelf: "stretch",
        flexShrink: 0,
        height: "100%",
        maxHeight: "100%",
        position: "relative",
        zIndex: 1000,
      }}
    >
      {showCompact && !expanded ? (
        <View
          {...sidebarRevealEvents}
          accessibilityLabel="Navegação principal compacta"
          style={{
            width: SIDEBAR_COMPACT_WIDTH,
            alignSelf: "stretch",
            backgroundColor: sidebarBackgroundColor,
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
          {canExpand ? (
            <SidebarToggleButton
              expanded={false}
              onPress={() => setSidebarExpanded(true)}
              revealed={revealSidebarToggle}
              reduceMotion={prefersReducedMotion}
            />
          ) : null}

          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <BrandMark size={44} />
          </View>

          <ScrollView
            style={{ flex: 1, minHeight: 0 }}
            contentContainerStyle={{ gap: 6, alignItems: "center", paddingVertical: 2, paddingBottom: 6 }}
            showsVerticalScrollIndicator={false}
          >
            {navigationItems.map(renderCompactNavItem)}
          </ScrollView>

          <View ref={profileMenuRootRef} style={{ position: "relative", alignSelf: "center" }}>
            {isProfileMenuOpen ? renderProfileMenu("compact") : null}
            <Pressable
              accessibilityLabel={isProfileMenuOpen ? "Fechar menu de perfil" : "Abrir menu de perfil"}
              accessibilityState={{ expanded: isProfileMenuOpen }}
              onPress={toggleProfileMenu}
              style={{
                width: 58,
                height: 58,
                borderRadius: 18,
                alignSelf: "center",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isProfileMenuOpen
                  ? "rgba(255,255,255,0.13)"
                  : "rgba(255,255,255,0.08)",
                borderWidth: 1,
                borderColor: isProfileMenuOpen
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
      ) : null}

      {renderExpandedContent()}
    </View>
  );
}
