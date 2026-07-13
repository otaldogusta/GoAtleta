import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";

type WorkspaceAction = {
  key: string;
  label: string;
  description: string;
  icon: GoAtletaIconName;
  onPress: () => void;
};

type ClassOperationsWorkspaceProps = {
  colors: ThemeColors;
  compact: boolean;
  nextClassLabel: string;
  scheduleLabel: string;
  startTime: string;
  focusLabel: string;
  studentCount: number | null;
  cycleLabel: string;
  cycleContext: string;
  latestReportLabel: string;
  onOpenSession: () => void;
  onOpenAttendance: () => void;
  onOpenPeriodization: () => void;
  onOpenPlanning: () => void;
  onOpenVisualTech: () => void;
  onOpenScouting: () => void;
  onOpenStudents: () => void;
  onExportRoster: () => void;
  onOpenWhatsApp: () => void;
};

type ClassContextStripProps = {
  colors: ThemeColors;
  compact: boolean;
  unitLabel: string;
  scheduleLabel: string;
  studentCount: number | null;
  nextClassLabel: string;
};

function ContextItem({ icon, label, colors, compact = false }: {
  icon: GoAtletaIconName;
  label: string;
  colors: ThemeColors;
  compact?: boolean;
}) {
  return (
    <View style={[styles.contextItem, compact ? styles.contextItemCompact : null]}>
      <GoAtletaIcon name={icon} size={18} color={colors.muted} />
      <Text numberOfLines={1} style={[styles.contextLabel, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

export const ClassContextStrip = memo(function ClassContextStrip({
  colors,
  compact,
  unitLabel,
  scheduleLabel,
  studentCount,
  nextClassLabel,
}: ClassContextStripProps) {
  return (
    <View
      style={[
        styles.contextStrip,
        compact ? styles.contextStripCompact : null,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <ContextItem icon="organization" label={unitLabel} colors={colors} compact={compact} />
      <ContextItem icon="time" label={scheduleLabel} colors={colors} compact={compact} />
      <ContextItem
        icon="students"
        label={studentCount === null ? "Alunos: —" : `${studentCount} ${studentCount === 1 ? "aluno" : "alunos"}`}
        colors={colors}
        compact={compact}
      />
      <ContextItem icon="calendar" label={`Próxima aula: ${nextClassLabel}`} colors={colors} compact={compact} />
    </View>
  );
});

const WorkspaceActionRow = memo(function WorkspaceActionRow({
  action,
  colors,
  last,
}: {
  action: WorkspaceAction;
  colors: ThemeColors;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.actionRow,
        { borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 },
        last ? styles.actionRowLast : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <GoAtletaIcon name={action.icon} size={21} color={colors.muted} />
      <View style={styles.actionCopy}>
        <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
        <Text numberOfLines={1} style={[styles.actionDescription, { color: colors.muted }]}>
          {action.description}
        </Text>
      </View>
      <GoAtletaIcon name="chevronRight" size={17} color={colors.muted} />
    </Pressable>
  );
});

function RailAction({ action, colors, selected = false }: {
  action: WorkspaceAction;
  colors: ThemeColors;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={action.onPress}
      style={({ pressed }) => [
        styles.railAction,
        selected ? { backgroundColor: colors.successBg } : null,
        { opacity: pressed ? 0.72 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <GoAtletaIcon
        name={action.icon}
        size={18}
        color={selected ? colors.successText : colors.muted}
      />
      <Text
        numberOfLines={1}
        style={[styles.railActionLabel, { color: selected ? colors.successText : colors.text }]}
      >
        {action.label}
      </Text>
      {selected ? <View style={[styles.selectedDot, { backgroundColor: colors.primaryBg }]} /> : null}
    </Pressable>
  );
}

function RailSection({ title, actions, colors }: {
  title: string;
  actions: WorkspaceAction[];
  colors: ThemeColors;
}) {
  return (
    <View style={styles.railSection}>
      <Text style={[styles.railSectionTitle, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.railDivider, { backgroundColor: colors.border }]} />
      {actions.map((action) => (
        <RailAction key={action.key} action={action} colors={colors} />
      ))}
    </View>
  );
}

function OverviewStat({ icon, value, label, colors }: {
  icon: GoAtletaIconName;
  value: string;
  label: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.overviewStat}>
      <GoAtletaIcon name={icon} size={27} color={colors.primaryBg} />
      <View style={styles.overviewCopy}>
        <Text numberOfLines={1} style={[styles.overviewValue, { color: colors.text }]}>{value}</Text>
        <Text numberOfLines={1} style={[styles.overviewLabel, { color: colors.muted }]}>{label}</Text>
      </View>
    </View>
  );
}

export const ClassOperationsWorkspace = memo(function ClassOperationsWorkspace({
  colors,
  compact,
  nextClassLabel,
  scheduleLabel,
  startTime,
  focusLabel,
  studentCount,
  cycleLabel,
  cycleContext,
  latestReportLabel,
  onOpenSession,
  onOpenAttendance,
  onOpenPeriodization,
  onOpenPlanning,
  onOpenVisualTech,
  onOpenScouting,
  onOpenStudents,
  onExportRoster,
  onOpenWhatsApp,
}: ClassOperationsWorkspaceProps) {
  const actions = useMemo<Record<string, WorkspaceAction>>(() => ({
    overview: {
      key: "overview",
      label: "Visão geral",
      description: "Resumo operacional da turma",
      icon: "dashboard",
      onPress: () => undefined,
    },
    planning: {
      key: "planning",
      label: "Planejamentos da turma",
      description: "Ver mês, semana e aulas",
      icon: "planning",
      onPress: onOpenPlanning,
    },
    visual: {
      key: "visual",
      label: "Quadra visual",
      description: "Rodízio, movimentação e desenho técnico",
      icon: "map",
      onPress: onOpenVisualTech,
    },
    periodization: {
      key: "periodization",
      label: "Periodização da turma",
      description: "Ver ciclo, semana e metas",
      icon: "periodization",
      onPress: onOpenPeriodization,
    },
    scouting: {
      key: "scouting",
      label: "Análise de scouting",
      description: "Vídeos, jogos e leitura avançada",
      icon: "scouting",
      onPress: onOpenScouting,
    },
    students: {
      key: "students",
      label: "Alunos",
      description: "Lista, presença e dados",
      icon: "students",
      onPress: onOpenStudents,
    },
    export: {
      key: "export",
      label: "Exportar lista da turma",
      description: "Lista de chamada mensal",
      icon: "download",
      onPress: onExportRoster,
    },
    whatsapp: {
      key: "whatsapp",
      label: "WhatsApp",
      description: "Contato com responsáveis",
      icon: "whatsapp",
      onPress: onOpenWhatsApp,
    },
  }), [
    onExportRoster,
    onOpenPeriodization,
    onOpenPlanning,
    onOpenScouting,
    onOpenStudents,
    onOpenVisualTech,
    onOpenWhatsApp,
  ]);

  const recommendedActions = [actions.periodization, actions.planning, actions.visual];
  const compactActions = [
    ...recommendedActions,
    actions.scouting,
    actions.students,
    actions.export,
    actions.whatsapp,
  ];

  return (
    <View style={[styles.workspace, compact ? styles.workspaceCompact : null]}>
      {!compact ? (
        <View style={[styles.rail, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.railHeading, { color: colors.muted }]}>Hoje</Text>
          <RailAction action={actions.overview} colors={colors} selected />
          <RailSection title="Planejamento" actions={[actions.planning, actions.visual]} colors={colors} />
          <RailSection title="Desempenho" actions={[actions.periodization, actions.scouting]} colors={colors} />
          <RailSection
            title="Gestão"
            actions={[actions.students, actions.export, actions.whatsapp]}
            colors={colors}
          />
        </View>
      ) : null}

      <View style={styles.mainColumn}>
        <View
          style={[
            styles.nextClassPanel,
            compact ? styles.nextClassPanelCompact : null,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.nextClassCopy}>
            <View style={styles.sectionTitleRow}>
              <GoAtletaIcon name="agenda" size={20} color={colors.muted} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Próxima aula</Text>
            </View>
            <Text style={[styles.nextClassMeta, { color: colors.muted }]}>
              {nextClassLabel} · {startTime}
            </Text>
            <Text style={[styles.focusLabel, { color: colors.muted }]}>Foco da aula</Text>
            <Text numberOfLines={2} style={[styles.focusValue, { color: colors.text }]}>{focusLabel}</Text>
          </View>
          <View style={[styles.heroActions, compact ? styles.heroActionsCompact : null]}>
            <Pressable
              onPress={onOpenSession}
              style={({ pressed }) => [
                styles.primaryAction,
                { backgroundColor: colors.primaryBg, opacity: pressed ? 0.8 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Abrir aula"
            >
              <Text style={[styles.primaryActionText, { color: colors.primaryText }]}>Abrir aula</Text>
              <GoAtletaIcon name="chevronRight" size={18} color={colors.primaryText} />
            </Pressable>
            <Pressable
              onPress={onOpenAttendance}
              style={({ pressed }) => [
                styles.secondaryAction,
                { borderColor: colors.border, opacity: pressed ? 0.72 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Fazer chamada"
            >
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>Fazer chamada</Text>
              <GoAtletaIcon name="attendance" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.overviewSection}>
          <View style={styles.sectionTitleRow}>
            <GoAtletaIcon name="students" size={21} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Visão da turma</Text>
          </View>
          <View
            style={[
              styles.overviewPanel,
              compact ? styles.overviewPanelCompact : null,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <OverviewStat
              icon="students"
              value={studentCount === null ? "—" : String(studentCount)}
              label={studentCount === 1 ? "aluno" : "alunos"}
              colors={colors}
            />
            <OverviewStat icon="sync" value={cycleLabel} label={cycleContext} colors={colors} />
            <OverviewStat icon="document" value={latestReportLabel} label="último relatório" colors={colors} />
          </View>
        </View>

        <View style={styles.recommendedSection}>
          <Text style={[styles.recommendedTitle, { color: colors.text }]}>
            {compact ? "Ações da turma" : "Ações recomendadas para hoje"}
          </Text>
          <View style={[styles.actionList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(compact ? compactActions : recommendedActions).map((action, index, list) => (
              <WorkspaceActionRow
                key={action.key}
                action={action}
                colors={colors}
                last={index === list.length - 1}
              />
            ))}
          </View>
        </View>

        {compact ? (
          <Text style={[styles.scheduleHint, { color: colors.muted }]}>Agenda: {scheduleLabel}</Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  contextStrip: {
    width: "100%",
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  contextStripCompact: {
    flexWrap: "wrap",
    alignItems: "flex-start",
    rowGap: 10,
    columnGap: 12,
    paddingHorizontal: 14,
  },
  contextItem: {
    flex: 1,
    minWidth: 150,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contextItemCompact: {
    flexGrow: 0,
    flexBasis: "47%",
    minWidth: 0,
    justifyContent: "flex-start",
  },
  contextLabel: {
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
  },
  workspace: {
    width: "100%",
    flexDirection: "row",
    alignItems: "stretch",
    gap: 22,
  },
  workspaceCompact: {
    flexDirection: "column",
  },
  rail: {
    width: 268,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 8,
    flexShrink: 0,
  },
  railHeading: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  railSection: {
    gap: 3,
    marginTop: 10,
  },
  railSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
  },
  railDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
    marginBottom: 2,
  },
  railAction: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  railActionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mainColumn: {
    flex: 1,
    minWidth: 0,
    gap: 22,
  },
  nextClassPanel: {
    minHeight: 180,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 20,
  },
  nextClassPanelCompact: {
    flexDirection: "column",
    minHeight: 0,
    padding: 18,
  },
  nextClassCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  nextClassMeta: {
    marginTop: 14,
    fontSize: 13,
  },
  focusLabel: {
    marginTop: 22,
    fontSize: 12,
    fontWeight: "700",
  },
  focusValue: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
  },
  heroActions: {
    width: 210,
    justifyContent: "center",
    gap: 10,
  },
  heroActionsCompact: {
    width: "100%",
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryAction: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  overviewSection: {
    gap: 12,
  },
  overviewPanel: {
    minHeight: 108,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  overviewPanelCompact: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 14,
  },
  overviewStat: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  overviewCopy: {
    minWidth: 0,
  },
  overviewValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  overviewLabel: {
    marginTop: 2,
    fontSize: 12,
  },
  recommendedSection: {
    gap: 12,
  },
  recommendedTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  actionList: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  actionRow: {
    minHeight: 70,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  actionDescription: {
    marginTop: 3,
    fontSize: 12,
  },
  scheduleHint: {
    fontSize: 12,
    paddingHorizontal: 2,
  },
});
