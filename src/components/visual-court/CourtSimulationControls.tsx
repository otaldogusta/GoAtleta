import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { CourtDefenseCoverage, CourtSimulation } from "../../core/court-simulation-model";
import { COURT_DEFENSE_ATTACKS, courtDefensePreset, type CourtDefensePreset } from "../../core/court-defense-preset";
import { compactUiMetrics, radius, spacing } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { courtEditingDock, courtPlaybackLayout } from "./court-overlay-layout";

type SimulationMode = CourtSimulation["mode"];
type CameraView = "front" | "side" | "orbit";
const ROTATIONS = ["P1", "P6", "P5", "P4", "P3", "P2"] as const;
const SPEED_OPTIONS = [0.5, 1, 1.5, 2].map(value => ({ value, label: `${String(value).replace(".", ",")}×` }));
const ATTACK_SET_OPTIONS = [
  { id: "4", label: "Bola alta na entrada" },
  { id: "go", label: "Chutada na entrada" },
  { id: "1", label: "Tempo cabeça" },
  { id: "tempo-costas", label: "Tempo costas" },
  { id: "metro", label: "Metro (sete)" },
  { id: "31", label: "Chutada de meio" },
  { id: "2", label: "Meia bola no meio" },
  { id: "china", label: "China" },
  { id: "5", label: "Bola alta na saída" },
  { id: "red", label: "Chutada na saída" },
  { id: "pipe", label: "Pipe (fundo 6)" },
  { id: "bic", label: "Pipe rápida (fundo 6)" },
  { id: "fundo-1", label: "Fundo 1" },
] as const;
const BLOCKER_IDS = [1, 2, 5];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

function Segments<T extends string | number>({ label, options, value, onChange, disabled = false, nativeID, compact = false, fullTouchTarget = false, slideSelection = false }: {
  label: string; options: readonly { value: T; label: string; disabled?: boolean; accessibilityLabel?: string }[]; value: T | undefined;
  onChange: (value: T) => void; disabled?: boolean; nativeID?: string; compact?: boolean; fullTouchTarget?: boolean; slideSelection?: boolean;
}) {
  const { colors } = useAppTheme();
  const touch = Platform.OS !== "web";
  const sizing = fullTouchTarget ? { minHeight: compactUiMetrics.touchTarget } : compact ? { minHeight: 22 } : touch ? { minHeight: 36 } : null;
  const fontSize = compact ? fullTouchTarget ? 11 : 10 : 12;
  const selectedIndex = options.findIndex(option => option.value === value);
  const sliding = Platform.OS === "web" && slideSelection && selectedIndex >= 0;
  return <View nativeID={nativeID} accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segments, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
    {sliding ? <View pointerEvents="none" aria-hidden style={{ position: "absolute", left: 3, right: 3, top: 3, bottom: 3 }}>
      <View {...{ dataSet: { courtModeIndicator: "true" } }} style={{ width: `${100 / options.length}%`, height: "100%",
        borderRadius: radius.full, backgroundColor: colors.primaryBg, opacity: disabled || options[selectedIndex].disabled ? .38 : 1,
        transform: [{ translateX: `${selectedIndex * 100}%` }] }} />
    </View> : null}
    {options.map(option => <Pressable suppressWebHoverFeedback disableWebPressScale key={option.value} accessibilityRole="radio" accessibilityLabel={option.accessibilityLabel ?? `${label}: ${option.label}`} accessibilityState={{ checked: value === option.value, disabled: disabled || option.disabled }} aria-checked={value === option.value} disabled={disabled || option.disabled} onPress={() => { if (!disabled && !option.disabled) onChange(option.value); }} style={({ hovered, pressed }) => [styles.segment, sizing, { backgroundColor: value === option.value ? sliding ? "transparent" : colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled || option.disabled ? 0.38 : 1 }]}>
      <Text numberOfLines={1} style={{ color: value === option.value ? colors.primaryText : colors.muted, fontSize, fontWeight: touch && value === option.value ? "600" : "400" }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

function Range({ label, value, min, max, step, onChange, disabled = false, text, onReset, commitOnEnd = false, transport = false, formatValue, onPreview }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void;
  disabled?: boolean; text?: string; onReset?: () => void; commitOnEnd?: boolean; transport?: boolean; formatValue?: (value: number) => string; onPreview?: (value: number | null) => void;
}) {
  const { colors } = useAppTheme();
  const { width: controlWidth } = useWindowDimensions();
  const touch = Platform.OS !== "web" || (transport && controlWidth <= 700);
  const [width, setWidth] = useState(1);
  const [draft, setDraft] = useState<number | null>(null);
  const [source, setSource] = useState({ value, disabled });
  const draftRef = useRef<number | null>(null);
  if (source.value !== value || source.disabled !== disabled) {
    setSource({ value, disabled });
    setDraft(null);
  }
  const boundedValue = clamp(value, min, max);
  const bounded = draft ?? boundedValue;
  const displayValue = formatValue?.(bounded);
  const valueText = displayValue ?? text;
  const withValue = (control: ReactNode) => displayValue === undefined ? control : (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{control}</View>
      <Text style={{ color: colors.muted, minWidth: 38, fontSize: 11, fontVariant: ["tabular-nums"] }}>{displayValue}</Text>
    </View>
  );
  useEffect(() => { draftRef.current = null; }, [value, disabled]);
  const chooseValue = (next: number) => {
    if (disabled || !Number.isFinite(next)) return;
    const number = clamp(next, min, max);
    if (commitOnEnd) { draftRef.current = number; setDraft(number); onPreview?.(number); }
    else onChange(number);
  };
  const commit = () => {
    const next = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    onPreview?.(null);
    if (!disabled && next !== null && next !== boundedValue) onChange(next);
  };
  const cancel = () => { draftRef.current = null; setDraft(null); onPreview?.(null); };
  if (Platform.OS === "web") return withValue(<>
    <style>{`
      .court-slider{appearance:none;-webkit-appearance:none;background:transparent;outline:none;border:0;padding:0;touch-action:pan-y}
      .court-slider::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(to right,${colors.primaryBg} 0 var(--court-progress),${colors.border} var(--court-progress) 100%)}
      .court-slider::-moz-range-track{height:4px;border-radius:999px;background:linear-gradient(to right,${colors.primaryBg} 0 var(--court-progress),${colors.border} var(--court-progress) 100%)}
      .court-slider::-webkit-slider-thumb{appearance:none;-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border:0;border-radius:50%;background:${colors.text};transition:box-shadow 120ms ease}
      .court-slider::-moz-range-thumb{width:16px;height:16px;border:0;border-radius:50%;background:${colors.text}}
      .court-slider:hover::-webkit-slider-thumb,.court-slider:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px ${colors.primaryBg}33}
      .court-timeline-slider:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 2px ${colors.primaryBg},0 0 0 5px ${colors.primaryBg}33}
      .court-timeline-slider:focus-visible::-moz-range-thumb{box-shadow:0 0 0 2px ${colors.primaryBg},0 0 0 5px ${colors.primaryBg}33}
      .court-slider:not(.court-timeline-slider):focus-visible{outline:2px solid ${colors.primaryBg};outline-offset:3px;border-radius:6px}
    `}</style>
    <input className={transport ? "court-slider court-timeline-slider" : "court-slider"}
    type="range" min={min} max={max} step={step} value={bounded} disabled={disabled}
    aria-label={label} aria-valuetext={valueText}
    onChange={(event) => {
      const next = Number(event.currentTarget.value);
      chooseValue(next);
    }}
    onPointerUp={commitOnEnd ? commit : undefined}
    onPointerCancel={commitOnEnd ? cancel : undefined}
    onKeyUp={commitOnEnd ? commit : undefined}
    onBlur={commitOnEnd ? commit : undefined}
    onDoubleClick={onReset ? () => { if (!disabled) onReset(); } : undefined}
    style={{ "--court-progress": `${clamp((bounded - min) / (max - min), 0, 1) * 100}%`, display: "block", width: "100%", minWidth: 0, flexShrink: 0, height: transport ? 40 : touch ? 44 : 24, margin: 0, accentColor: colors.primaryBg, cursor: disabled ? "default" : "ew-resize", opacity: disabled ? 0.55 : 1 } as CSSProperties}
  /></>);
  const choose = (position: number) => {
    chooseValue(clamp(min + Math.round(clamp(position / width, 0, 1) * (max - min) / step) * step, min, max));
  };
  const fraction = (bounded - min) / (max - min);
  return withValue(<View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityState={{ disabled }} accessibilityValue={{ min, max, now: bounded, text: valueText }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={event => { if (!disabled) onChange(clamp(bounded + (event.nativeEvent.actionName === "increment" ? step : -step), min, max)); }} onLayout={event => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => !disabled} onResponderGrant={event => choose(event.nativeEvent.locationX)} onResponderMove={event => choose(event.nativeEvent.locationX)} onResponderRelease={commitOnEnd ? commit : undefined} onResponderTerminate={commitOnEnd ? cancel : undefined} style={{ height: transport ? 40 : 44, justifyContent: "center", opacity: disabled ? 0.55 : 1 }}>
    <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}><View style={{ height: 4, width: `${fraction * 100}%`, backgroundColor: colors.primaryBg }} /><View style={{ position: "absolute", top: -5, left: `${fraction * 100}%`, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primaryBg }} /></View>
  </View>);
}

function IconButton({ label, icon, onPress, primary = false, disabled = false, children, transport = false, circular = false, compact = false, fullTarget = false }: {
  label: string; icon: GoAtletaIconName; onPress: () => void; primary?: boolean; disabled?: boolean; children?: ReactNode; transport?: boolean; circular?: boolean; compact?: boolean; fullTarget?: boolean;
}) {
  const { colors } = useAppTheme();
  const { width: controlWidth } = useWindowDimensions();
  const touch = Platform.OS !== "web" || (transport && controlWidth <= 700);
  return <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} hitSlop={compact && !fullTarget ? 4 : undefined} onPress={onPress} style={({ hovered, pressed }) => [styles.iconButton, { minWidth: fullTarget ? 44 : compact ? circular ? 32 : 28 : circular || primary ? 44 : touch ? 40 : 28, minHeight: fullTarget ? 44 : compact ? 32 : circular ? 44 : touch ? transport ? 40 : 44 : 28, flexShrink: 0, backgroundColor: hovered || pressed ? colors.secondaryBg : circular ? colors.background : primary ? colors.primaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}>
    {children}<GoAtletaIcon name={icon} size={compact ? 12 : circular ? primary ? 16 : 19 : Platform.OS !== "web" ? primary ? 18 : 16 : primary ? 12 : 14} color={circular ? primary ? colors.primaryBg : colors.text : primary ? colors.primaryText : colors.muted} />
  </Pressable>;
}

export function CourtSimulationModes({ mode, onChange, disabled = false, defenseAvailable = true }: {
  mode: SimulationMode; onChange: (mode: SimulationMode) => void; disabled?: boolean; defenseAvailable?: boolean;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const touch = Platform.OS !== "web" || width <= 700;
  const compactWeb = Platform.OS === "web" && width <= 700;
  const web = Platform.OS === "web";
  const activeIndex = mode === "receive" ? 0 : mode === "attack" ? 1 : 2;
  return <View accessibilityRole="tablist" accessibilityLabel="Modo da jogada" style={[styles.modes, compactWeb ? { padding: 3 } : null, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
    {web ? <>
      <style>{`
        [data-court-mode-indicator] { transition: transform 170ms cubic-bezier(.2,.75,.25,1); }
        [data-court-quick-slide] { animation: court-quick-slide 170ms ease-out both; }
        @keyframes court-quick-slide { from { transform: translateX(7px); opacity: .72; } to { transform: translateX(0); opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          [data-court-mode-indicator] { transition: none; }
          [data-court-quick-slide] { animation: none; }
        }
      `}</style>
      <View pointerEvents="none" aria-hidden {...{ dataSet: { courtModeIndicator: "true" } }}
        style={{ position: "absolute", left: compactWeb ? 3 : 4, top: compactWeb ? 3 : 4, bottom: compactWeb ? 3 : 4,
          width: compactWeb ? 58 : 76, backgroundColor: colors.primaryBg, borderRadius: radius.full,
          transform: [{ translateX: activeIndex * (compactWeb ? 58 : 76) }] }} />
    </> : null}
    {([["receive", "Recepção"], ["attack", "Ataque"], ["defense", "Defesa"]] as const).map(([value, label]) => <Pressable suppressWebHoverFeedback disableWebPressScale key={value} accessibilityRole="tab" accessibilityLabel={label} aria-selected={mode === value} accessibilityState={{ selected: mode === value, disabled: disabled || value === "defense" && !defenseAvailable }} disabled={disabled || value === "defense" && !defenseAvailable} onPress={() => { if (!disabled && (value !== "defense" || defenseAvailable)) onChange(value); }} style={({ hovered, pressed }) => [styles.mode, web ? { width: compactWeb ? 58 : 76, paddingHorizontal: 0 } : null, compactWeb ? { minHeight: 28, paddingHorizontal: 5 } : null, { backgroundColor: mode === value ? web ? "transparent" : colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled || value === "defense" && !defenseAvailable ? 0.55 : 1 }]}><Text style={{ color: mode === value ? colors.primaryText : colors.text, fontSize: compactWeb ? 11 : 13, fontWeight: touch && mode === value ? "600" : "400" }}>{label}</Text></Pressable>)}
  </View>;
}

export function CourtSimulationTransport({ playing, progress, speed, rotation, onPlay, onRestart, onPreviousRotation, onNextRotation, onSeek, onSpeed, onOpenSteps, editingControls, dockInsets, disabled = false, bottom = 20, showRotation = true, uiScale = 1 }: {
  playing: boolean; progress: number; speed: number; rotation: number;
  onPlay: () => void; onRestart: () => void; onPreviousRotation: () => void; onNextRotation: () => void;
  onSeek: (value: number) => void; onSpeed: (value: number) => void; onOpenSteps: () => void;
  disabled?: boolean; bottom?: number; showRotation?: boolean; uiScale?: number;
  editingControls?: ReactNode;
  dockInsets?: { left: number; right: number };
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const layout = courtPlaybackLayout(width, uiScale, Platform.OS === "web");
  const compactOptions = Platform.OS === "web" && layout.stacked;
  const editingDock = Boolean(editingControls && dockInsets);
  const controlsScale = compactOptions ? Math.min(1, layout.width / 276) : 1;
  const speedTrigger = useRef<View>(null);
  const speedMenuId = useId();
  const [speedOpen, setSpeedOpen] = useState(false);
  const [speedLayout, setSpeedLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [speedWasDisabled, setSpeedWasDisabled] = useState(disabled);
  if (speedWasDisabled !== disabled) {
    setSpeedWasDisabled(disabled);
    if (disabled) setSpeedOpen(false);
  }
  const selectedRotation = Math.floor(clamp(rotation, 0, 5));
  const boundedSpeed = clamp(speed, 0.5, 2);
  const rate = `${String(boundedSpeed).replace(".", ",")}×`;
  const closeSpeed = () => {
    if (Platform.OS === "web" && typeof document !== "undefined" && document.getElementById(speedMenuId)?.contains(document.activeElement)) {
      (speedTrigger.current as unknown as HTMLElement | null)?.querySelector<HTMLElement>('button, [role="button"]')?.focus();
    }
    setSpeedOpen(false);
  };
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || !speedOpen || !speedLayout || disabled) return;
    const frame = requestAnimationFrame(() => {
      const menu = document.getElementById(speedMenuId);
      (menu?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? menu?.querySelector<HTMLElement>('[role="radio"]'))?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [speedOpen, speedLayout, speedMenuId, disabled]);
  const toggleSpeed = () => {
    if (disabled) return;
    if (speedOpen) { closeSpeed(); return; }
    speedTrigger.current?.measureInWindow((x, y, width, height) => setSpeedLayout({ x, y, width, height }));
    setSpeedOpen(true);
  };
  const rotationControls = showRotation ? <View style={{ flexDirection: "row", alignItems: "center", gap: compactOptions ? 0 : 2 }}>
        <IconButton transport compact={compactOptions} label={`Rotação anterior: ${ROTATIONS[(selectedRotation + 5) % 6]}`} icon="chevronBack" onPress={onPreviousRotation} disabled={disabled} />
        <Text style={{ width: compactOptions ? 16 : 20, textAlign: "center", fontSize: compactOptions ? 10 : 11, color: colors.text }}>{ROTATIONS[selectedRotation]}</Text>
        <IconButton transport compact={compactOptions} label={`Próxima rotação: ${ROTATIONS[(selectedRotation + 1) % 6]}`} icon="chevronForward" onPress={onNextRotation} disabled={disabled} />
      </View> : null;
  const speedControl = <View ref={speedTrigger} collapsable={false}>
    <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel="Velocidade da reprodução" accessibilityValue={{ text: rate }} accessibilityState={{ expanded: speedOpen && !disabled, disabled }} disabled={disabled} onPress={toggleSpeed} style={({ hovered, pressed }) => [styles.transportRow, { minWidth: compactOptions || editingDock ? 44 : 48, minHeight: editingDock ? 44 : Platform.OS === "web" ? 32 : 40, paddingHorizontal: compactOptions ? 4 : 6, justifyContent: "center", borderRadius: radius.full, backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}>
      <Text numberOfLines={1} style={{ color: colors.text, fontSize: Platform.OS === "web" ? 11 : 12, fontVariant: ["tabular-nums"] }}>{rate}</Text>
      <GoAtletaIcon name="chevronDown" size={12} color={colors.muted} />
    </Pressable>
  </View>;
  const options = <View accessibilityLabel="Rodízio e opções de reprodução" style={[styles.transportRow, compactOptions || editingDock ? { flex: 1, minWidth: 0 } : null, { justifyContent: "space-between", gap: editingDock ? 0 : compactOptions ? 4 : 6, paddingHorizontal: editingDock ? 0 : compactOptions ? 4 : 6, minHeight: 36, borderRadius: radius.full, backgroundColor: compactOptions || editingDock ? "transparent" : colors.background }]}>
    {rotationControls}
    {speedControl}
    {editingDock ? null : editingControls ?? <IconButton transport compact={compactOptions} label="Mostrar ajustes" icon="list" onPress={onOpenSteps} />}
  </View>;
  return <><View accessibilityLabel="Reprodução da jogada" style={[styles.transport, { bottom, justifyContent: "space-between" }, editingDock ? { left: courtEditingDock.left + (dockInsets?.left ?? 0), right: courtEditingDock.right + (dockInsets?.right ?? 0), height: courtEditingDock.height } : { width: layout.width, height: layout.height, transform: [{ scale: uiScale }], transformOrigin: "bottom center" }]}>
    <View style={{ height: 24, justifyContent: "center" }}><Range transport label="Avançar ou voltar na jogada" value={progress} min={0} max={1} step={0.001} onChange={onSeek} disabled={disabled} text={`${Math.round(clamp(progress, 0, 1) * 100)}%`} /></View>
    <View accessibilityLabel="Comandos de reprodução" style={[styles.transportRow, { justifyContent: "space-between", gap: compactOptions ? 4 : 8, height: 44 }, editingDock ? { width: "100%", height: courtEditingDock.commandsHeight, gap: 0, paddingHorizontal: courtEditingDock.commandsPadding, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background } : compactOptions ? { width: layout.width / controlsScale, paddingHorizontal: 4, borderRadius: radius.full, backgroundColor: colors.background, transform: [{ scale: controlsScale }], transformOrigin: "bottom left" } : null]}>
      <View style={[styles.transportRow, { gap: editingDock ? 0 : compactOptions ? 4 : 8 }]}>
        <IconButton transport circular compact={compactOptions || editingDock} fullTarget={editingDock} label={playing ? "Pausar jogada" : "Reproduzir jogada"} icon={playing ? "pause" : "play"} onPress={onPlay} primary disabled={disabled} />
        <IconButton transport circular compact={compactOptions || editingDock} fullTarget={editingDock} label="Voltar ao início da jogada" icon="refresh" onPress={onRestart} disabled={disabled} />
      </View>
      {!layout.stacked || compactOptions || editingDock ? options : null}
      {editingDock ? editingControls : null}
    </View>
    {layout.stacked && !compactOptions && !editingDock ? options : null}
  </View>
    <AnchoredDropdown visible={speedOpen && !disabled} layout={speedLayout} container={null} animationStyle={{}} zIndex={6100} maxHeight={Platform.OS === "web" ? 34 : 44} nestedScrollEnabled={false} density="popover" surface="none" preferredWidth={208} align="end" scrollContentStyle={{ padding: 0, gap: 0 }} fitContent showVerticalScrollIndicator={false} onRequestClose={closeSpeed} interactiveRefs={[speedTrigger]}>
      <Segments nativeID={speedMenuId} label="Velocidade" options={SPEED_OPTIONS} value={boundedSpeed} disabled={disabled} onChange={value => { if (!disabled) { onSpeed(value); closeSpeed(); } }} />
    </AnchoredDropdown>
  </>;
}

function Row({ label, children, heading = false }: { label: string; children: ReactNode; heading?: boolean }) {
  const { colors } = useAppTheme();
  const touch = Platform.OS !== "web";
  const { width } = useWindowDimensions();
  const compactWeb = !touch && width <= 700;
  return <View style={[styles.row, compactWeb ? { gap: 8, minHeight: 28 } : !touch ? { gap: 16 } : null]}><Text accessibilityRole={heading ? "header" : undefined} style={{ ...(compactWeb ? { width: 72 } : { flex: touch ? 0.39 : 1 }), color: colors.muted, fontSize: compactWeb ? 9 : touch ? 10 : 11, letterSpacing: compactWeb ? 0.3 : touch ? 0.5 : 0.6, ...(heading ? { color: colors.text, fontSize: 12, fontWeight: "600", letterSpacing: 0 } : {}) }}>{label}</Text><View style={compactWeb ? { flex: 1, minWidth: 0 } : touch ? { flex: 0.61, minWidth: 0 } : { width: "60%", minWidth: 0 }}>{children}</View></View>;
}

function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 3 }}>
    {title ? <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{title}</Text> : null}
    {children}
  </View>;
}

function AttackSetPicker({ preset, attackSettings, onChange, disabled, compactWeb }: {
  preset: string; attackSettings?: CourtSimulation["attackSettings"]; onChange: (patch: Partial<CourtSimulation>) => void;
  disabled: boolean; compactWeb: boolean;
}) {
  const { colors } = useAppTheme();
  const setIndex = Math.max(0, ATTACK_SET_OPTIONS.findIndex(option => option.id === preset));
  const choosePreset = (delta: number) => {
    const count = ATTACK_SET_OPTIONS.length;
    const { id } = ATTACK_SET_OPTIONS[(setIndex + delta + count) % count];
    onChange({ preset: id, ...(attackSettings ? { attackSettings: { ...attackSettings, hitOverride: null, setHeight: null, attackArc: null } } : {}) });
  };
  return <View style={[styles.segments, { borderColor: colors.border, backgroundColor: colors.inputBg }]}><IconButton label="Levantamento anterior" icon="chevronBack" onPress={() => choosePreset(-1)} disabled={disabled} /><Text key={setIndex} {...{ dataSet: { courtQuickSlide: "true" } }} style={{ flex: 1, minWidth: 0, textAlign: "center", color: colors.text, fontSize: compactWeb ? 10 : 12 }}>{ATTACK_SET_OPTIONS[setIndex].label}</Text><IconButton label="Próximo levantamento" icon="chevronForward" onPress={() => choosePreset(1)} disabled={disabled} /></View>;
}

export function CourtSimulationQuickControls({ mode, config, disabled, onChange, onDefensePresetChange, unavailableDefensePresets }: {
  mode: SimulationMode; config: CourtSimulation | null; disabled: boolean;
  onChange: (patch: Partial<CourtSimulation>) => void;
  onDefensePresetChange: (preset: CourtDefensePreset) => void;
  unavailableDefensePresets?: readonly CourtDefensePreset[];
}) {
  const { width } = useWindowDimensions();
  const compact = Platform.OS === "web" && width <= 700;
  return <View key={mode} {...{ dataSet: { courtQuickSlide: "true" } }} style={{ alignSelf: "center", width: mode === "receive" ? 252 : 218, maxWidth: "100%" }}>
    {mode === "receive" ? <Segments label="Rodízio" slideSelection compact={compact} disabled={disabled} value={config?.rotation ?? 0}
      options={ROTATIONS.map((label, value) => ({ label, value, accessibilityLabel: `Rodízio ${label}` }))}
      onChange={rotation => onChange({ rotation })} />
      : mode === "attack" ? <AttackSetPicker preset={config?.preset ?? "4"} attackSettings={config?.attackSettings} onChange={onChange} disabled={disabled} compactWeb={compact} />
      : <Segments label="Ataque da defesa" slideSelection compact={compact} disabled={disabled} value={courtDefensePreset(config?.preset)}
        options={COURT_DEFENSE_ATTACKS.map(option => ({ ...option, disabled: unavailableDefensePresets?.includes(option.value) }))}
        onChange={onDefensePresetChange} />}
  </View>;
}

export function CourtSimulationSettings({ config, mode, onChange, onRestore, onShare, cameraView, onCameraView, labelsVisible = true, onLabelsVisible, disabled = false, exportDisabled = false, attackArcValue = .03, showRotation = mode === "receive", unavailableDefenseCoverage, onDefenseCoverageChange, unavailableDefensePresets, onDefensePresetChange, onAttackPreview, primarySelectorInHeader = false }: {
  config: CourtSimulation | null; mode: SimulationMode; onChange: (patch: Partial<CourtSimulation>) => void;
  onRestore: () => void; onShare: () => void;
  cameraView: CameraView; onCameraView: (view: CameraView) => void; labelsVisible?: boolean; onLabelsVisible?: (value: boolean) => void;
  disabled?: boolean;
  exportDisabled?: boolean;
  attackArcValue?: number;
  primarySelectorInHeader?: boolean;
  onAttackPreview?: (settings: CourtSimulation["attackSettings"] | null, focus: "curve" | "block") => void;
  showRotation?: boolean;
  unavailableDefenseCoverage?: CourtDefenseCoverage[];
  onDefenseCoverageChange?: (coverage: CourtDefenseCoverage) => void;
  unavailableDefensePresets?: readonly CourtDefensePreset[];
  onDefensePresetChange?: (preset: CourtDefensePreset) => void;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [angleTarget, setAngleTarget] = useState<number | "all">("all");
  const mobile = width <= 700;
  const touch = Platform.OS !== "web";
  const compactWeb = mobile && !touch;
  const blockers = config?.blockers ?? 1;
  const activeAngleTarget = angleTarget !== "all" && !BLOCKER_IDS.slice(0, blockers).includes(angleTarget) ? "all" : angleTarget;
  const attackSettings: CourtSimulation["attackSettings"] = config?.attackSettings ?? { targetOverride: null, hitOverride: null, setHeight: null, passHeight: 2.1, blockAngle: 0, blockAngles: {}, manualBlockers: [] };
  const angle = activeAngleTarget === "all" ? attackSettings.blockAngle : attackSettings.blockAngles[String(activeAngleTarget)] ?? attackSettings.blockAngle;
  const layers = config?.layers ?? { attack: true, pass: true, block: true };
  const preset = config?.preset ?? "4";
  const attackArc = attackSettings.attackArc ?? attackArcValue;
  const withAngle = (value: number) => activeAngleTarget === "all"
    ? { ...attackSettings, blockAngle: value, blockAngles: {} }
    : { ...attackSettings, blockAngles: { ...attackSettings.blockAngles, [activeAngleTarget]: value } };

  const rotationControl = <Row label="RODÍZIO"><View accessibilityRole="radiogroup" accessibilityLabel="Rodízio" style={{ flexDirection: "row", gap: touch || compactWeb ? 1 : undefined, justifyContent: touch || compactWeb ? undefined : "space-between" }}>{ROTATIONS.map((label, rotation) => <Pressable suppressWebHoverFeedback disableWebPressScale key={label} accessibilityRole="radio" accessibilityLabel={`Rodízio ${label}`} accessibilityState={{ checked: (config?.rotation ?? 0) === rotation, disabled }} aria-checked={(config?.rotation ?? 0) === rotation} disabled={disabled} onPress={() => onChange({ rotation })} style={({ hovered, pressed }) => ({ flex: touch || compactWeb ? 1 : undefined, width: touch || compactWeb ? undefined : 30, minWidth: 0, height: compactWeb ? 28 : mobile && touch ? 44 : 30, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: (config?.rotation ?? 0) === rotation ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 })}><Text style={{ color: (config?.rotation ?? 0) === rotation ? colors.primaryText : colors.muted, fontSize: touch || compactWeb ? 10 : 12 }}>{label}</Text></Pressable>)}</View></Row>;
  return <ScrollView accessibilityLabel="Ajustes da jogada" keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ gap: compactWeb ? 8 : 10, paddingBottom: spacing.sm }}>

        {mode === "attack" && showRotation ? rotationControl : null}
        {mode === "receive" ? <>
          <Row label="SISTEMA"><Segments compact={compactWeb} label="Sistema" value={config?.system ?? "5-1"} options={[{ value: "5-1", label: "5–1" }, { value: "6-2", label: "6–2" }]} onChange={system => onChange({ system })} disabled={disabled} /></Row>
          {showRotation && !primarySelectorInHeader ? rotationControl : null}
          <Row label="SAQUE"><Segments compact={compactWeb} label="Saque" value={config?.serve ?? "Float"} options={[{ value: "Float", label: "Flutuante" }, { value: "Topspin", label: "Com rotação" }]} onChange={serve => onChange({ serve })} disabled={disabled} /></Row>
          <Row label="ALVO"><Segments compact={compactWeb} label="Alvo do saque" value={config?.seam ?? "Left"} options={[{ value: "Left", label: "Esquerda" }, { value: "Right", label: "Direita" }]} onChange={seam => onChange({ seam })} disabled={disabled} /></Row>
        </> : mode === "defense" ? <>
          {onDefensePresetChange && !primarySelectorInHeader ? <Row label="ATAQUE"><Segments<CourtDefensePreset> label="Ataque da defesa" value={courtDefensePreset(config?.preset)} onChange={onDefensePresetChange} disabled={disabled} compact={compactWeb} fullTouchTarget={compactWeb || Platform.OS !== "web"}
            options={COURT_DEFENSE_ATTACKS.map(option => ({ ...option, disabled: unavailableDefensePresets?.includes(option.value) }))} /></Row> : null}
          {onDefenseCoverageChange ? <Row label="COBERTURA"><Segments<CourtDefenseCoverage> label="Sistema de defesa" value={config?.defenseSettings?.coverage} onChange={onDefenseCoverageChange} disabled={disabled} compact={compactWeb} fullTouchTarget={mobile || touch} options={[
            { value: "front", label: "Frontal", accessibilityLabel: "Sistema de defesa: Cobertura frontal", disabled: unavailableDefenseCoverage?.includes("front") },
            { value: "zone1", label: "Posição 1", accessibilityLabel: "Sistema de defesa: Cobertura da posição 1", disabled: unavailableDefenseCoverage?.includes("zone1") },
          ]} /></Row> : null}
          <Text style={{ color: colors.muted, fontSize: compactWeb ? 11 : 12 }}>Organização da defesa até o contato.</Text>
        </> : <>
          <SettingsGroup title="Jogada">
            <Row label="INCLUIR"><View accessibilityLabel="Camadas da simulação" style={[styles.segments, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>{([["attack", "Ataque"], ["pass", "Passe"], ["block", "Bloqueio"]] as const).map(([key, label]) => <Pressable suppressWebHoverFeedback disableWebPressScale key={key} accessibilityRole="button" accessibilityLabel={`Camada ${label.toLowerCase()}`} accessibilityState={{ selected: layers[key], disabled }} aria-pressed={layers[key]} disabled={disabled} onPress={() => onChange({ layers: { ...layers, [key]: !layers[key] } })} style={({ hovered, pressed }) => [styles.segment, compactWeb ? { minHeight: 22 } : mobile && touch ? { minHeight: 36 } : null, { backgroundColor: layers[key] ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}><Text style={{ color: layers[key] ? colors.primaryText : colors.muted, fontSize: compactWeb ? 10 : 12 }}>{label}</Text></Pressable>)}</View></Row>
            <Row label="FORMATO"><Segments compact={compactWeb} label="Formato" value={config?.format ?? "Indoor"} options={[{ value: "Indoor", label: "Quadra" }, { value: "9-man", label: "9 jogadores", disabled: true, accessibilityLabel: "9 jogadores. Em breve" }]} onChange={format => onChange({ format })} disabled={disabled} /></Row>
            {!primarySelectorInHeader ? <Row label="LEVANTAMENTO"><AttackSetPicker preset={preset} attackSettings={attackSettings} onChange={onChange} disabled={disabled} compactWeb={compactWeb} /></Row> : null}
            {layers.attack ? <Row label="CURVA DA CORTADA"><Range key={preset} label="Curva da cortada" value={attackArc} min={.03} max={4} step={.01} onChange={value => onChange({ attackSettings: { ...attackSettings, attackArc: value } })} onReset={() => onChange({ attackSettings: { ...attackSettings, attackArc: null } })} disabled={disabled} formatValue={value => `${value.toFixed(2).replace(".", ",")} m`} onPreview={value => onAttackPreview?.(value === null ? null : { ...attackSettings, attackArc: value }, "curve")} commitOnEnd /></Row> : null}
          </SettingsGroup>
          {layers.block ? <SettingsGroup>
            <Row label="Bloqueio" heading><Segments compact={compactWeb} label="Bloqueadores" value={blockers} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} onChange={value => onChange({ blockers: value as 1 | 2 | 3 })} disabled={disabled} /></Row>
            <Row label="APLICAR A"><Segments<number | "all"> compact={compactWeb} label="Aplicar ângulo das mãos a" value={activeAngleTarget} options={[{ value: "all", label: "Todos" }, ...BLOCKER_IDS.slice(0, blockers).map((value, index) => ({ value, label: String(index + 1) }))]} onChange={setAngleTarget} disabled={disabled} /></Row>
            <Row label="ÂNGULO DAS MÃOS"><Range key={activeAngleTarget} label="Ângulo das mãos do bloqueio" value={angle} min={-65} max={65} step={5} onChange={value => onChange({ attackSettings: withAngle(value) })} disabled={disabled} formatValue={value => `${value}°`} onPreview={value => onAttackPreview?.(value === null ? null : withAngle(value), "block")} commitOnEnd /></Row>
          </SettingsGroup> : null}
        </>}
        <SettingsGroup title="Visualização">
          <Row label="CÂMERA"><Segments compact={compactWeb} label="Visão" value={cameraView} options={[{ value: "front", label: "Frente" }, { value: "side", label: "Lateral" }, { value: "orbit", label: "Livre" }]} onChange={onCameraView} /></Row>
          {onLabelsVisible ? <Row label={mode === "defense" ? "RÓTULOS" : mode === "receive" ? "POSIÇÕES" : "TRAJETÓRIAS"}><Segments compact={compactWeb} label={mode === "defense" ? "Rótulos" : mode === "receive" ? "Posições" : "Trajetórias"} value={labelsVisible ? "show" : "hide"} options={[{ value: "show", label: "Mostrar" }, { value: "hide", label: "Ocultar" }]} onChange={value => onLabelsVisible(value === "show")} /></Row> : null}
        </SettingsGroup>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 2, flexDirection: "row", gap: 6 }}>
          {([["Restaurar ajustes", onRestore], ["Exportar jogada", onShare]] as const).map(([label, onPress]) => <Pressable suppressWebHoverFeedback disableWebPressScale key={label} accessibilityRole="button" accessibilityLabel={label === "Restaurar ajustes" ? "Restaurar simulação" : "Exportar jogada"} disabled={disabled || (label === "Exportar jogada" && exportDisabled)} onPress={() => { if (!disabled && !(label === "Exportar jogada" && exportDisabled)) onPress(); }} style={({ hovered, pressed }) => [styles.panelAction, { borderColor: colors.border, backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled || (label === "Exportar jogada" && exportDisabled) ? 0.55 : 1 }]}><Text numberOfLines={1} style={{ color: colors.text, fontSize: compactWeb ? 10 : touch ? 11 : 12 }}>{label}</Text></Pressable>)}
        </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  modes: { alignSelf: "center", flexDirection: "row", padding: 4, borderWidth: 1, borderRadius: radius.full },
  mode: { minHeight: 34, paddingHorizontal: 12, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  transport: { position: "absolute", alignSelf: "center", zIndex: 25 },
  transportRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconButton: { minWidth: 28, minHeight: 28, paddingHorizontal: 0, gap: 2, borderRadius: radius.full, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  separator: { width: 1, height: 18, marginHorizontal: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 34 },
  segments: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.full, overflow: "hidden", padding: 3 },
  segment: { flex: 1, minWidth: 0, minHeight: 26, paddingHorizontal: 4, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  panelAction: { flex: 1, minWidth: 0, minHeight: 34, paddingHorizontal: 4, borderWidth: 1, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
