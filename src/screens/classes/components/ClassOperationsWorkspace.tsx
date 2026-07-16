import { memo, type ReactNode, useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from "react-native";

import type { TrainingPlan } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { CLASS_PLAN_BLOCK_PRESENTATION } from "./class-plan-block-presentation";

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
  scheduleLabel: string;
  lessonDateLabel: string;
  appliedPlan: TrainingPlan | null;
  isLoadingLessonPlan: boolean;
  onPreviousLesson: () => void;
  onNextLesson: () => void;
  onViewPlan: () => void;
  onGeneratePlan: () => void;
  isGeneratingPlan: boolean;
  contextualInsight?: ReactNode;
  studentCount: number | null;
  contactStatusValue: string;
  contactStatusLabel: string;
  reportStatusValue: string;
  reportStatusLabel: string;
  onOpenSession: () => void;
  onOpenAttendance: () => void;
  onOpenReport: () => void;
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
      <Text numberOfLines={compact ? 2 : 1} style={[styles.contextLabel, { color: colors.text }]}>{label}</Text>
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
      {!compact ? (
        <>
          <ContextItem
            icon="students"
            label={studentCount === null ? "Alunos: —" : `${studentCount} ${studentCount === 1 ? "aluno" : "alunos"}`}
            colors={colors}
          />
          <ContextItem icon="calendar" label={`Próxima aula: ${nextClassLabel}`} colors={colors} />
        </>
      ) : null}
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

function OverviewStat({ icon, value, label, colors, compact = false, stacked = false }: {
  icon: GoAtletaIconName;
  value: string;
  label: string;
  colors: ThemeColors;
  compact?: boolean;
  stacked?: boolean;
}) {
  return (
    <View style={[
      styles.overviewStat,
      compact ? styles.overviewStatCompact : null,
      stacked ? styles.overviewStatStacked : null,
    ]}>
      <GoAtletaIcon name={icon} size={compact || stacked ? 22 : 27} color={colors.primaryBg} />
      <View style={[styles.overviewCopy, compact ? styles.overviewCopyCompact : null]}>
        <Text numberOfLines={compact ? 2 : 1} style={[styles.overviewValue, { color: colors.text }]}>{value}</Text>
        <Text numberOfLines={compact ? 2 : 1} style={[styles.overviewLabel, { color: colors.muted }]}>{label}</Text>
      </View>
    </View>
  );
}

function formatPlanDuration(value: string | undefined) {
  const text = String(value ?? "").trim();
  if (!text) return "—";
  return /min/i.test(text) ? text : `${text} min`;
}

function PlanBlockRow({
  label,
  activity,
  duration,
  colors,
  icon,
}: {
  label: string;
  activity?: string;
  duration?: string;
  colors: ThemeColors;
  icon: GoAtletaIconName;
}) {
  return (
    <View style={[styles.planBlockRow, { borderTopColor: colors.border }]}>
      <GoAtletaIcon name={icon} size={18} color={colors.primaryBg} />
      <View style={styles.planBlockCopy}>
        <Text style={[styles.planBlockLabel, { color: colors.text }]}>{activity || label}</Text>
        {activity && activity !== label ? (
          <Text numberOfLines={1} style={[styles.planBlockMeta, { color: colors.muted }]}>{label}</Text>
        ) : null}
      </View>
      <Text style={[styles.planBlockDuration, { color: colors.muted }]}>{formatPlanDuration(duration)}</Text>
    </View>
  );
}

function LessonDateNavigator({
  colors,
  dateLabel,
  onPrevious,
  onNext,
  isLoading,
}: {
  colors: ThemeColors;
  dateLabel: string;
  onPrevious: () => void;
  onNext: () => void;
  isLoading: boolean;
}) {
  return (
    <View style={[styles.lessonDateNavigator, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Pressable
        onPress={onPrevious}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel="Aula anterior"
        style={({ pressed }) => [styles.lessonDateButton, { borderColor: colors.border, opacity: isLoading ? 0.45 : pressed ? 0.7 : 1 }]}
      >
        <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
      </Pressable>
      <View style={styles.lessonDateCopy}>
        <Text style={[styles.lessonDateLabel, { color: colors.text }]}>{dateLabel}</Text>
        {isLoading ? <ActivityIndicator size="small" color={colors.primaryBg} style={styles.lessonDateLoader} /> : null}
      </View>
      <Pressable
        onPress={onNext}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel="Próxima aula"
        style={({ pressed }) => [styles.lessonDateButton, { borderColor: colors.border, opacity: isLoading ? 0.45 : pressed ? 0.7 : 1 }]}
      >
        <GoAtletaIcon name="chevronRight" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

export const ClassOperationsWorkspace = memo(function ClassOperationsWorkspace({
  colors,
  compact,
  scheduleLabel,
  lessonDateLabel,
  appliedPlan,
  isLoadingLessonPlan,
  onPreviousLesson,
  onNextLesson,
  onViewPlan,
  onGeneratePlan,
  isGeneratingPlan,
  contextualInsight,
  studentCount,
  contactStatusValue,
  contactStatusLabel,
  reportStatusValue,
  reportStatusLabel,
  onOpenSession,
  onOpenAttendance,
  onOpenReport,
  onOpenPeriodization,
  onOpenPlanning,
  onOpenVisualTech,
  onOpenScouting,
  onOpenStudents,
  onExportRoster,
  onOpenWhatsApp,
}: ClassOperationsWorkspaceProps) {
  const lessonContentAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isLoadingLessonPlan) {
      lessonContentAnim.stopAnimation();
      lessonContentAnim.setValue(0);
      return;
    }

    Animated.timing(lessonContentAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isLoadingLessonPlan, lessonContentAnim, lessonDateLabel]);

  const actions = useMemo<Record<string, WorkspaceAction>>(() => ({
    overview: {
      key: "overview",
      label: "Visão geral",
      description: "Resumo operacional da turma",
      icon: "dashboard",
      onPress: () => undefined,
    },
    session: {
      key: "session",
      label: "Aula do dia",
      description: "Preparar treino e atividades",
      icon: "agenda",
      onPress: onOpenSession,
    },
    attendance: {
      key: "attendance",
      label: "Chamada",
      description: "Registrar presença da turma",
      icon: "attendance",
      onPress: onOpenAttendance,
    },
    report: {
      key: "report",
      label: "Relatório",
      description: "Registrar a aula realizada",
      icon: "document",
      onPress: onOpenReport,
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
    onOpenAttendance,
    onOpenPeriodization,
    onOpenPlanning,
    onOpenReport,
    onOpenScouting,
    onOpenSession,
    onOpenStudents,
    onOpenVisualTech,
    onOpenWhatsApp,
  ]);

  const renderOverviewSection = (stacked = false) => (
    <View style={[styles.overviewSection, stacked ? styles.overviewSectionSide : null]}>
      <View
        style={[
          styles.overviewPanel,
          compact ? styles.overviewPanelCompact : null,
          stacked ? styles.overviewPanelStacked : null,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <OverviewStat
          icon="students"
          value={studentCount === null ? "—" : String(studentCount)}
          label={studentCount === 1 ? "aluno" : "alunos"}
          colors={colors}
          compact={compact}
          stacked={stacked}
        />
        <OverviewStat
          icon="whatsapp"
          value={contactStatusValue}
          label={contactStatusLabel}
          colors={colors}
          compact={compact}
          stacked={stacked}
        />
        <OverviewStat
          icon="document"
          value={reportStatusValue}
          label={reportStatusLabel}
          colors={colors}
          compact={compact}
          stacked={stacked}
        />
      </View>
      {contextualInsight ? (
        <View
          style={[
            styles.contextualInsight,
            stacked ? styles.contextualInsightSide : null,
            { backgroundColor: colors.secondaryBg, borderColor: colors.border },
          ]}
        >
          {contextualInsight}
        </View>
      ) : null}
    </View>
  );

  const planSection = (
    <View style={styles.planSection}>
      <LessonDateNavigator
        colors={colors}
        dateLabel={lessonDateLabel}
        onPrevious={onPreviousLesson}
        onNext={onNextLesson}
        isLoading={isLoadingLessonPlan}
      />
      <View style={[styles.planPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.planHeader}>
          <Text style={[styles.planTitle, { color: colors.text }]}>Plano da aula</Text>
          {!isLoadingLessonPlan && appliedPlan ? (
            <View style={styles.planAppliedStatus}>
              <GoAtletaIcon name="checkmarkCircle" size={17} color={colors.successText} />
              <Text style={[styles.planAppliedLabel, { color: colors.successText }]}>Plano aplicado</Text>
            </View>
          ) : null}
        </View>
        {isLoadingLessonPlan ? (
          <View style={styles.lessonLoadingContent} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primaryBg} />
            <Text style={[styles.emptyPlanTitle, { color: colors.text }]}>Carregando a aula</Text>
            <Text style={[styles.emptyPlanDescription, { color: colors.muted }]}>Atualizando o plano e os indicadores do dia.</Text>
          </View>
        ) : (
          <Animated.View
            style={[
              styles.lessonPlanContent,
              {
                opacity: lessonContentAnim,
                transform: [{ translateX: lessonContentAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
              },
            ]}
          >
          {appliedPlan ? (
          <>
            <View style={styles.planSummary}>
              <GoAtletaIcon name="document" size={20} color={colors.muted} />
              <View style={styles.planSummaryCopy}>
                <Text style={[styles.planSummaryTitle, { color: colors.text }]}>{appliedPlan.title}</Text>
                <Text numberOfLines={1} style={[styles.planSummaryMeta, { color: colors.muted }]}>
                  Foco: {appliedPlan.main?.[0] || "Fundamentos"}
                </Text>
              </View>
            </View>
            <View style={styles.planBlocks}>
              <PlanBlockRow
                label="Aquecimento"
                activity={appliedPlan.warmup?.[0]}
                duration={appliedPlan.warmupTime}
                icon={CLASS_PLAN_BLOCK_PRESENTATION.warmup.icon}
                colors={colors}
              />
              <PlanBlockRow
                label="Parte principal"
                activity={appliedPlan.main?.[0]}
                duration={appliedPlan.mainTime}
                icon={CLASS_PLAN_BLOCK_PRESENTATION.main.icon}
                colors={colors}
              />
              <PlanBlockRow
                label="Volta à calma"
                activity={appliedPlan.cooldown?.[0]}
                duration={appliedPlan.cooldownTime}
                icon={CLASS_PLAN_BLOCK_PRESENTATION.cooldown.icon}
                colors={colors}
              />
            </View>
            <View style={styles.planActions}>
              <Pressable
                onPress={onViewPlan}
                accessibilityRole="button"
                accessibilityLabel="Ver plano"
                style={({ pressed }) => [styles.planPrimaryButton, styles.planAppliedAction, { backgroundColor: colors.primaryBg, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.planPrimaryButtonLabel, { color: colors.primaryText }]}>Ver plano</Text>
              </Pressable>
            </View>
          </>
        ) : isGeneratingPlan ? (
          <View style={styles.emptyPlanContent} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primaryBg} />
            <Text style={[styles.emptyPlanTitle, { color: colors.text }]}>Preparando o plano</Text>
            <Text style={[styles.emptyPlanDescription, { color: colors.muted }]}>Organizando atividades para esta aula.</Text>
          </View>
        ) : (
          <View style={styles.emptyPlanContent}>
            <GoAtletaIcon name="document" size={30} color={colors.muted} />
            <Text style={[styles.emptyPlanTitle, { color: colors.text }]}>Sem plano aplicado</Text>
            <Text style={[styles.emptyPlanDescription, { color: colors.muted }]}>Escolha um treino salvo ou gere um novo plano para esta aula.</Text>
            <View style={styles.emptyPlanActions}>
              <Pressable
                onPress={onOpenSession}
                accessibilityRole="button"
                accessibilityLabel="Aplicar treino"
                style={({ pressed }) => [styles.planPrimaryButton, styles.emptyPlanAction, { backgroundColor: colors.primaryBg, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={[styles.planPrimaryButtonLabel, { color: colors.primaryText }]}>Aplicar treino</Text>
              </Pressable>
              <Pressable
                onPress={onGeneratePlan}
                accessibilityRole="button"
                accessibilityLabel="Gerar plano automático"
                style={({ pressed }) => [styles.planSecondaryButton, styles.emptyPlanAction, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
              >
                <GoAtletaIcon name="sparkles" size={16} color={colors.text} />
                <Text style={[styles.planSecondaryButtonLabel, { color: colors.text }]}>Gerar plano automático</Text>
              </Pressable>
            </View>
          </View>
        )}
          </Animated.View>
        )}
        <View style={[styles.planActionList, { borderTopColor: colors.border }]}>
          <WorkspaceActionRow action={actions.attendance} colors={colors} />
          <WorkspaceActionRow action={actions.report} colors={colors} last />
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.workspace, compact ? styles.workspaceCompact : null]}>
      {!compact ? (
        <View style={[styles.rail, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.railHeading, { color: colors.muted }]}>Hoje</Text>
          <RailAction action={actions.overview} colors={colors} selected />
          <RailAction action={actions.attendance} colors={colors} />
          <RailAction action={actions.report} colors={colors} />
          <RailSection
            title="Planejamento"
            actions={[actions.planning, actions.visual]}
            colors={colors}
          />
          <RailSection title="Desempenho" actions={[actions.periodization, actions.scouting]} colors={colors} />
          <RailSection
            title="Gestão"
            actions={[actions.students, actions.export, actions.whatsapp]}
            colors={colors}
          />
        </View>
      ) : null}

      <View style={styles.mainColumn}>
        {compact ? (
          <>
            {planSection}
            {renderOverviewSection()}
          </>
        ) : (
          <View style={styles.desktopWorkspace}>
            <View style={styles.desktopContentColumn}>
              {planSection}
            </View>
            {renderOverviewSection(true)}
          </View>
        )}
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
  desktopWorkspace: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 18,
  },
  desktopContentColumn: {
    flex: 1,
    minWidth: 0,
    gap: 22,
  },
  planSection: {
    gap: 12,
  },
  lessonDateNavigator: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lessonDateButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonDateCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
  },
  lessonDateLoader: {
    marginTop: 4,
  },
  lessonDateLabel: {
    fontSize: 16,
    fontWeight: "800",
  },
  lessonDateTime: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  planPanel: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  lessonPlanContent: {
    minHeight: 250,
  },
  lessonLoadingContent: {
    minHeight: 250,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 8,
  },
  planHeader: {
    minHeight: 60,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  planAppliedStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  planAppliedLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  planSummary: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planSummaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  planSummaryTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  planSummaryMeta: {
    marginTop: 3,
    fontSize: 12,
  },
  planBlocks: {
    paddingHorizontal: 18,
  },
  planBlockRow: {
    minHeight: 52,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planBlockCopy: {
    flex: 1,
    minWidth: 0,
  },
  planBlockLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  planBlockMeta: {
    marginTop: 2,
    fontSize: 11,
  },
  planBlockDuration: {
    fontSize: 12,
    fontWeight: "700",
  },
  planActions: {
    flexDirection: "row",
    padding: 18,
    gap: 9,
  },
  planAppliedAction: {
    flex: 1,
    minWidth: 0,
  },
  emptyPlanActions: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
  },
  emptyPlanAction: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
  },
  planPrimaryButton: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  planPrimaryButtonLabel: {
    fontSize: 14,
    fontWeight: "800",
  },
  planSecondaryButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 16,
  },
  planSecondaryButtonLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyPlanContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 8,
  },
  emptyPlanTitle: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyPlanDescription: {
    maxWidth: 360,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  planActionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  contextualInsight: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  contextualInsightSide: {
    marginTop: -4,
  },
  overviewSection: {
    gap: 12,
  },
  overviewSectionSide: {
    width: 278,
    flexShrink: 0,
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
    minHeight: 0,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  overviewPanelStacked: {
    minHeight: 148,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "center",
    gap: 8,
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
  overviewCopyCompact: {
    width: "100%",
  },
  overviewStatCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: 7,
  },
  overviewStatStacked: {
    flex: 0,
    justifyContent: "flex-start",
    gap: 10,
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
