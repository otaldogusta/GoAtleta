import { useCallback, useRef, useState, type ReactNode } from "react";
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
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import {
  PeriodizationLoadCurve,
  type PeriodizationGraphWeek,
} from "./components/PeriodizationLoadCurve";

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
    <AnchoredDropdown visible={open} layout={layout} container={null} animationStyle={{}} zIndex={9200} maxHeight={180} nestedScrollEnabled portalToBodyOnWeb onRequestClose={() => setOpen(false)} interactiveRefs={[triggerRef]} density="compact">
      {options.map((option) => <AnchoredDropdownOption key={String(option.value)} active={option.value === value} density="compact" onPress={() => { onChange(option.value); setOpen(false); }}><Text style={{ color: option.value === value ? colors.primaryText : colors.text, fontSize: 12, fontWeight: "700" }}>{option.label}</Text></AnchoredDropdownOption>)}
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
};

export type PeriodizationManagerSection =
  | "cycle"
  | "agenda"
  | "class"
  | "exceptions";

type Props = {
  visible: boolean;
  mode?: "manage" | "create-next";
  colors: ThemeColors;
  className: string;
  classSubtitle: string;
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

function formatBrazilianDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

function parseBrazilianDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const formatted = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("-");
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

function FieldShell({
  colors,
  children,
  minWidth = 150,
}: {
  colors: ThemeColors;
  children: ReactNode;
  minWidth?: number;
}) {
  return (
    <View
      style={{
        minHeight: 44,
        minWidth,
        flex: 1,
        justifyContent: "center",
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.inputBg,
        paddingHorizontal: 12,
      }}
    >
      {children}
    </View>
  );
}

function ImpactRow({
  colors,
  icon,
  label,
  value,
}: {
  colors: ThemeColors;
  icon: "calendar" | "trend" | "refresh" | "students" | "checkmarkCircle";
  label: string;
  value: string;
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
      <GoAtletaIcon
        name="checkmarkCircle"
        size={16}
        color={colors.successText}
      />
    </View>
  );
}

export function PeriodizationManagerSheet({
  visible,
  mode = "manage",
  colors,
  className,
  classSubtitle,
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
  const wide = width >= 1200;
  const compact = width < 760;
  const narrow = width < 980;
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cycleDateInput, setCycleDateInput] = useState(() => formatBrazilianDate(initialDraft.cycleStartDate));
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
      containerPadding={compact ? 8 : 22}
      backdropOpacity={0.72}
      cardStyle={{
        alignSelf: "center",
        width: "100%",
        maxWidth: 1340,
        height: Math.min(height - (compact ? 16 : 44), 900),
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
            minHeight: compact ? 70 : 88,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: compact ? 16 : 28,
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
                {creatingNextCycle ? "Criar próximo ciclo" : "Gerenciar periodização"}
              </Text>
              <View
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
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}
            >
              {className} · {classSubtitle}
            </Text>
          </View>

          <View
            ref={menuTriggerRef}
            style={{ display: creatingNextCycle ? "none" : "flex" }}
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
            visible={menuOpen && !creatingNextCycle}
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

        <ManagerBody split={wide}>
          <ManagerPane
            scrollable={wide}
            containerStyle={{
              width: wide ? "51%" : "100%",
              maxWidth: "100%",
              minWidth: 0,
              borderRightWidth: wide ? 1 : 0,
              borderRightColor: colors.border,
            }}
            contentStyle={{
              padding: compact ? 16 : 26,
              gap: 22,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Parâmetros do ciclo
            </Text>

            {creatingNextCycle ? (
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

            <View style={{ gap: 12 }}>
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
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ gap: 12 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                2. Agenda
              </Text>
              <View style={{ gap: 6 }}>
                <InputLabel colors={colors}>Dias da semana</InputLabel>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {DAY_OPTIONS.map((option) => {
                    const active = draft.daysOfWeek.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() =>
                          setDraft((current) => ({
                            ...current,
                            daysOfWeek: active
                              ? current.daysOfWeek.filter(
                                  (day) => day !== option.value,
                                )
                              : [...current.daysOfWeek, option.value].sort(),
                          }))
                        }
                        style={{
                          minWidth: 48,
                          minHeight: 36,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 9,
                          borderWidth: 1,
                          borderColor: active
                            ? colors.successBorder
                            : colors.border,
                          backgroundColor: active
                            ? colors.successBg
                            : colors.inputBg,
                        }}
                      >
                        <Text
                          style={{
                            color: active ? colors.successText : colors.text,
                            fontSize: 11,
                            fontWeight: "700",
                          }}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <View style={{ flexDirection: narrow ? "column" : "row", gap: 10 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <InputLabel colors={colors}>Horário de início</InputLabel>
                  <TextInput
                    accessibilityLabel="Horário de início"
                    value={draft.startTime}
                    onChangeText={(startTime) =>
                      setDraft((current) => ({ ...current, startTime }))
                    }
                    placeholder="18:00"
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
                  <InputLabel colors={colors}>Duração (min)</InputLabel>
                  <TextInput
                    accessibilityLabel="Duração em minutos"
                    value={String(draft.durationMinutes)}
                    keyboardType="number-pad"
                    onChangeText={(value) =>
                      setDraft((current) => ({
                        ...current,
                        durationMinutes: Number(value.replace(/\D/g, "")) || 0,
                      }))
                    }
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
                  <InputLabel colors={colors}>Resumo</InputLabel>
                  <FieldShell colors={colors}>
                    <Text style={{ color: colors.text, fontSize: 11 }}>
                      {dayLabel || "Nenhum dia"} · {draft.startTime || "--:--"}
                      {timeEnd ? `–${timeEnd}` : ""}
                    </Text>
                  </FieldShell>
                </View>
              </View>
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
                    placeholder="DD-MM-AAAA"
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
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ gap: 12 }}>
              <View>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>
                  3. Modelo de carga
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
                  {(["intensityMin", "intensityMax"] as const).map((field) => (
                    <View key={field} style={{ flex: 1, gap: 6 }}>
                      <InputLabel colors={colors}>{field === "intensityMin" ? "PSE mínimo" : "PSE máximo"}</InputLabel>
                      <TextInput accessibilityLabel={field === "intensityMin" ? "PSE mínimo" : "PSE máximo"} keyboardType="numeric" value={String(draft[field])} onChangeText={(value) => setDraft((current) => { const next = Math.max(0, Math.min(10, Number(value.replace(/[^0-9]/g, "")) || 0)); return { ...current, [field]: next, ...(field === "intensityMax" ? { recoveryWeeks: next >= 8 ? 3 : next >= 6 ? 4 : 5 } : {}) }; })} style={{ minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.text, paddingHorizontal: 12, fontSize: 12, fontWeight: "700" }} />
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border }} />

            <View style={{ gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAdvancedOpen((current) => !current)}
                style={{
                  minHeight: 42,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    color: colors.text,
                    fontSize: 13,
                    fontWeight: "800",
                  }}
                >
                  4. Avançados
                  <Text style={{ color: colors.muted, fontWeight: "500" }}>
                    {" "}
                    · competição, pausas e disponibilidade
                  </Text>
                </Text>
                <GoAtletaIcon
                  name={advancedOpen ? "chevronUp" : "chevronDown"}
                  size={17}
                  color={colors.muted}
                />
              </Pressable>
              {advancedOpen ? advancedContent : null}
            </View>
          </ManagerPane>

          <ManagerPane
            scrollable={wide}
            containerStyle={{
              width: wide ? "49%" : "100%",
              maxWidth: "100%",
              minWidth: 0,
              borderTopWidth: wide ? 0 : 1,
              borderTopColor: colors.border,
            }}
            contentStyle={{
              padding: compact ? 16 : 26,
              gap: 22,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Prévia do impacto
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

            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                {creatingNextCycle ? "O que será criado" : "O que mudará ao salvar"}
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
                  icon="calendar"
                  label="Agenda"
                  value={
                    creatingNextCycle
                      ? `${dayLabel || "Dias não definidos"} · início ${formatBrazilianDate(draft.cycleStartDate)}`
                      : dirty
                        ? "Parâmetros serão atualizados"
                        : "Sem alteração"
                  }
                />
                <ImpactRow
                  colors={colors}
                  icon="trend"
                  label="Carga"
                  value={`${LOAD_MODEL_OPTIONS.find((option) => option.value === draft.loadModel)?.label} · PSE ${draft.intensityMin}–${draft.intensityMax}`}
                />
                <ImpactRow
                  colors={colors}
                  icon="refresh"
                  label="Semanas automáticas"
                  value={
                    creatingNextCycle
                      ? "Serão geradas após a criação"
                      : `${autoPlanCount} disponíveis para regerar`
                  }
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
                />
                <ImpactRow
                  colors={colors}
                  icon="checkmarkCircle"
                  label="Aulas concluídas"
                  value={`${completedLessonCount} preservadas e consideradas`}
                />
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
                  : "Salvar altera a configuração base. Regerar e redefinir atuam somente nas semanas automáticas; edições manuais são preservadas."}
              </Text>
            </View>
          </ManagerPane>
        </ManagerBody>

        <View
          style={{
            minHeight: compact ? 74 : 82,
            flexDirection: narrow ? "column" : "row",
            alignItems: narrow ? "stretch" : "center",
            gap: 12,
            paddingHorizontal: compact ? 16 : 26,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View
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
          </View>
          <Pressable
            disabled={!dirty || saving}
            onPress={() => { setDraft(savedDraft); setCycleDateInput(formatBrazilianDate(savedDraft.cycleStartDate)); }}
            style={{
              minHeight: 42,
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
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={saveDisabled}
            onPress={() => void handleSave()}
            style={{
              minHeight: 46,
              minWidth: compact ? undefined : 190,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 11,
              backgroundColor: colors.primaryBg,
              paddingHorizontal: 20,
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
          </Pressable>
        </View>
      </View>
    </ModalSheet>
  );
}
