import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { useAuth } from "../auth/auth";
import {
  ROLE_RADIAL_ACTIONS,
  ROLE_TABS,
  type AppRole,
} from "../components/navigation/tab-config";
import {
  getTrainerPermissionKey,
  isTrainerPathAllowed,
} from "../auth/route-permissions";
import { PROFILE_NAME_FALLBACK, resolveProfileDisplayName } from "../core/profile-name";
import { getScopedProfilePath } from "../navigation/profile-routes";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { brandPalette, radius } from "../theme/tokens";
import { GoAtletaBrandMark, GoAtletaBrandWordmark } from "./GoAtletaBrand";
import { Pressable } from "./Pressable";
import { GoAtletaIcon, type GoAtletaIconName } from "./icon-registry";
import { webShellTokens } from "./web-shell-tokens";

type NativeSidebarProps = {
  role: AppRole;
  visible: boolean;
  canExpand: boolean;
  forceExpanded?: boolean;
  drawerOpen?: boolean;
  onNavigate?: () => void;
  onRequestClose?: () => void;
};

type NativeNavItem = {
  key: string;
  label: string;
  href: string;
  icon: GoAtletaIconName;
};

const COMPACT_WIDTH = 80;
export const NATIVE_SIDEBAR_EXPANDED_WIDTH = 292;

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

const getDisplayName = (session: ReturnType<typeof useAuth>["session"]) => {
  const user = session?.user as
    | { email?: string; user_metadata?: Record<string, unknown> }
    | undefined;
  const metadataName = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
  return resolveProfileDisplayName({
    displayName: metadataName,
    email: user?.email,
    fallback: PROFILE_NAME_FALLBACK,
  });
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

export function NativeSidebar({
  role,
  visible,
  canExpand,
  forceExpanded = false,
  drawerOpen,
  onNavigate,
  onRequestClose,
}: NativeSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const organization = useOptionalOrganization();
  const activeOrganization = organization?.activeOrganization ?? null;
  const memberPermissions = useMemo(
    () => organization?.memberPermissions ?? {},
    [organization?.memberPermissions]
  );
  const permissionsLoading = organization?.permissionsLoading ?? true;
  const [expandedRequested, setExpandedRequested] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const expanded = forceExpanded || (canExpand && expandedRequested);
  const profileName = getDisplayName(session);
  const profileInitials = getInitials(profileName);
  const profilePath = getScopedProfilePath(pathname || "/");

  useEffect(() => {
    if (drawerOpen === false) setProfileMenuOpen(false);
  }, [drawerOpen]);

  const items = useMemo<NativeNavItem[]>(() => {
    const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
    const permissionByRoute: Partial<Record<string, keyof typeof memberPermissions>> =
      role === "prof"
        ? { classes: "classes", planning: "training" }
        : role === "coord"
          ? { classes: "classes", planning: "training", management: "org_members" }
          : {};
    const primary = ROLE_TABS[role]
      .filter((item) => {
        if (item.isCenter) return false;
        if (isOrgAdmin) return true;
        const permissionKey = permissionByRoute[item.routeName];
        return !permissionKey || memberPermissions[permissionKey] === true;
      })
      .map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        href: String(item.href),
      }));
    const actions = ROLE_RADIAL_ACTIONS[role]
      .filter((item) => {
        if (role === "student" || isOrgAdmin) return true;
        if (permissionsLoading && getTrainerPermissionKey(String(item.href))) return false;
        return isTrainerPathAllowed(String(item.href), memberPermissions, false);
      })
      .map((item) => ({
        key: `action-${item.id}`,
        label: item.label,
        icon: item.icon,
        href: String(item.href),
      }));
    return [...primary, ...actions.filter((item) => !primary.some((primaryItem) => primaryItem.href === item.href))];
  }, [activeOrganization?.role_level, memberPermissions, permissionsLoading, role]);

  if (!visible) return null;

  const closeAndNavigate = (href: string) => {
    setProfileMenuOpen(false);
    onNavigate?.();
    router.push(href as never);
  };

  const handleSignOut = async () => {
    setProfileMenuOpen(false);
    onNavigate?.();
    await signOut();
  };

  return (
    <View
      accessibilityLabel="Navegação principal"
      style={{
        width: expanded ? NATIVE_SIDEBAR_EXPANDED_WIDTH : COMPACT_WIDTH,
        height: "100%",
        backgroundColor: webShellTokens.sidebar,
        paddingTop: 10,
        paddingBottom: 10,
        borderRightWidth: 1,
        borderRightColor: "rgba(255,255,255,0.06)",
      }}
    >
      <View
        style={{
          minHeight: 52,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 10,
          gap: 8,
          overflow: "hidden",
        }}
      >
        <View style={{ width: 48, alignItems: "center", justifyContent: "center" }}>
          <GoAtletaBrandMark size={44} tone="light" decorative />
        </View>
        {expanded ? (
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <GoAtletaBrandWordmark height={18} tone="light" decorative />
            <Text
              numberOfLines={1}
              style={{ color: "rgba(255,255,255,0.56)", fontSize: 11, fontWeight: "600" }}
            >
              {roleSubtitle[role]}
            </Text>
          </View>
        ) : null}
        {expanded && onRequestClose ? (
          <Pressable
            accessibilityLabel="Fechar menu principal"
            onPress={onRequestClose}
            style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}
          >
            <GoAtletaIcon name="close" size={21} color="rgba(255,255,255,0.78)" />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 12, gap: 6 }}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Pressable
              key={item.key}
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => closeAndNavigate(item.href)}
              style={{
                minHeight: 48,
                borderRadius: radius.card,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: expanded ? "flex-start" : "center",
                paddingHorizontal: expanded ? 14 : 0,
                gap: 12,
                backgroundColor: active ? webShellTokens.sidebarActive : "transparent",
              }}
            >
              <GoAtletaIcon name={item.icon} size={20} color={active ? brandPalette.quadra : "rgba(255,255,255,0.72)"} />
              {expanded ? <Text numberOfLines={1} style={{ flex: 1, color: active ? brandPalette.white : "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: active ? "800" : "600" }}>{item.label}</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={{ paddingHorizontal: 10, gap: 6 }}>
        <View style={{ position: "relative", zIndex: 20 }}>
          {expanded && profileMenuOpen ? (
            <View
              accessibilityLabel="Menu de perfil"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 66,
                zIndex: 30,
                elevation: 24,
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.14)",
                backgroundColor: "#1F2937",
                padding: 10,
                gap: 4,
              }}
            >
              <Pressable
                accessibilityLabel="Perfil e configurações"
                onPress={() => closeAndNavigate(profilePath)}
                style={{
                  minHeight: 44,
                  borderRadius: radius.card,
                  paddingHorizontal: 10,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 11,
                }}
              >
                <GoAtletaIcon name="management" size={19} color="rgba(255,255,255,0.78)" />
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
          ) : null}

          <Pressable
            accessibilityLabel={profileMenuOpen ? "Fechar menu de perfil" : "Abrir menu de perfil"}
            accessibilityState={{ expanded: profileMenuOpen }}
            onPress={() => setProfileMenuOpen((current) => !current)}
            style={{
              minHeight: expanded ? 58 : 52,
              width: expanded ? undefined : 52,
              alignSelf: expanded ? "stretch" : "center",
              borderRadius: 18,
              borderWidth: 1,
              borderColor: profileMenuOpen
                ? "rgba(65, 217, 132, 0.62)"
                : "rgba(255,255,255,0.10)",
              backgroundColor: profileMenuOpen
                ? "rgba(255,255,255,0.13)"
                : "rgba(255,255,255,0.08)",
              paddingLeft: expanded ? 14 : 6,
              paddingRight: expanded ? 12 : 6,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: expanded ? "flex-start" : "center",
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
                {profileInitials}
              </Text>
            </View>
            {expanded ? (
              <>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    numberOfLines={1}
                    style={{ color: brandPalette.white, fontSize: 13, fontWeight: "800" }}
                  >
                    {profileName}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ color: "rgba(255,255,255,0.56)", fontSize: 11 }}
                  >
                    {roleProfileLabel[role]}
                  </Text>
                </View>
                <GoAtletaIcon
                  name={profileMenuOpen ? "chevronDown" : "chevronUp"}
                  size={17}
                  color="rgba(255,255,255,0.68)"
                />
              </>
            ) : null}
          </Pressable>
        </View>

        {canExpand ? (
          <Pressable
            accessibilityLabel={expanded ? "Recolher menu" : "Expandir menu"}
            accessibilityState={{ expanded }}
            onPress={() => {
              setProfileMenuOpen(false);
              setExpandedRequested((current) => !current);
            }}
            style={{ minHeight: 48, borderRadius: radius.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
          >
            <GoAtletaIcon name={expanded ? "chevronBack" : "chevronForward"} size={18} color="rgba(255,255,255,0.68)" />
            {expanded ? <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "700" }}>Recolher</Text> : null}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
