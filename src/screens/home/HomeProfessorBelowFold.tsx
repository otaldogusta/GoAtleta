import { memo } from "react";

import { Platform, Text, View } from "react-native";

import { useRouter } from "expo-router";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";

type HomeProfessorBelowFoldProps = {
  variant?: "professor" | "coordination";
  canOpenClassesShortcut: boolean;
  canOpenStudentsShortcut: boolean;
  canOpenTrainingShortcut: boolean;
  canOpenCalendarShortcut: boolean;
  canOpenAbsenceNoticesShortcut: boolean;
  canOpenPeriodizationShortcut: boolean;
};

type ShortcutCardProps = {
  label: string;
  description: string;
  icon: GoAtletaIconName;
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
        backgroundColor: colors.secondaryBg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
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
          <GoAtletaIcon name={icon} size={isWeb ? 15 : 17} color={colors.text} />
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
  variant = "professor",
  canOpenClassesShortcut,
  canOpenStudentsShortcut,
  canOpenTrainingShortcut,
  canOpenCalendarShortcut,
  canOpenAbsenceNoticesShortcut,
  canOpenPeriodizationShortcut,
}: HomeProfessorBelowFoldProps) {
  const { colors } = useAppTheme();
  const router = useRouter();

  if (variant === "coordination") {
    const coordinationShortcuts = [
      {
        label: "Turmas",
        description: "Cadastros e ciclos",
        icon: "classes",
        route: "/coord/classes",
      },
      {
        label: "Relatórios",
        description: "Indicadores da operação",
        icon: "reports",
        route: "/coord/reports",
      },
      {
        label: "Gestão",
        description: "Configurações da operação",
        icon: "management",
        route: "/coord/management",
      },
      {
        label: "Eventos",
        description: "Agenda institucional",
        icon: "events",
        route: "/coord/events",
      },
      {
        label: "Membros",
        description: "Funções e permissões",
        icon: "members",
        route: "/coord/org-members",
      },
      {
        label: "Presença NFC",
        description: "Registrar por UID",
        icon: "nfc",
        route: "/prof/nfc-attendance",
      },
      {
        label: "Comunicados",
        description: "Avisos para a organização",
        icon: "communications",
        route: "/coord/communications",
      },
      {
        label: "Periodização",
        description: "Ciclos e cargas",
        icon: "periodization",
        route: "/coord/periodization",
      },
      {
        label: "Regulamentos",
        description: "Fontes e histórico",
        icon: "regulations",
        route: "/coord/regulation-history",
      },
      {
        label: "Assistente",
        description: "Apoio à coordenação",
        icon: "assistant",
        route: "/coord/assistant",
      },
    ] as const;

    return (
      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Atalhos</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {coordinationShortcuts.map((shortcut) => (
            <ShortcutCard
              key={shortcut.route}
              label={shortcut.label}
              description={shortcut.description}
              icon={shortcut.icon}
              onPress={() => router.push(shortcut.route)}
            />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Atalhos</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {canOpenTrainingShortcut ? (
          <ShortcutCard
            label="Planejamento"
            description="Modelos e planejamentos"
            icon="planning"
            onPress={() => router.push("/prof/planning")}
          />
        ) : null}

        <ShortcutCard
          label="Consultoria online"
          description="Prescrição individual"
          icon="consultation"
          onPress={() => router.push("/consultation")}
        />

        {canOpenClassesShortcut ? (
          <ShortcutCard
            label="Turmas"
            description="Cadastros e lista"
            icon="classes"
            onPress={() => router.push("/prof/classes")}
          />
        ) : null}

        {canOpenStudentsShortcut ? (
          <ShortcutCard
            label="Alunos"
            description="Lista e chamada"
            icon="students"
            onPress={() => router.push("/prof/students")}
          />
        ) : null}

        {canOpenCalendarShortcut ? (
          <ShortcutCard
            label="Calendário mensal"
            description="Aulas e chamada"
            icon="calendar"
            onPress={() => router.push("/prof/calendar")}
          />
        ) : null}

        {canOpenAbsenceNoticesShortcut ? (
          <ShortcutCard
            label="Avisos de ausência"
            description="Alunos ausentes"
            icon="absenceNotices"
            onPress={() => router.push("/prof/absence-notices")}
          />
        ) : null}

        {canOpenClassesShortcut ? (
          <ShortcutCard
            label="Presença NFC"
            description="Registrar por UID"
            icon="nfc"
            onPress={() => router.push("/prof/nfc-attendance")}
          />
        ) : null}

        {canOpenTrainingShortcut ? (
          <ShortcutCard
            label="Exercícios"
            description="Biblioteca com vídeos"
            icon="exercises"
            onPress={() => router.push("/prof/exercises")}
          />
        ) : null}

        {canOpenPeriodizationShortcut ? (
          <ShortcutCard
            label="Periodização"
            description="Ciclos e cargas"
            icon="periodization"
            onPress={() => router.push("/prof/periodization")}
          />
        ) : null}
      </View>
    </View>
  );
}

export const HomeProfessorBelowFold = memo(HomeProfessorBelowFoldBase);
HomeProfessorBelowFold.displayName = "HomeProfessorBelowFold";
