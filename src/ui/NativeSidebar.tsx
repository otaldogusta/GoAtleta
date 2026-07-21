import { usePathname, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import {
  ROLE_RADIAL_ACTIONS,
  ROLE_TABS,
  type AppRole,
} from "../components/navigation/tab-config";
import {
  getTrainerPermissionKey,
  isTrainerPathAllowed,
} from "../auth/route-permissions";
import { useOptionalOrganization } from "../providers/OrganizationProvider";
import { brandPalette, radius } from "../theme/tokens";
import { Pressable } from "./Pressable";
import { GoAtletaIcon, type GoAtletaIconName } from "./icon-registry";
import { webShellTokens } from "./web-shell-tokens";

type NativeSidebarProps = {
  role: AppRole;
  canExpand: boolean;
};

type NativeNavItem = {
  key: string;
  label: string;
  href: string;
  icon: GoAtletaIconName;
};

const COMPACT_WIDTH = 80;
const EXPANDED_WIDTH = 268;

export function NativeSidebar({ role, canExpand }: NativeSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const organization = useOptionalOrganization();
  const activeOrganization = organization?.activeOrganization ?? null;
  const memberPermissions = organization?.memberPermissions ?? {};
  const permissionsLoading = organization?.permissionsLoading ?? true;
  const [expandedRequested, setExpandedRequested] = useState(false);
  const expanded = canExpand && expandedRequested;

  useEffect(() => {
    if (!canExpand) setExpandedRequested(false);
  }, [canExpand]);

  const items = useMemo<NativeNavItem[]>(() => {
    const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;
    const permissionByRoute: Partial<Record<string, keyof typeof memberPermissions>> =
      role === "prof"
        ? { classes: "classes", planning: "training", reports: "reports" }
        : role === "coord"
          ? { classes: "classes", reports: "reports", management: "org_members" }
          : {};
    const primary = ROLE_TABS[role]
      .filter((item) => {
        if (item.isCenter) return false;
        if (isOrgAdmin) return true;
        const permissionKey = permissionByRoute[item.routeName];
        return !permissionKey || memberPermissions[permissionKey] !== false;
      })
      .map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
        href: `/${role}/${item.routeName}`,
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

  return (
    <View
      accessibilityLabel="Navegação principal"
      style={{
        width: expanded ? EXPANDED_WIDTH : COMPACT_WIDTH,
        backgroundColor: webShellTokens.sidebar,
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <View style={{ minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: brandPalette.navyDeep, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: brandPalette.white, fontSize: 12, fontWeight: "900" }}>GA</Text>
        </View>
        {expanded ? <Text numberOfLines={1} style={{ flex: 1, color: brandPalette.white, fontSize: 16, fontWeight: "900" }}>GoAtleta</Text> : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 10, paddingVertical: 12, gap: 6 }}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Pressable
              key={item.key}
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.push(item.href as never)}
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

      {canExpand ? (
        <Pressable
          accessibilityLabel={expanded ? "Recolher menu" : "Expandir menu"}
          accessibilityState={{ expanded }}
          onPress={() => setExpandedRequested((current) => !current)}
          style={{ minHeight: 48, marginHorizontal: 10, borderRadius: radius.card, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 }}
        >
          <GoAtletaIcon name={expanded ? "chevronBack" : "chevronForward"} size={18} color="rgba(255,255,255,0.68)" />
          {expanded ? <Text style={{ color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "700" }}>Recolher</Text> : null}
        </Pressable>
      ) : null}
    </View>
  );
}
