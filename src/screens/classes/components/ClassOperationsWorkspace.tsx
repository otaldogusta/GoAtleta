import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TrainingPlan } from "../../../core/models";
import { COPILOT_FAB_RIGHT, COPILOT_FAB_SIZE, resolveCopilotCompanionFabBottom } from "../../../copilot/components/CopilotFab";
import { radius, spacing } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useContainerResponsiveLayout } from "../../../ui/use-container-responsive-layout";
import { CLASS_PLAN_BLOCK_PRESENTATION } from "./class-plan-block-presentation";
import { ClassLessonDateNavigator } from "./ClassLessonDateNavigator";

const COMFORTABLE_CLASS_WORKSPACE_WIDTH = 1160;

export function resolveDenseClassWorkspace(width: number, compact: boolean) {
  return !compact && width < COMFORTABLE_CLASS_WORKSPACE_WIDTH;
}

type WorkspaceAction = {
  key: string;
  label: string;
  description: string;
  icon: GoAtletaIconName;
  onPress: () => void;
};

export type ClassWorkspaceSection = "overview" | "attendance";

export type ClassOperationalStatus = {
  state: "loading" | "pending" | "completed" | "unavailable";
  label: string;
  detail: string;
};

export type ClassRecentTrainingSummary = {
  id: string;
  dateKey: string;
  dateLabel: string;
  title: string;
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
  onOpenLessonCalendar: () => void;
  onViewPlan: () => void;
  onGeneratePlan: () => void;
  isGeneratingPlan: boolean;
  attendanceContent?: ReactNode | ((options: { dense: boolean }) => ReactNode);
  activeSection?: ClassWorkspaceSection;
  onSelectSection?: (section: ClassWorkspaceSection) => void;
  attendanceStatus: ClassOperationalStatus;
  reportStatus: ClassOperationalStatus;
  recentTrainings: ClassRecentTrainingSummary[] | null;
  onOpenSession: () => void;
  onOpenAttendance: () => void;
  onOpenReport: () => void;
  onOpenRecentTraining: (dateKey: string) => void;
  onOpenPlanning: () => void;
  onOpenVisualTech: () => void;
  onOpenScouting: () => void;
  onOpenStudents: () => void;
  onExportRoster: () => void;
  onOpenWhatsApp: () => void;
  compactNavigationOpen?: boolean;
  onCompactNavigationOpenChange?: (open: boolean) => void;
  showCompactNavigationFab?: boolean;
};

type ClassContextStripProps = {
  colors: ThemeColors;
  compact: boolean;
  mobile?: boolean;
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
      <GoAtletaIcon name={icon} size={compact ? 16 : 18} color={colors.muted} />
      <Text
        numberOfLines={compact ? 2 : 1}
        style={[styles.contextLabel, compact ? styles.contextLabelCompact : null, { color: colors.text }]}
      >
        {label}
      </Text>
    </View>
  );
}

export const ClassContextStrip = memo(function ClassContextStrip({
  colors,
  compact,
  mobile = false,
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
        mobile ? styles.contextStripMobile : null,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <ContextItem icon="organization" label={unitLabel} colors={colors} compact={compact} />
      <ContextItem icon="time" label={scheduleLabel} colors={colors} compact={compact} />
      <ContextItem
        icon="students"
        label={studentCount === null ? "Ativos: —" : `${studentCount} ${studentCount === 1 ? "ativo" : "ativos"}`}
        colors={colors}
        compact={compact}
      />
      <ContextItem
        icon="calendar"
        label={compact ? nextClassLabel : `Próxima aula: ${nextClassLabel}`}
        colors={colors}
        compact={compact}
      />
    </View>
  );
});

function RailAction({ action, colors, selected = false, dense = false, onSelect }: {
  action: WorkspaceAction;
  colors: ThemeColors;
  selected?: boolean;
  dense?: boolean;
  onSelect?: (action: WorkspaceAction) => void;
}) {
  return (
    <Pressable
      onPress={onSelect ? () => onSelect(action) : action.onPress}
      style={({ pressed }) => [
        styles.railAction,
        dense ? styles.railActionDense : null,
        selected ? { backgroundColor: colors.successBg } : null,
        { opacity: pressed ? 0.72 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={action.label}
    >
      <GoAtletaIcon
        name={action.icon}
        size={dense ? 16 : 18}
        color={selected ? colors.successText : colors.muted}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.railActionLabel,
          dense ? styles.railActionLabelDense : null,
          { color: selected ? colors.successText : colors.text },
        ]}
      >
        {action.label}
      </Text>
      {selected ? <View style={[styles.selectedDot, { backgroundColor: colors.primaryBg }]} /> : null}
    </Pressable>
  );
}

function RailSection({ title, actions, colors, dense = false, onSelect }: {
  title: string;
  actions: WorkspaceAction[];
  colors: ThemeColors;
  dense?: boolean;
  onSelect?: (action: WorkspaceAction) => void;
}) {
  return (
    <View style={[styles.railSection, dense ? styles.railSectionDense : null]}>
      <Text style={[styles.railSectionTitle, dense ? styles.railSectionTitleDense : null, { color: colors.muted }]}>{title}</Text>
      <View style={[styles.railDivider, dense ? styles.railDividerDense : null, { backgroundColor: colors.border }]} />
      {actions.map((action) => (
        <RailAction key={action.key} action={action} colors={colors} dense={dense} onSelect={onSelect} />
      ))}
    </View>
  );
}

function CompactClassNavigation({
  visible,
  onClose,
  actions,
  colors,
  onSelect,
  activeSection,
}: {
  visible: boolean;
  onClose: () => void;
  actions: Record<string, WorkspaceAction>;
  colors: ThemeColors;
  onSelect: (action: WorkspaceAction) => void;
  activeSection: ClassWorkspaceSection;
}) {
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      cardStyle={[
        styles.compactNavigationSheet,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      position="bottom"
      containerPadding={0}
    >
      <View style={[styles.compactNavigationHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.compactNavigationHeading}>
          <Text style={[styles.compactNavigationTitle, { color: colors.text }]}>Menu da turma</Text>
          <Text style={[styles.compactNavigationSubtitle, { color: colors.muted }]}>
            Acesse todas as áreas desta turma
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar menu da turma"
          style={({ pressed }) => [
            styles.compactNavigationClose,
            {
              backgroundColor: colors.secondaryBg,
              borderColor: colors.border,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <GoAtletaIcon name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.compactNavigationScroll}
        contentContainerStyle={styles.compactNavigationContent}
        showsVerticalScrollIndicator
      >
        <Text style={[styles.railHeading, { color: colors.muted }]}>Hoje</Text>
        <RailAction action={actions.overview} colors={colors} selected={activeSection === "overview"} onSelect={onSelect} />
        <RailAction action={actions.attendance} colors={colors} selected={activeSection === "attendance"} onSelect={onSelect} />
        <RailAction action={actions.report} colors={colors} onSelect={onSelect} />
        <RailSection
          title="Planejamento"
          actions={[actions.planning, actions.visual]}
          colors={colors}
          onSelect={onSelect}
        />
        <RailSection
          title="Desempenho"
          actions={[actions.scouting]}
          colors={colors}
          onSelect={onSelect}
        />
        <RailSection
          title="Gestão"
          actions={[actions.students, actions.export, actions.whatsapp]}
          colors={colors}
          onSelect={onSelect}
        />
      </ScrollView>
    </ModalSheet>
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

function OperationalStatusRow({
  title,
  status,
  colors,
  onPress,
}: {
  title: string;
  status: ClassOperationalStatus;
  colors: ThemeColors;
  onPress: () => void;
}) {
  const completed = status.state === "completed";
  const pending = status.state === "pending";
  const statusColor = completed ? colors.successText : pending ? colors.warningText : colors.muted;
  const statusBackground = completed ? colors.successBg : pending ? colors.warningBg : colors.secondaryBg;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${title.toLocaleLowerCase("pt-BR")}: ${status.label}`}
      style={({ pressed }) => [styles.operationalStatusRow, { opacity: pressed ? 0.76 : 1 }]}
    >
      <GoAtletaIcon
        name={completed ? "checkmarkCircle" : pending ? "warningCircle" : "time"}
        size={19}
        color={statusColor}
      />
      <View style={styles.operationalStatusCopy}>
        <Text style={[styles.operationalStatusTitle, { color: colors.text }]}>{title}</Text>
        <Text numberOfLines={2} style={[styles.operationalStatusDetail, { color: colors.muted }]}>
          {status.detail}
        </Text>
      </View>
      <View style={[styles.operationalStatusBadge, { backgroundColor: statusBackground }]}>
        <Text style={[styles.operationalStatusBadgeLabel, { color: statusColor }]}>{status.label}</Text>
      </View>
      <GoAtletaIcon name="chevronRight" size={16} color={colors.muted} />
    </Pressable>
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
  onOpenLessonCalendar,
  onViewPlan,
  onGeneratePlan,
  isGeneratingPlan,
  attendanceContent,
  activeSection = "overview",
  onSelectSection,
  attendanceStatus,
  reportStatus,
  recentTrainings,
  onOpenSession,
  onOpenAttendance,
  onOpenReport,
  onOpenRecentTraining,
  onOpenPlanning,
  onOpenVisualTech,
  onOpenScouting,
  onOpenStudents,
  onExportRoster,
  onOpenWhatsApp,
  compactNavigationOpen,
  onCompactNavigationOpenChange,
  showCompactNavigationFab = true,
}: ClassOperationsWorkspaceProps) {
  const insets = useSafeAreaInsets();
  const lessonContentAnim = useRef(new Animated.Value(1)).current;
  const [internalCompactNavigationOpen, setInternalCompactNavigationOpen] = useState(false);
  const isCompactNavigationOpen = compactNavigationOpen ?? internalCompactNavigationOpen;
  const setIsCompactNavigationOpen = useCallback((open: boolean) => {
    if (compactNavigationOpen === undefined) {
      setInternalCompactNavigationOpen(open);
    }
    onCompactNavigationOpenChange?.(open);
  }, [compactNavigationOpen, onCompactNavigationOpenChange]);
  const compactNavigationBottom = resolveCopilotCompanionFabBottom(insets.bottom);
  const { containerRef, onLayout, width: workspaceWidth } = useContainerResponsiveLayout("dashboard");
  const dense = resolveDenseClassWorkspace(workspaceWidth, compact);

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

  useEffect(() => {
    if (!compact) {
      setIsCompactNavigationOpen(false);
    }
  }, [compact, setIsCompactNavigationOpen]);

  const actions = useMemo<Record<string, WorkspaceAction>>(() => ({
    overview: {
      key: "overview",
      label: "Visão geral",
      description: "Resumo operacional da turma",
      icon: "dashboard",
      onPress: onSelectSection ? () => onSelectSection("overview") : () => undefined,
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
      onPress: onSelectSection ? () => onSelectSection("attendance") : onOpenAttendance,
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
      icon: "calendar",
      onPress: onOpenPlanning,
    },
    visual: {
      key: "visual",
      label: "Quadra visual",
      description: "Rodízio, movimentação e desenho técnico",
      icon: "map",
      onPress: onOpenVisualTech,
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
      label: "Exportar chamada",
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
    onSelectSection,
    onOpenAttendance,
    onOpenPlanning,
    onOpenReport,
    onOpenScouting,
    onOpenSession,
    onOpenStudents,
    onOpenVisualTech,
    onOpenWhatsApp,
  ]);

  const closeCompactNavigation = useCallback(() => {
    setIsCompactNavigationOpen(false);
  }, [setIsCompactNavigationOpen]);

  const handleCompactNavigationAction = useCallback((action: WorkspaceAction) => {
    setIsCompactNavigationOpen(false);
    action.onPress();
  }, [setIsCompactNavigationOpen]);

  const isAttendanceSection = activeSection === "attendance" && attendanceContent;
  const resolvedAttendanceContent = typeof attendanceContent === "function"
    ? attendanceContent({ dense })
    : attendanceContent;

  const planSection = (
    <View style={styles.planSection}>
      <ClassLessonDateNavigator
        colors={colors}
        dateLabel={lessonDateLabel}
        onPrevious={onPreviousLesson}
        onNext={onNextLesson}
        onOpenCalendar={onOpenLessonCalendar}
        disabled={isLoadingLessonPlan}
        isLoading={isLoadingLessonPlan}
        calendarAccessibilityHint="Abre o calendário de aulas"
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
              <Pressable
                onPress={onOpenPlanning}
                accessibilityRole="button"
                accessibilityLabel="Ver planejamento"
                style={({ pressed }) => [
                  styles.planSecondaryButton,
                  styles.planAppliedAction,
                  {
                    backgroundColor: colors.secondaryBg,
                    borderColor: colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={[styles.planSecondaryButtonLabel, { color: colors.text }]}>
                  Ver planejamento
                </Text>
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
            <Text style={[styles.emptyPlanDescription, { color: colors.muted }]}>Monte e revise o plano desta aula no próprio PDF.</Text>
            <View style={styles.emptyPlanActions}>
              <Pressable
                onPress={onGeneratePlan}
                disabled={isGeneratingPlan}
                accessibilityRole="button"
                accessibilityLabel="Montar plano"
                style={({ pressed }) => [styles.planPrimaryButton, styles.emptyPlanAction, { backgroundColor: colors.primaryBg, opacity: isGeneratingPlan ? 0.55 : pressed ? 0.8 : 1 }]}
              >
                <GoAtletaIcon name="document" size={16} color={colors.primaryText} />
                <Text style={[styles.planPrimaryButtonLabel, { color: colors.primaryText }]}>Montar plano</Text>
              </Pressable>
            </View>
          </View>
        )}
          </Animated.View>
        )}
      </View>
      <View style={[styles.operationalSummary, { borderColor: colors.border }]}>
        <Text style={[styles.operationalSummaryTitle, { color: colors.text }]}>Operação da aula</Text>
        <OperationalStatusRow
          title="Chamada"
          status={attendanceStatus}
          colors={colors}
          onPress={actions.attendance.onPress}
        />
        <OperationalStatusRow
          title="Relatório"
          status={reportStatus}
          colors={colors}
          onPress={actions.report.onPress}
        />

        <View style={[styles.recentTrainings, { borderTopColor: colors.border }]}>
          <Text style={[styles.recentTrainingsTitle, { color: colors.text }]}>Últimos treinos</Text>
          {recentTrainings === null ? (
            <View style={styles.recentTrainingsLoading} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.primaryBg} />
              <Text style={[styles.recentTrainingEmpty, { color: colors.muted }]}>Carregando histórico</Text>
            </View>
          ) : recentTrainings.length ? (
            recentTrainings.map((training) => (
              <Pressable
                key={training.id}
                onPress={() => onOpenRecentTraining(training.dateKey)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir treino de ${training.dateLabel}`}
                style={({ pressed }) => [styles.recentTrainingRow, { opacity: pressed ? 0.76 : 1 }]}
              >
                <GoAtletaIcon name="training" size={17} color={colors.muted} />
                <View style={styles.recentTrainingCopy}>
                  <Text numberOfLines={1} style={[styles.recentTrainingTitle, { color: colors.text }]}>
                    {training.title}
                  </Text>
                  <Text style={[styles.recentTrainingDate, { color: colors.muted }]}>{training.dateLabel}</Text>
                </View>
                <GoAtletaIcon name="chevronRight" size={16} color={colors.muted} />
              </Pressable>
            ))
          ) : (
            <Text style={[styles.recentTrainingEmpty, { color: colors.muted }]}>Nenhum treino registrado.</Text>
          )}
        </View>
      </View>
    </View>
  );

  const compactNavigationFab = compact && showCompactNavigationFab && !isCompactNavigationOpen ? (
    <Pressable
      onPress={() => setIsCompactNavigationOpen(true)}
      accessibilityRole="button"
      accessibilityLabel="Abrir menu da turma"
      style={({ pressed }) => [
        styles.compactNavigationFab,
        Platform.OS === "web"
          ? ({ position: "fixed", right: COPILOT_FAB_RIGHT, bottom: compactNavigationBottom } as any)
          : { position: "absolute", right: COPILOT_FAB_RIGHT, bottom: compactNavigationBottom },
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <GoAtletaIcon name="list" size={24} color={colors.primaryBg} />
    </Pressable>
  ) : null;

  const compactNavigationFabPortal =
    Platform.OS === "web" && compactNavigationFab && typeof document !== "undefined"
      ? require("react-dom").createPortal(compactNavigationFab, document.body)
      : null;

  return (
    <>
      {compactNavigationFabPortal}
      <View
        ref={containerRef}
        onLayout={onLayout}
        style={[
          styles.workspace,
          compact ? styles.workspaceCompact : null,
          dense ? styles.workspaceDense : null,
        ]}
      >
        {!compact ? (
          <View style={[styles.rail, dense ? styles.railDense : null, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.railHeading, dense ? styles.railHeadingDense : null, { color: colors.muted }]}>Hoje</Text>
            <RailAction action={actions.overview} colors={colors} dense={dense} selected={activeSection === "overview"} />
            <RailAction action={actions.attendance} colors={colors} dense={dense} selected={activeSection === "attendance"} />
            <RailAction action={actions.report} colors={colors} dense={dense} />
            <RailSection
              title="Planejamento"
              actions={[actions.planning, actions.visual]}
              colors={colors}
              dense={dense}
            />
            <RailSection title="Desempenho" actions={[actions.scouting]} colors={colors} dense={dense} />
            <RailSection
              title="Gestão"
              actions={[actions.students, actions.export, actions.whatsapp]}
              colors={colors}
              dense={dense}
            />
          </View>
        ) : null}

        <View style={[styles.mainColumn, dense ? styles.mainColumnDense : null]}>
          {Platform.OS === "web" ? null : compactNavigationFab}

          {isAttendanceSection ? (
            resolvedAttendanceContent
          ) : compact ? (
            planSection
          ) : (
            <View style={styles.desktopWorkspace}>
              <View style={styles.desktopContentColumn}>
                {planSection}
              </View>
            </View>
          )}
        </View>
      </View>

      {compact ? (
        <CompactClassNavigation
          visible={isCompactNavigationOpen}
          onClose={closeCompactNavigation}
          actions={actions}
          colors={colors}
          onSelect={handleCompactNavigationAction}
          activeSection={activeSection}
        />
      ) : null}
    </>
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
    minHeight: 76,
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 6,
    columnGap: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  contextStripMobile: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    rowGap: 0,
    columnGap: 8,
    borderRadius: 12,
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
    flexGrow: 1,
    flexBasis: "44%",
    minWidth: 0,
    justifyContent: "flex-start",
    gap: 6,
  },
  contextLabel: {
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
  },
  contextLabelCompact: {
    fontSize: 12,
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
  workspaceDense: {
    gap: 12,
  },
  compactNavigationFab: {
    width: COPILOT_FAB_SIZE,
    height: COPILOT_FAB_SIZE,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5100,
  },
  compactNavigationSheet: {
    maxHeight: "78%",
    marginHorizontal: 8,
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  compactNavigationHeader: {
    minHeight: 72,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  compactNavigationHeading: {
    flex: 1,
    minWidth: 0,
  },
  compactNavigationTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  compactNavigationSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  compactNavigationClose: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  compactNavigationScroll: {
    flexGrow: 0,
  },
  compactNavigationContent: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: 4,
  },
  rail: {
    width: 268,
    borderWidth: 1,
    borderRadius: 18,
    padding: 12,
    gap: 8,
    flexShrink: 0,
  },
  railDense: {
    width: 222,
    padding: 10,
    gap: 4,
  },
  railHeading: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingTop: 4,
  },
  railHeadingDense: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingTop: 2,
  },
  railSection: {
    gap: 3,
    marginTop: 10,
  },
  railSectionDense: {
    gap: 2,
    marginTop: 6,
  },
  railSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
  },
  railSectionTitleDense: {
    fontSize: 11,
    paddingHorizontal: 8,
  },
  railDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
    marginBottom: 2,
  },
  railDividerDense: {
    marginHorizontal: 8,
  },
  railAction: {
    minHeight: 42,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  railActionDense: {
    minHeight: 36,
    paddingHorizontal: 8,
    gap: 8,
  },
  railActionLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: "600",
  },
  railActionLabelDense: {
    fontSize: 12,
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
  mainColumnDense: {
    gap: 14,
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
  operationalSummary: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  operationalSummaryTitle: {
    paddingHorizontal: 2,
    paddingBottom: 4,
    fontSize: 15,
    fontWeight: "800",
  },
  operationalStatusRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 7,
    paddingHorizontal: 2,
  },
  operationalStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  operationalStatusTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  operationalStatusDetail: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 15,
  },
  operationalStatusBadge: {
    minHeight: 26,
    borderRadius: radius.full,
    justifyContent: "center",
    paddingHorizontal: 9,
  },
  operationalStatusBadgeLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  recentTrainings: {
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  recentTrainingsTitle: {
    paddingHorizontal: 2,
    paddingBottom: 3,
    fontSize: 13,
    fontWeight: "800",
  },
  recentTrainingsLoading: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 2,
  },
  recentTrainingRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 2,
    paddingVertical: 6,
  },
  recentTrainingCopy: {
    flex: 1,
    minWidth: 0,
  },
  recentTrainingTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  recentTrainingDate: {
    marginTop: 2,
    fontSize: 11,
  },
  recentTrainingEmpty: {
    minHeight: 40,
    paddingHorizontal: 2,
    paddingVertical: 10,
    fontSize: 12,
  },
});
