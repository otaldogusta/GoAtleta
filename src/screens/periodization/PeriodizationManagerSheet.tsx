import { PlanningAssistantHost, usePlanningAssistant } from "./PlanningAssistant";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ScrollView,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type View as ViewType,
  type ViewStyle,
} from "react-native";

import type { ThemeColors } from "../../ui/app-theme";
import { useClassDiagnostic } from "../../assistant/hooks/useClassDiagnostic";
import { profileDiagnosticValues } from "../../core/profile-planning";
import {
  PERIODIZATION_GAME_LEVELS,
  type PeriodizationGameLevel,
} from "../../core/periodization-policy";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import {
  PeriodizationLoadCurve,
  type PeriodizationGraphWeek,
} from "./components/PeriodizationLoadCurve";
import { CourtFormatGlyph, PeriodizationCourtLevelDiagram } from "./components/PeriodizationCourtLevelDiagram";
import { PeriodizationScheduleDays } from "./components/PeriodizationScheduleDays";
import { getCourtDimensionsLabel } from "./components/periodization-court-geometry";

function ManagerSelect<T extends string | number>({ value, options, colors, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; colors: ThemeColors; onChange: (value: T) => void; label: string }) {
  const triggerRef = useRef<ViewType | null>(null);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const activeLabel = options.find((option) => option.value === value)?.label ?? String(value);
  const toggle = () => {
    if (open) return setOpen(false);
    triggerRef.current?.measureInWindow((x, y, width, height) => { setLayout({ x, y, width, height }); setOpen(true); });
  };
  return <>
    <View ref={triggerRef}><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={toggle} style={{ minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.inputBg, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{activeLabel}</Text><GoAtletaIcon name={open ? "chevronUp" : "chevronDown"} size={15} color={colors.muted} /></Pressable></View>
    <AnchoredDropdown
      visible={open}
      layout={layout}
      container={null}
      animationStyle={{}}
      zIndex={9200}
      maxHeight={180}
      nestedScrollEnabled={false}
      showVerticalScrollIndicator
      portalToBodyOnWeb
      onRequestClose={() => setOpen(false)}
      interactiveRefs={[triggerRef]}
      density="compact"
      fitContent
    >
      {options.map((option) => (
        <AnchoredDropdownOption
          key={String(option.value)}
          active={option.value === value}
          density="compact"
          style={{ minHeight: 38, justifyContent: "center", paddingHorizontal: 12 }}
          onPress={() => {
            onChange(option.value);
            setOpen(false);
          }}
        >
          <Text
            style={{
              color: option.value === value ? colors.primaryText : colors.text,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {option.label}
          </Text>
        </AnchoredDropdownOption>
      ))}
    </AnchoredDropdown>
  </>;
}

export type PeriodizationManagerDraft = {
  goal: string;
  mvLevel: string;
  daysOfWeek: number[];
  startTime: string;
  durationMinutes: number;
  cycleStartDate: string;
  cycleLengthWeeks: number;
  loadModel: "ondulatorio" | "linear" | "blocos";
  recoveryWeeks: number;
  intensityMin: number;
  intensityMax: number;
  gameLevel: PeriodizationGameLevel;
  netHeightMeters: number;
  teacherContext: string;
};

export type PeriodizationManagerSection =
  | "cycle"
  | "agenda"
  | "class"
  | "exceptions";

type Props = {
  competitionContext?: string;
  visible: boolean;
  mode?: "manage" | "create-next";
  initialView?: "settings" | "diagnostic";
  colors: ThemeColors;
  className: string;
  classSubtitle: string;
  classId: string;
  organizationId: string;
  sport: string;
  initialDraft: PeriodizationManagerDraft;
  weekPlans: PeriodizationGraphWeek[];
  autoPlanCount: number;
  manualPlanCount: number;
  completedLessonCount: number;
  currentWeek: number;
  configured: boolean;
  active: boolean;
  saving: boolean;
  regenerating: boolean;
  error: string;
  advancedContent?: ReactNode;
  onClose: () => void;
  onSave: (draft: PeriodizationManagerDraft) => Promise<boolean>;
  onRegenerateAutomatic: () => void;
  onDuplicate: () => void;
  onResetAutomatic: () => void;
  onArchiveCycle: () => void;
};

function ManagerBody({
  split,
  children,
}: {
  split: boolean;
  children: ReactNode;
}) {
  if (split) {
    return (
      <View
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          flexDirection: "row",
          alignItems: "stretch",
        }}
      >
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      contentContainerStyle={{
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        flexDirection: "column",
        alignItems: "stretch",
      }}
      style={{ flex: 1, minHeight: 0 }}
    >
      {children}
    </ScrollView>
  );
}

function ManagerPane({
  scrollable,
  containerStyle,
  contentStyle,
  children,
}: {
  scrollable: boolean;
  containerStyle: StyleProp<ViewStyle>;
  contentStyle: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (scrollable) {
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator
        style={[{ minHeight: 0, minWidth: 0 }, containerStyle]}
        contentContainerStyle={contentStyle}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={[containerStyle, contentStyle]}>{children}</View>;
}

const DAY_OPTIONS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
] as const;

const LEVEL_OPTIONS = [
  { value: "MV1", label: "Iniciação" },
  { value: "MV2", label: "Formação" },
  { value: "MV3", label: "Rendimento" },
] as const;

const CYCLE_OPTIONS = [
  { value: 13, label: "Trimestral", detail: "3 meses" },
  { value: 26, label: "Semestral", detail: "6 meses" },
  { value: 39, label: "Nove meses", detail: "9 meses" },
  { value: 52, label: "Anual", detail: "12 meses" },
] as const;
const LOAD_MODEL_OPTIONS = [
  { value: "ondulatorio", label: "Ondulatório" },
  { value: "linear", label: "Linear" },
  { value: "blocos", label: "Blocos" },
] as const;
const RECOVERY_OPTIONS = [3, 4, 5] as const;
const MANAGER_STEPS = [
  "Turma",
  "Nível da turma",
  "Agenda",
  "Modelo de carga",
  "Competição e pausas",
  "Revisão",
] as const;
const MANAGER_STEP_TITLES = [
  "Dados da turma",
  "Selecione o nível da turma",
  "Organize a agenda",
  "Defina o modelo de carga",
  "Competição e pausas",
  "Revise a periodização",
] as const;

function formatBrazilianDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function parseBrazilianDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
  if (digits.length !== 8) return { display: formatted, iso: "" };
  return { display: formatted, iso: `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}` };
}

function draftsEqual(
  first: PeriodizationManagerDraft,
  second: PeriodizationManagerDraft,
) {
  if (!first || !second) return false;
  return (
    String(first.goal ?? "").trim() === String(second.goal ?? "").trim() &&
    first.mvLevel === second.mvLevel &&
    first.startTime === second.startTime &&
    first.durationMinutes === second.durationMinutes &&
    first.cycleStartDate === second.cycleStartDate &&
    first.cycleLengthWeeks === second.cycleLengthWeeks &&
    first.loadModel === second.loadModel &&
    first.recoveryWeeks === second.recoveryWeeks &&
    first.intensityMin === second.intensityMin &&
    first.intensityMax === second.intensityMax &&
    first.gameLevel === second.gameLevel &&
    first.netHeightMeters === second.netHeightMeters &&
    first.teacherContext.trim() === second.teacherContext.trim() &&
    [...(first.daysOfWeek ?? [])].sort().join(",") ===
      [...(second.daysOfWeek ?? [])].sort().join(",")
  );
}

function InputLabel({
  colors,
  children,
}: {
  colors: ThemeColors;
  children: ReactNode;
}) {
  return (
    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
      {children}
    </Text>
  );
}

function PseStepper({
  colors,
  label,
  value,
  min,
  max,
  onChange,
}: {
  colors: ThemeColors;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const decreaseDisabled = value <= min;
  const increaseDisabled = value >= max;
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <InputLabel colors={colors}>{label}</InputLabel>
      <View
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "stretch",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.inputBg,
          overflow: "hidden",
        }}
      >
        <Text
          accessibilityLabel={`${label}: ${value}`}
          style={{
            flex: 1,
            alignSelf: "center",
            color: colors.text,
            paddingHorizontal: 12,
            fontSize: 14,
            fontWeight: "800",
          }}
        >
          {value}
        </Text>
        <View style={{ width: 38, borderLeftWidth: 1, borderLeftColor: colors.border }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Aumentar ${label.toLocaleLowerCase("pt-BR")}`}
            accessibilityState={{ disabled: increaseDisabled }}
            disabled={increaseDisabled}
            onPress={() => onChange(Math.min(max, value + 1))}
            style={({ hovered, pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent",
              opacity: increaseDisabled ? 0.35 : 1,
            })}
          >
            <GoAtletaIcon name="chevronUp" size={14} color={colors.text} />
          </Pressable>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Diminuir ${label.toLocaleLowerCase("pt-BR")}`}
            accessibilityState={{ disabled: decreaseDisabled }}
            disabled={decreaseDisabled}
            onPress={() => onChange(Math.max(min, value - 1))}
            style={({ hovered, pressed }) => ({
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent",
              opacity: decreaseDisabled ? 0.35 : 1,
            })}
          >
            <GoAtletaIcon name="chevronDown" size={14} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ImpactRow({
  colors,
  icon,
  label,
  value,
  complete,
  showStatus = true,
}: {
  colors: ThemeColors;
  icon: "calendar" | "trend" | "refresh" | "students" | "checkmarkCircle" | "periodization";
  label: string;
  value: string;
  complete: boolean;
  showStatus?: boolean;
}) {
  return (
    <View
      style={{
        minHeight: 46,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <GoAtletaIcon name={icon} size={17} color={colors.muted} />
      <Text
        style={{
          flex: 1,
          color: colors.text,
          fontSize: 12,
          fontWeight: "700",
        }}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          maxWidth: "52%",
          color: colors.muted,
          fontSize: 11,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
      {showStatus ? (
        <GoAtletaIcon
          name={complete ? "checkmarkCircle" : "circleOutline"}
          size={16}
          color={complete ? colors.successText : colors.muted}
        />
      ) : null}
    </View>
  );
}


type DiagnosticChat = ReturnType<typeof useClassDiagnostic>;

function PeriodizationDiagnosticStep({
  colors,
  compact,
  dense,
  className,
  sport,
  draft,
  baseline,
  onChange,
  chat,
}: {
  colors: ThemeColors;
  compact: boolean;
  dense: boolean;
  className: string;
  sport: string;
  draft: PeriodizationManagerDraft;
  baseline: PeriodizationManagerDraft;
  onChange: (changes: Partial<PeriodizationManagerDraft>) => void;
  chat: DiagnosticChat;
}) {

  const profile = chat.snapshot?.profile;
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => {
    if (!profile) return;
    onChangeRef.current(profileDiagnosticValues(profile.profile, baseline));
  }, [profile, baseline]);

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View
        style={{
          flex: 1,
          minHeight: 0,
          flexDirection: compact ? "column" : "row",
        }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ flex: compact ? undefined : 2.25, minHeight: 0 }}
          contentContainerStyle={{ padding: compact ? 14 : dense ? 16 : 26, gap: dense ? 10 : 16 }}
        >
          <View
            style={{
              height: compact ? 210 : dense ? 300 : 330,
              borderRadius: 14,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "#1676ac",
            }}
          >
            <PeriodizationCourtLevelDiagram level={draft.gameLevel} />
          </View>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: compact ? "wrap" : "nowrap" }}>
            {PERIODIZATION_GAME_LEVELS.map((option) => {
              const active = option.value === draft.gameLevel;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}, ${getCourtDimensionsLabel(option.value)} no total${option.value === "1x1" ? ", 3 por 3 metros por lado" : ""}`}
                  accessibilityState={{ selected: active }}
                  disabled={chat.busy || chat.loading || !!chat.pending}
                  onPress={() => {
                    if (!active) void chat.command({ action: "selectors", gameFormat: option.value, netHeight: option.defaultNetHeightMeters });
                  }}
                  style={({ hovered, pressed }) => ({
                    minHeight: dense ? 64 : 84,
                    minWidth: compact ? "30%" : 0,
                    flex: compact ? undefined : 1,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: dense ? 3 : 5,
                    borderWidth: 1,
                    borderColor: active ? colors.successBorder : colors.border,
                    borderRadius: 11,
                    backgroundColor: active
                      ? colors.successBg
                      : hovered || pressed
                        ? colors.secondaryBg
                        : colors.inputBg,
                    paddingHorizontal: 8,
                  })}
                >
                  <CourtFormatGlyph
                    level={option.value}
                    color={active ? colors.successText : colors.muted}
                  />
                  <Text style={{ color: active ? colors.successText : colors.text, fontSize: 15, fontWeight: "800" }}>
                    {option.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>
                    {getCourtDimensionsLabel(option.value)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
              Altura da rede
            </Text>
            <ManagerSelect
              label="Altura da rede"
              value={draft.netHeightMeters}
              options={[1.8, 2, 2.1, 2.15, 2.2, 2.24, 2.3, 2.43].map((value) => ({
                value,
                label: `${value.toFixed(2).replace(".", ",")} m`,
              }))}
              colors={colors}
              onChange={(netHeightMeters) => { if (!chat.busy && !chat.loading && !chat.pending) void chat.command({ action: "selectors", netHeight: netHeightMeters }); }}
            />
          </View>
        </ScrollView>

      </View>

    </View>
  );
}

export function PeriodizationManagerSheet({
  competitionContext = "Competição e pausas não informadas.",
  visible,
  mode = "manage",
  initialView = "settings",
  colors,
  className,
  classSubtitle,
  classId,
  organizationId,
  sport,
  initialDraft,
  weekPlans,
  autoPlanCount,
  manualPlanCount,
  completedLessonCount,
  currentWeek,
  configured,
  active,
  saving,
  regenerating,
  error,
  advancedContent,
  onClose,
  onSave,
  onRegenerateAutomatic,
  onDuplicate,
  onResetAutomatic,
  onArchiveCycle,
}: Props) {
  const { width, height } = useWindowDimensions();
  const menuTriggerRef = useRef<ViewType | null>(null);
  const [menuLayout, setMenuLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const compact = width < 760;
  const narrow = width < 980;
  const dense = height < 800;
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(initialView === "diagnostic" ? 2 : 1);
  const activeStep = Number.isInteger(Number(currentStep))
    ? Math.min(6, Math.max(1, Number(currentStep)))
    : 1;
  const showDiagnostic = activeStep === 2;
  const chat = useClassDiagnostic(organizationId, classId);
  const assistant = usePlanningAssistant();
  const setEditor = assistant?.setEditor;
  // Preserve the recorded conversation when moving from the former profile pane.
  // Further discussion uses the advisory controller; selectors retain their own commands.
  useEffect(() => {
    if (assistant && !assistant.chat.busy && !assistant.chat.messages.length && !chat.loading && chat.messages.length) {
      assistant.chat.restore({ messages: chat.messages, input: assistant.chat.input });
    }
  }, [assistant, chat.loading, chat.messages]);
  useEffect(() => { setEditor?.(visible ? { step: MANAGER_STEP_TITLES[activeStep - 1], draft: { ...draft, competitionContext } } : null); }, [setEditor, visible, activeStep, draft, competitionContext]);
  useEffect(() => () => setEditor?.(null), [setEditor]);
  // Keep the same frame while navigating; each step scrolls within its workspace.
  const desktopCardHeight = 620;
  const [cycleDateInput, setCycleDateInput] = useState(() => formatBrazilianDate(initialDraft.cycleStartDate));
  const wasVisibleRef = useRef(false);
  const creatingNextCycle = mode === "create-next";
  const dirty = !draftsEqual(draft, savedDraft);
  const saveDisabled = saving || (!creatingNextCycle && !dirty);
  const dayLabel = DAY_OPTIONS.filter((option) =>
    draft.daysOfWeek.includes(option.value),
  )
    .map((option) => option.label)
    .join(", ");
  const timeEndMinutes =
    Number(draft.startTime.slice(0, 2)) * 60 +
    Number(draft.startTime.slice(3, 5)) +
    draft.durationMinutes;
  const timeEnd = Number.isFinite(timeEndMinutes)
    ? `${String(Math.floor((timeEndMinutes % 1440) / 60)).padStart(2, "0")}:${String(timeEndMinutes % 60).padStart(2, "0")}`
    : "";
  const recommendedRecoveryWeeks = draft.intensityMax >= 8 ? 3 : draft.intensityMax >= 6 ? 4 : 5;
  const classParametersComplete =
    Boolean(draft.goal.trim()) && ["MV1", "MV2", "MV3"].includes(draft.mvLevel);
  const agendaParametersComplete =
    draft.daysOfWeek.length > 0 &&
    /^\d{2}:\d{2}$/.test(draft.startTime) &&
    draft.durationMinutes >= 15 &&
    draft.durationMinutes <= 300;
  const cycleParametersComplete =
    /^\d{4}-\d{2}-\d{2}$/.test(draft.cycleStartDate) &&
    CYCLE_OPTIONS.some((option) => option.value === draft.cycleLengthWeeks);
  const loadParametersComplete =
    LOAD_MODEL_OPTIONS.some((option) => option.value === draft.loadModel) &&
    RECOVERY_OPTIONS.includes(draft.recoveryWeeks as (typeof RECOVERY_OPTIONS)[number]) &&
    draft.intensityMin >= 1 &&
    draft.intensityMax <= 10 &&
    draft.intensityMin < draft.intensityMax;
  const setupGuidance = !classParametersComplete
    ? "Revise o objetivo e o nível da turma."
    : !agendaParametersComplete
      ? "Confirme os dias, o horário e a duração das aulas."
      : !cycleParametersComplete
        ? "Defina a data de início do ciclo para concluir a configuração."
        : !loadParametersComplete
          ? "Revise o modelo e os limites de carga."
          : "Revise os parâmetros sugeridos e salve para ativar a periodização.";

  useEffect(() => {
    const opening = visible && !wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (!opening) return;

    setDraft(initialDraft);
    setSavedDraft(initialDraft);
    setCycleDateInput(formatBrazilianDate(initialDraft.cycleStartDate));
    setMenuOpen(false);
    setCurrentStep(initialView === "diagnostic" ? 2 : 1);
  }, [initialDraft, initialView, visible]);

  const closeMenuThenRun = useCallback((action: () => void) => {
    setMenuOpen(false);
    setTimeout(action, 0);
  }, []);

  const handleSave = async () => {
    const saved = await onSave(draft);
    if (saved) setSavedDraft(draft);
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      containerPadding={compact ? 10 : 22}
      backdropOpacity={0.72}
      cardStyle={{
        alignSelf: "center",
        width: "100%",
        maxWidth: 960,
        height: compact ? "92%" : Math.min(height - 44, desktopCardHeight),
        maxHeight: compact ? "92%" : desktopCardHeight,
        minWidth: 0,
        borderRadius: compact ? 18 : 22,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        overflow: "hidden",
      }}
    >
      <View style={{ flex: 1, width: "100%", overflow: "hidden" }}>
        <View
          style={{
            minHeight: 64,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: compact ? 14 : 18,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <Text
                style={{
                  color: colors.text,
                  fontSize: compact ? 19 : 22,
                  fontWeight: "800",
                }}
              >
                {creatingNextCycle
                  ? "Criar próximo ciclo"
                  : MANAGER_STEP_TITLES[activeStep - 1]}
              </Text>
              {!showDiagnostic ? <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  borderWidth: 1,
                  borderColor: configured && active
                    ? colors.successBorder
                    : colors.warningBorder,
                  borderRadius: 999,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                }}
              >
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: configured && active
                      ? colors.successText
                      : colors.warningText,
                  }}
                />
                <Text
                  style={{
                    color: configured && active
                      ? colors.successText
                      : colors.warningText,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {creatingNextCycle
                    ? "Novo ciclo"
                    : !configured
                    ? "Configuração pendente"
                    : active
                      ? "Ciclo ativo"
                      : "Ciclo encerrado"}
                </Text>
              </View> : null}
            </View>
            <Text
              numberOfLines={1}
              style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}
            >
              Etapa {activeStep} de 6 · {className} · {classSubtitle}
            </Text>
          </View>

          <View
            ref={menuTriggerRef}
            style={{
              display: creatingNextCycle || showDiagnostic ? "none" : "flex",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mais ações da periodização"
              onPress={() => {
                if (menuOpen) {
                  setMenuOpen(false);
                  return;
                }
                menuTriggerRef.current?.measureInWindow((x, y, triggerWidth, triggerHeight) => {
                  const menuWidth = Math.min(260, Math.max(180, width - 32));
                  setMenuLayout({
                    x: x + triggerWidth - menuWidth,
                    y,
                    width: menuWidth,
                    height: triggerHeight,
                  });
                  setMenuOpen(true);
                });
              }}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <GoAtletaIcon
                name="ellipsisVertical"
                size={18}
                color={colors.text}
              />
            </Pressable>
          </View>
          <AnchoredDropdown
            visible={menuOpen && !creatingNextCycle && !showDiagnostic}
            layout={menuLayout}
            container={null}
            animationStyle={{}}
            zIndex={9400}
            maxHeight={126}
            nestedScrollEnabled={false}
            portalToBodyOnWeb
            density="menu"
            showVerticalScrollIndicator={false}
            interactiveRefs={[menuTriggerRef]}
            onRequestClose={() => setMenuOpen(false)}
            panelStyle={{ borderRadius: 12 }}
            scrollContentStyle={{ padding: 6, gap: 0 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Redefinir semanas automáticas"
              onPress={() => {
                closeMenuThenRun(onResetAutomatic);
              }}
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                borderRadius: 9,
                paddingHorizontal: 10,
              }}
            >
              <GoAtletaIcon name="trash" size={17} color={colors.dangerText} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: "700" }}>
                  Redefinir automáticos
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  Preserva planos personalizados
                </Text>
              </View>
            </Pressable>
            <View
              style={{
                height: 1,
                marginHorizontal: 8,
                marginVertical: 4,
                backgroundColor: colors.border,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Encerrar periodização ativa"
              disabled={!active || regenerating}
              onPress={() => {
                closeMenuThenRun(onArchiveCycle);
              }}
              style={{
                minHeight: 48,
                flexDirection: "row",
                alignItems: "center",
                gap: 9,
                borderRadius: 9,
                paddingHorizontal: 10,
                opacity: !active || regenerating ? 0.45 : 1,
              }}
            >
              <GoAtletaIcon name="trash" size={17} color={colors.dangerText} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: "700" }}>
                  Encerrar periodização
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>
                  Sai da operação e mantém o histórico
                </Text>
              </View>
            </Pressable>
          </AnchoredDropdown>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar gerenciamento"
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <GoAtletaIcon name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            gap: 6,
            paddingHorizontal: compact ? 14 : dense ? 18 : 28,
            paddingVertical: dense ? 7 : 10,
          }}
          style={{ flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          {MANAGER_STEPS.map((label, index) => {
            const step = index + 1;
            const selected = activeStep === step;
            return (
              <Pressable
                key={label}
                accessibilityRole="button"
                accessibilityLabel={`Etapa ${step}: ${label}`}
                accessibilityState={{ selected }}
                onPress={() => setCurrentStep(step)}
                style={{
                  minHeight: dense ? 32 : 36,
                  flex: compact ? undefined : 1,
                  minWidth: compact ? 118 : 0,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: selected ? colors.successBorder : colors.border,
                  backgroundColor: selected ? colors.successBg : "transparent",
                  paddingHorizontal: 10,
                }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.successText : colors.secondaryBg }}>
                  <Text style={{ color: selected ? colors.background : colors.muted, fontSize: 10, fontWeight: "800" }}>{step}</Text>
                </View>
                <Text numberOfLines={1} style={{ color: selected ? colors.successText : colors.muted, fontSize: 10, fontWeight: selected ? "800" : "700" }}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <PlanningAssistantHost colors={colors} surface="editor">
        <View style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {showDiagnostic ? (
          <PeriodizationDiagnosticStep
            chat={chat}
            colors={colors}
            compact={compact}
            dense={dense}
            className={className}
            sport={sport}
            draft={draft}
            baseline={initialDraft}
            onChange={(changes) => setDraft((current) => ({ ...current, ...changes }))}
          />
        ) : (
        <ManagerBody split={false}>
          <ManagerPane
            scrollable={false}
            containerStyle={{
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              display: activeStep === 6 ? "none" : "flex",
              borderRightWidth: 0,
              borderRightColor: colors.border,
            }}
            contentStyle={{
              padding: compact ? 14 : 18,
              gap: compact ? 16 : 22,
            }}
          >
            {creatingNextCycle && activeStep === 1 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.infoBg,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 9,
                }}
              >
                <GoAtletaIcon name="info" size={18} color={colors.infoText} />
                <Text
                  style={{
                    flex: 1,
                    color: colors.infoText,
                    fontSize: 11,
                    lineHeight: 16,
                  }}
                >
                  Agenda e parâmetros foram herdados. Revise a nova data, a
                  carga e a recuperação antes de criar.
                </Text>
              </View>
            ) : null}

            {activeStep === 1 ? <View style={{ gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                1. Turma
              </Text>
              <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                <View style={{ flex: 1.5, minWidth: 0, gap: 6 }}>
                  <InputLabel colors={colors}>Objetivo pedagógico</InputLabel>
                  <TextInput
                    accessibilityLabel="Objetivo pedagógico"
                    value={draft.goal}
                    onChangeText={(goal) =>
                      setDraft((current) => ({ ...current, goal }))
                    }
                    placeholder="Desenvolvimento motor e fundamentos"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: 12,
                      fontSize: 12,
                    }}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                  <InputLabel colors={colors}>Nível de desenvolvimento</InputLabel>
                  <ManagerSelect label="Nível de desenvolvimento" value={draft.mvLevel} options={LEVEL_OPTIONS} colors={colors} onChange={(mvLevel) => setDraft((current) => ({ ...current, mvLevel }))} />
                </View>
              </View>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                Idade e número de atletas vêm do cadastro da turma.
              </Text>
            </View> : null}

            {activeStep === 3 ? <View style={{ gap: 12 }}>
              <PeriodizationScheduleDays
                colors={colors}
                days={draft.daysOfWeek}
                startTime={draft.startTime}
                endTime={timeEnd}
                onDaysChange={(daysOfWeek) => setDraft(current => ({ ...current, daysOfWeek }))}
                onStartChange={(startTime) => setDraft(current => ({ ...current, startTime }))}
                onDurationChange={(durationMinutes) => setDraft(current => ({ ...current, durationMinutes }))}
              />
              <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Data de início</InputLabel>
                  <TextInput
                    accessibilityLabel="Data de início do ciclo"
                    value={cycleDateInput}
                    onChangeText={(value) => {
                      const parsed = parseBrazilianDate(value);
                      setCycleDateInput(parsed.display);
                      if (parsed.iso) setDraft((current) => ({ ...current, cycleStartDate: parsed.iso }));
                    }}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      minHeight: 44,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                      paddingHorizontal: 12,
                      fontSize: 12,
                    }}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Duração do ciclo</InputLabel>
                  <ManagerSelect label="Duração do ciclo" value={draft.cycleLengthWeeks} options={CYCLE_OPTIONS.map((option) => ({ value: option.value, label: `${option.label} · ${option.detail}` }))} colors={colors} onChange={(cycleLengthWeeks) => setDraft((current) => ({ ...current, cycleLengthWeeks }))} />
                </View>
              </View>
            </View> : null}

            {activeStep === 4 ? <View style={{ gap: 12 }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                  4. Modelo de carga
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10, marginTop: 3 }}>
                  Parâmetros calculados a partir do nível, da agenda e das semanas.
                </Text>
              </View>
              <View style={{ gap: 12 }}>
                <View style={{ gap: 6 }}>
                  <InputLabel colors={colors}>Modelo de carga</InputLabel>
                  <ManagerSelect label="Modelo de carga" value={draft.loadModel} options={LOAD_MODEL_OPTIONS} colors={colors} onChange={(loadModel) => setDraft((current) => ({ ...current, loadModel }))} />
                </View>
                <View style={{ gap: 6 }}>
                  <InputLabel colors={colors}>Recuperação planejada</InputLabel>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    {RECOVERY_OPTIONS.map((weeks) => { const active = draft.recoveryWeeks === weeks; return <Pressable key={weeks} accessibilityRole="button" accessibilityLabel={`Recuperação a cada ${weeks} semanas`} onPress={() => setDraft((current) => ({ ...current, recoveryWeeks: weeks }))} style={{ minHeight: 36, justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: active ? colors.successBorder : colors.border, backgroundColor: active ? colors.successBg : colors.inputBg, paddingHorizontal: 10 }}><Text style={{ color: active ? colors.successText : colors.text, fontSize: 11, fontWeight: "700" }}>A cada {weeks} semanas</Text></Pressable>; })}
                  </View>
                  <View style={{ borderWidth: 1, borderColor: colors.successBorder, backgroundColor: colors.successBg, borderRadius: 10, padding: 10, gap: 3 }}><Text style={{ color: colors.successText, fontSize: 10, fontWeight: "800" }}>Recuperação sugerida: a cada {recommendedRecoveryWeeks} semanas</Text><Text style={{ color: colors.muted, fontSize: 10 }}>Com PSE máximo {draft.intensityMax}, a prévia recomenda este intervalo. Se a carga registrada subir, antecipe a semana de recuperação.</Text></View>
                </View>
                <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                  <PseStepper
                    colors={colors}
                    label="PSE mínimo"
                    value={draft.intensityMin}
                    min={1}
                    max={Math.max(1, draft.intensityMax - 1)}
                    onChange={(intensityMin) => setDraft((current) => ({ ...current, intensityMin }))}
                  />
                  <PseStepper
                    colors={colors}
                    label="PSE máximo"
                    value={draft.intensityMax}
                    min={Math.min(10, draft.intensityMin + 1)}
                    max={10}
                    onChange={(intensityMax) => setDraft((current) => ({
                      ...current,
                      intensityMax,
                      recoveryWeeks: intensityMax >= 8 ? 3 : intensityMax >= 6 ? 4 : 5,
                    }))}
                  />
                </View>
              </View>
            </View> : null}

            {activeStep === 5 ? <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                5. Competição, pausas e disponibilidade
              </Text>
              {advancedContent}
            </View> : null}

            {compact && activeStep === 5 ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                  Ao salvar
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
                  {autoPlanCount} semanas automáticas podem ser recalculadas. Os {manualPlanCount} planos manuais e {completedLessonCount} aulas realizadas permanecem preservados.
                </Text>
              </View>
            ) : null}
          </ManagerPane>

          <ManagerPane
            scrollable={false}
            containerStyle={{
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              display: activeStep === 6 ? "flex" : "none",
              borderTopWidth: 0,
              borderTopColor: colors.border,
            }}
            contentStyle={{
              padding: compact ? 16 : 26,
              gap: 22,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              6. Revisão e impacto
            </Text>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Curva anual ({draft.cycleLengthWeeks} semanas)
              </Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>
                {LOAD_MODEL_OPTIONS.find((option) => option.value === draft.loadModel)?.label}
                {" · "}PSE {draft.intensityMin}–{draft.intensityMax}
                {" · "}recuperação a cada {draft.recoveryWeeks} semanas
              </Text>
              <PeriodizationLoadCurve
                colors={colors}
                weekPlans={weekPlans}
                currentWeek={currentWeek}
                draft={draft}
              />
            </View>

            <View style={{ gap: 14 }}>
              {!configured || creatingNextCycle ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.warningBorder,
                    borderRadius: 12,
                    backgroundColor: colors.warningBg,
                  }}
                >
                  <GoAtletaIcon name="warningCircle" size={18} color={colors.warningText} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.warningText, fontSize: 12, fontWeight: "800" }}>
                      Próximo passo
                    </Text>
                    <Text style={{ color: colors.warningText, fontSize: 11, lineHeight: 16 }}>
                      {creatingNextCycle
                        ? "Revise os dados sugeridos e defina o início do próximo ciclo."
                        : setupGuidance}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                  Dados já disponíveis
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
                  Herdados do cadastro da turma. Revise apenas se algo mudou.
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  <ImpactRow
                    colors={colors}
                    icon="students"
                    label="Turma"
                    value={`${LEVEL_OPTIONS.find((option) => option.value === draft.mvLevel)?.label ?? draft.mvLevel} · ${draft.goal.trim() || "Objetivo não definido"}`}
                    complete={classParametersComplete}
                    showStatus={false}
                  />
                  <ImpactRow
                    colors={colors}
                    icon="calendar"
                    label="Agenda"
                    value={`${dayLabel || "Dias não definidos"} · ${draft.startTime || "--:--"}${timeEnd ? `–${timeEnd}` : ""} · ${draft.durationMinutes} min`}
                    complete={agendaParametersComplete}
                    showStatus={false}
                  />
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                  Configuração da periodização
                </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                <ImpactRow
                  colors={colors}
                  icon="periodization"
                  label="Parâmetros do ciclo"
                  value={`${formatBrazilianDate(draft.cycleStartDate) || "Data de início pendente"} · ${draft.cycleLengthWeeks} semanas`}
                  complete={cycleParametersComplete}
                />
                <ImpactRow
                  colors={colors}
                  icon="trend"
                  label="Carga"
                  value={`${LOAD_MODEL_OPTIONS.find((option) => option.value === draft.loadModel)?.label} · PSE ${draft.intensityMin}–${draft.intensityMax} · recuperação a cada ${draft.recoveryWeeks}`}
                  complete={loadParametersComplete}
                />
              </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                  Conteúdo existente
                </Text>
                <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
                  Será preservado ao salvar a nova configuração.
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                <ImpactRow
                  colors={colors}
                  icon="refresh"
                  label="Planejamento gerado"
                  value={
                    creatingNextCycle
                      ? "Serão geradas após a criação"
                      : `${autoPlanCount} semanas geradas automaticamente`
                  }
                  complete={!creatingNextCycle && autoPlanCount > 0}
                  showStatus={false}
                />
                <ImpactRow
                  colors={colors}
                  icon="students"
                  label="Planos personalizados"
                  value={
                    creatingNextCycle
                      ? `${manualPlanCount} continuam no histórico`
                      : `${manualPlanCount} preservados`
                  }
                  complete={manualPlanCount > 0}
                  showStatus={false}
                />
                <ImpactRow
                  colors={colors}
                  icon="checkmarkCircle"
                  label="Aulas concluídas"
                  value={`${completedLessonCount} preservadas e consideradas`}
                  complete={completedLessonCount > 0}
                  showStatus={false}
                />
              </View>
              </View>
            </View>

            {!creatingNextCycle ? <View
              style={{
                flexDirection: narrow ? "column" : "row",
                gap: 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                disabled={regenerating || !configured}
                onPress={onRegenerateAutomatic}
                style={{
                  minHeight: 44,
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  opacity: regenerating || !configured ? 0.55 : 1,
                }}
              >
                <GoAtletaIcon name="refresh" size={17} color={colors.text} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  {regenerating ? "Regerando..." : "Regerar automáticos"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={onDuplicate}
                style={{
                  minHeight: 44,
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: 10,
                }}
              >
                <GoAtletaIcon name="copy" size={17} color={colors.muted} />
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  Duplicar em nova turma
                </Text>
              </Pressable>
            </View> : null}

            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.successBorder,
                backgroundColor: colors.successBg,
                padding: 12,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 9,
              }}
            >
              <GoAtletaIcon
                name="shield"
                size={18}
                color={colors.successText}
              />
              <Text
                style={{
                  flex: 1,
                  color: colors.successText,
                  fontSize: 11,
                  lineHeight: 16,
                }}
              >
                {creatingNextCycle
                  ? "Criar ativa uma nova janela anual. O ciclo encerrado, os planos e as aulas realizadas permanecem no histórico."
                  : "Salvar atualiza a configuração e recalcula a semana atual e as próximas semanas automáticas. Edições manuais e aulas já realizadas são preservadas."}
              </Text>
            </View>
          </ManagerPane>
        </ManagerBody>
        )}
        </View>
        </PlanningAssistantHost>

        <View
          style={{
            minHeight: 52,
            flexDirection: narrow ? "column" : "row",
            alignItems: narrow ? "stretch" : "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {activeStep > 1 && activeStep < 6 ? <Pressable
            accessibilityRole="button"
            onPress={() => setCurrentStep((step) => Math.max(1, step - 1))}
            style={{ minHeight: 44, minWidth: compact ? undefined : 120, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18 }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Voltar</Text>
          </Pressable> : null}
          {activeStep < 6 ? <Pressable
            accessibilityRole="button"
            onPress={() => setCurrentStep((step) => Math.min(6, step + 1))}
            style={{ minHeight: 40, minWidth: 120, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: colors.primaryBg, paddingHorizontal: 16, marginLeft: "auto" }}
          >
            <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>Continuar</Text>
          </Pressable> : null}
          {activeStep === 6 && (error || dirty || creatingNextCycle) ? <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <GoAtletaIcon
              name={error ? "warningCircle" : dirty || creatingNextCycle ? "info" : "checkmarkCircle"}
              size={18}
              color={
                error
                  ? colors.dangerText
                  : dirty || creatingNextCycle
                    ? colors.warningText
                    : colors.successText
              }
            />
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                color: error
                  ? colors.dangerText
                  : dirty || creatingNextCycle
                    ? colors.warningText
                    : colors.muted,
                fontSize: 11,
              }}
            >
              {error ||
                (creatingNextCycle
                  ? "Pronto para criar com início sugerido"
                  : dirty
                    ? "Alterações não salvas"
                    : "Configuração sincronizada")}
            </Text>
          </View> : null}
          {activeStep === 6 && dirty ? <Pressable
            accessibilityRole="button"
            accessibilityLabel={creatingNextCycle ? "Restaurar sugestão" : "Descartar rascunho"}
            disabled={!dirty || saving}
            onPress={() => { setDraft(savedDraft); setCycleDateInput(formatBrazilianDate(savedDraft.cycleStartDate)); }}
            style={{
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              paddingHorizontal: 16,
              opacity: !dirty || saving ? 0.5 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
              {creatingNextCycle ? "Restaurar sugestão" : "Descartar rascunho"}
            </Text>
          </Pressable> : null}
          {activeStep === 6 ? <Pressable
            accessibilityRole="button"
            disabled={saveDisabled}
            onPress={() => void handleSave()}
            style={{
              minHeight: 40,
              minWidth: 120,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 16,
              marginLeft: "auto",
              opacity: saveDisabled ? 0.55 : 1,
            }}
          >
            <Text
              style={{
                color: colors.primaryText,
                fontSize: 12,
                fontWeight: "800",
              }}
            >
              {saving
                ? creatingNextCycle
                  ? "Criando..."
                  : "Salvando..."
                : creatingNextCycle
                  ? "Criar ciclo"
                  : "Salvar e aplicar"}
            </Text>
          </Pressable> : null}
        </View>
      </View>
    </ModalSheet>
  );
}
