import { memo } from "react";

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
  onPress: () => void;
};

function ShortcutCard({ label, description, onPress }: ShortcutCardProps) {
  const { colors, mode } = useAppTheme();
  const isAndroidLight = Platform.OS === "android" && mode === "light";

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
        padding: 14,
        borderRadius: 18,
        ...shortcutCardSurfaceStyle,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>{label}</Text>
      <Text style={{ color: colors.muted, marginTop: 6 }}>{description}</Text>
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
          onPress={() => router.push("/prof/planning")}
        />

        {canOpenClassesShortcut ? (
          <ShortcutCard
            label="Turmas"
            description="Cadastros e lista"
            onPress={() => router.push("/prof/classes")}
          />
        ) : null}

        {canOpenStudentsShortcut ? (
          <ShortcutCard
            label="Alunos"
            description="Lista e chamada"
            onPress={() => router.push("/prof/students")}
          />
        ) : null}

        <ShortcutCard
          label="Calendário semanal"
          description="Aulas e chamada"
          onPress={() => router.push("/prof/calendar")}
        />

        {canSeeCoordination ? (
          <ShortcutCard
            label="Coordenação"
            description="Dashboard e gerenciar membros"
            onPress={() => router.push("/coord/management")}
          />
        ) : null}

        <ShortcutCard
          label="Avisos de ausência"
          description="Alunos ausentes"
          onPress={() => router.push("/prof/absence-notices")}
        />

        <ShortcutCard
          label="Presença NFC"
          description="Registrar por UID"
          onPress={() => router.push("/prof/nfc-attendance")}
        />

        <ShortcutCard
          label="Exercícios"
          description="Biblioteca com vídeos"
          onPress={() => router.push("/prof/exercises")}
        />

        <ShortcutCard
          label="Periodização"
          description="Ciclos e cargas"
          onPress={() => router.push("/prof/periodization")}
        />
      </View>
    </View>
  );
}

export const HomeProfessorBelowFold = memo(HomeProfessorBelowFoldBase);
HomeProfessorBelowFold.displayName = "HomeProfessorBelowFold";
