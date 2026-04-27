import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { ROLE_TABS, type AppRole } from "../components/navigation/tab-config";
import { Pressable } from "./Pressable";
import { useAppTheme } from "./app-theme";

type WebSidebarProps = {
  role: AppRole;
};

const roleTitle: Record<AppRole, string> = {
  prof: "GoAtleta",
  coord: "Coordenação",
  student: "Aluno",
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

export function WebSidebar({ role }: WebSidebarProps) {
  const { colors, mode } = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const tabs = ROLE_TABS[role].filter((tab) => !tab.isCenter);
  const sidebarBg = mode === "dark" ? "#050816" : "#07111f";
  const sidebarBorder = mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.16)";

  return (
    <View
      style={{
        width: 88,
        alignSelf: "stretch",
        backgroundColor: sidebarBg,
        borderRightWidth: 1,
        borderRightColor: sidebarBorder,
        paddingVertical: 18,
        paddingHorizontal: 10,
        gap: 18,
      }}
    >
      <View style={{ alignItems: "center", gap: 8 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.16)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="football-outline" size={22} color="#ffffff" />
        </View>
        <View style={{ alignItems: "center", gap: 2 }}>
          <Text style={{ color: "#ffffff", fontSize: 11, fontWeight: "800" }}>
            {roleTitle[role]}
          </Text>
          <Text
            style={{ color: "rgba(255,255,255,0.58)", fontSize: 9, textAlign: "center" }}
            numberOfLines={2}
          >
            {roleSubtitle[role]}
          </Text>
        </View>
      </View>

      <View style={{ gap: 8, flex: 1 }}>
        {tabs.map((tab) => {
          const href = `${routePrefix[role]}/${tab.routeName}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Pressable
              key={tab.key}
              onPress={() => router.push(href as never)}
              style={{
                minHeight: 58,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                backgroundColor: active ? colors.primaryBg : "transparent",
                borderWidth: 1,
                borderColor: active ? "rgba(255,255,255,0.28)" : "transparent",
              }}
            >
              <Ionicons
                name={tab.icon}
                size={19}
                color={active ? colors.primaryText : "rgba(255,255,255,0.68)"}
              />
              <Text
                style={{
                  color: active ? colors.primaryText : "rgba(255,255,255,0.68)",
                  fontSize: 9,
                  fontWeight: active ? "800" : "700",
                  textAlign: "center",
                }}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
