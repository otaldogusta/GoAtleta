import { memo } from "react";

import { Ionicons } from "@expo/vector-icons";

import { Platform, Text, View } from "react-native";

import { useRouter } from "expo-router";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type HomeProfessorBelowFoldProps = {
  canOpenClassesShortcut: boolean;
  canOpenStudentsShortcut: boolean;
  canSeeCoordination: boolean;
};

type ShortcutCardProps = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function ShortcutCard({ label, description, icon, onPress }: ShortcutCardProps) {
  const { colors, mode } = useAppTheme();
  const isAndroidLight = Platform.OS === "android" && mode === "light";
  const isWeb = Platform.OS === "web";

  const shortcutCardSurfaceStyle = isAndroidLight
    ? ({
        backgroundColor: "#f8fafc",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.06)",
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      } as const)
    : ({
        backgroundColor: mode === "dark" ? "rgba(255,255,255,0.04)" : colors.secondaryBg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.06)",
        shadowColor: "#000",
        shadowOpacity: mode === "dark" ? 0.08 : 0.03,
        shadowRadius: mode === "dark" ? 6 : 3,
        shadowOffset: { width: 0, height: 2 },
        elevation: mode === "dark" ? 2 : 1,
      } as const);

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexBasis: "48%",
        padding: isWeb ? 12 : 14,
        borderRadius: 18,
        ...shortcutCardSurfaceStyle,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: isWeb ? 30 : 34,
            height: isWeb ? 30 : 34,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Ionicons name={icon} size={isWeb ? 15 : 17} color={colors.text} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: isWeb ? 14 : 16, fontWeight: "700", color: colors.text }} numberOfLines={1}>
            {label}
          </Text>
          <Text style={{ color: colors.muted, marginTop: 2, fontSize: isWeb ? 12 : 14 }} numberOfLines={1}>
            {description}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function HomeProfessorBelowFoldBase({
  canOpenClassesShortcut,
  canOpenStudentsShortcut,
  canSeeCoordination,
}: HomeProfessorBelowFoldProps) {
  const { colors } = useAppTheme();
  const router = useRouter();

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Atalhos</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <ShortcutCard
          label="Planejamento"
          description="Modelos e planejamentos"
          icon="clipboard-outline"
          onPress={() => router.push("/prof/planning")}
        />

        {canOpenClassesShortcut ? (
          <ShortcutCard
            label="Turmas"
            description="Cadastros e lista"
            icon="people-outline"
            onPress={() => router.push("/prof/classes")}
          />
        ) : null}

        {canOpenStudentsShortcut ? (
          <ShortcutCard
            label="Alunos"
            description="Lista e chamada"
            icon="school-outline"
            onPress={() => router.push("/prof/students")}
          />
        ) : null}

        <ShortcutCard
          label="Calendário semanal"
          description="Aulas e chamada"
          icon="calendar-outline"
          onPress={() => router.push("/prof/calendar")}
        />

        {canSeeCoordination ? (
          <ShortcutCard
            label="Coordenação"
            description="Dashboard e gerenciar membros"
            icon="analytics-outline"
            onPress={() => router.push("/coord/management")}
          />
        ) : null}

        <ShortcutCard
          label="Avisos de ausência"
          description="Alunos ausentes"
          icon="notifications-outline"
          onPress={() => router.push("/prof/absence-notices")}
        />

        <ShortcutCard
          label="Presença NFC"
          description="Registrar por UID"
          icon="radio-outline"
          onPress={() => router.push("/prof/nfc-attendance")}
        />

        <ShortcutCard
          label="Exercícios"
          description="Biblioteca com vídeos"
          icon="fitness-outline"
          onPress={() => router.push("/prof/exercises")}
        />

        <ShortcutCard
          label="Periodização"
          description="Ciclos e cargas"
          icon="trending-up-outline"
          onPress={() => router.push("/prof/periodization")}
        />
      </View>
    </View>
  );
}

export const HomeProfessorBelowFold = memo(HomeProfessorBelowFoldBase);
HomeProfessorBelowFold.displayName = "HomeProfessorBelowFold";
