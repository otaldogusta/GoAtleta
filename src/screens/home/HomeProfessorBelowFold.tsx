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
        backgroundColor: "#ffffff",
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
      } as const)
    : ({
        backgroundColor: colors.card,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: "#000",
        shadowOpacity: mode === "dark" ? 0.28 : 0.08,
        shadowRadius: mode === "dark" ? 10 : 6,
        shadowOffset: { width: 0, height: 4 },
        elevation: mode === "dark" ? 6 : 2,
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
