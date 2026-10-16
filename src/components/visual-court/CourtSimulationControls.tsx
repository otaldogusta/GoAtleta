import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { CourtSimulation } from "../../core/court-simulation-model";
import { radius, shadow, spacing } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";

type SimulationMode = "receive" | "attack";
type CameraView = "front" | "side" | "orbit";
const ROTATIONS = ["P1", "P6", "P5", "P4", "P3", "P2"] as const;
const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const PRESETS = ["4", "go", "31", "1", "2", "5", "red", "pipe", "bic"];
const PRESET_LABELS: Record<string, string> = { go: "Ponta rápida", red: "Saída rápida", pipe: "Meio-fundo", bic: "Meio-fundo rápido" };
const BLOCKER_IDS = [1, 2, 5];
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));

function Segments<T extends string | number>({ label, options, value, onChange, disabled = false }: {
  label: string; options: readonly { value: T; label: string; disabled?: boolean; accessibilityLabel?: string }[]; value: T;
  onChange: (value: T) => void; disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const touch = Platform.OS !== "web";
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segments, { borderColor: colors.border, backgroundColor: colors.inputBg }]}>
    {options.map(option => <Pressable suppressWebHoverFeedback disableWebPressScale key={option.value} accessibilityRole="radio" accessibilityLabel={option.accessibilityLabel ?? `${label}: ${option.label}`} accessibilityState={{ checked: value === option.value, disabled: disabled || option.disabled }} aria-checked={value === option.value} disabled={disabled || option.disabled} onPress={() => { if (!disabled && !option.disabled) onChange(option.value); }} style={({ hovered, pressed }) => [styles.segment, touch ? { minHeight: 36 } : null, { backgroundColor: value === option.value ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled || option.disabled ? 0.38 : 1 }]}>
      <Text numberOfLines={1} style={{ color: value === option.value ? colors.primaryText : colors.muted, fontSize: 12, fontWeight: touch && value === option.value ? "600" : "400" }}>{option.label}</Text>
    </Pressable>)}
  </View>;
}

function Range({ label, value, min, max, step, onChange, disabled = false, text, onReset, commitOnEnd = false, transport = false }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void;
  disabled?: boolean; text?: string; onReset?: () => void; commitOnEnd?: boolean; transport?: boolean;
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
  useEffect(() => { draftRef.current = null; }, [value, disabled]);
  const chooseValue = (next: number) => {
    if (disabled || !Number.isFinite(next)) return;
    const number = clamp(next, min, max);
    if (commitOnEnd) { draftRef.current = number; setDraft(number); }
    else onChange(number);
  };
  const commit = () => {
    const next = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (!disabled && next !== null && next !== boundedValue) onChange(next);
  };
  const cancel = () => { draftRef.current = null; setDraft(null); };
  if (Platform.OS === "web") return <input
    type="range" min={min} max={max} step={step} value={bounded} disabled={disabled}
    aria-label={label} aria-valuetext={text}
    onChange={(event) => {
      const next = Number(event.currentTarget.value);
      chooseValue(next);
    }}
    onPointerUp={commitOnEnd ? commit : undefined}
    onPointerCancel={commitOnEnd ? cancel : undefined}
    onKeyUp={commitOnEnd ? commit : undefined}
    onBlur={commitOnEnd ? commit : undefined}
    onDoubleClick={onReset}
    style={{ display: "block", width: "100%", minWidth: 0, height: touch ? transport ? 40 : 44 : 14, margin: 0, accentColor: colors.primaryBg, cursor: disabled ? "default" : "ew-resize", opacity: disabled ? 0.55 : 1 }}
  />;
  const choose = (position: number) => {
    chooseValue(clamp(Math.round((min + clamp(position / width, 0, 1) * (max - min)) / step) * step, min, max));
  };
  const fraction = (bounded - min) / (max - min);
  return <View accessibilityRole="adjustable" accessibilityLabel={label} accessibilityState={{ disabled }} accessibilityValue={{ min, max, now: bounded, text }} accessibilityActions={[{ name: "increment" }, { name: "decrement" }]} onAccessibilityAction={event => { if (!disabled) onChange(clamp(bounded + (event.nativeEvent.actionName === "increment" ? step : -step), min, max)); }} onLayout={event => setWidth(event.nativeEvent.layout.width)} onStartShouldSetResponder={() => !disabled} onResponderGrant={event => choose(event.nativeEvent.locationX)} onResponderMove={event => choose(event.nativeEvent.locationX)} onResponderRelease={commitOnEnd ? commit : undefined} onResponderTerminate={commitOnEnd ? cancel : undefined} style={{ height: transport ? 40 : 44, justifyContent: "center", opacity: disabled ? 0.55 : 1 }}>
    <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: colors.border }}><View style={{ height: 4, width: `${fraction * 100}%`, backgroundColor: colors.primaryBg }} /><View style={{ position: "absolute", top: -5, left: `${fraction * 100}%`, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primaryBg }} /></View>
  </View>;
}

function IconButton({ label, icon, onPress, primary = false, disabled = false, children, transport = false }: {
  label: string; icon: GoAtletaIconName; onPress: () => void; primary?: boolean; disabled?: boolean; children?: ReactNode; transport?: boolean;
}) {
  const { colors } = useAppTheme();
  const { width: controlWidth } = useWindowDimensions();
  const touch = Platform.OS !== "web" || (transport && controlWidth <= 700);
  return <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ hovered, pressed }) => [styles.iconButton, { minWidth: primary ? 44 : touch ? 40 : 28, minHeight: touch ? transport ? 40 : 44 : 28, flexShrink: 0, backgroundColor: primary ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}>
    {children}<GoAtletaIcon name={icon} size={touch ? primary ? 18 : 16 : primary ? 12 : 14} color={primary ? colors.primaryText : colors.muted} />
  </Pressable>;
}

export function CourtSimulationModes({ mode, onChange, disabled = false, top = 86, uiScale = 1 }: {
  mode: SimulationMode; onChange: (mode: SimulationMode) => void; disabled?: boolean; top?: number; uiScale?: number;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const touch = Platform.OS !== "web" || width <= 700;
  const compactWeb = Platform.OS === "web" && width <= 700;
  return <View accessibilityLabel="Modo de visualização" style={[styles.modes, compactWeb ? { padding: 3 } : null, { top, transform: [{ scale: uiScale }], transformOrigin: "top center", borderColor: colors.border, backgroundColor: colors.surface }]}>
    {([["receive", "Recepção"], ["attack", "Ataque"]] as const).map(([value, label]) => <Pressable suppressWebHoverFeedback disableWebPressScale key={value} accessibilityRole="tab" accessibilityLabel={label} aria-selected={mode === value} accessibilityState={{ selected: mode === value, disabled }} disabled={disabled} onPress={() => onChange(value)} style={({ hovered, pressed }) => [styles.mode, compactWeb ? { minWidth: 80, minHeight: 28, paddingHorizontal: 16 } : null, value === "receive" ? { minWidth: compactWeb ? 96 : 108 } : null, { backgroundColor: mode === value ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}><Text style={{ color: mode === value ? colors.primaryText : colors.text, fontSize: compactWeb ? 12 : 13, fontWeight: touch && mode === value ? "600" : "400" }}>{label}</Text></Pressable>)}
    <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="tab" accessibilityLabel="Defesa. Em breve" aria-selected={false} accessibilityState={{ disabled: true, selected: false }} disabled style={[styles.mode, compactWeb ? { minWidth: 80, minHeight: 28, paddingHorizontal: 16 } : null, { opacity: 0.38 }]}><Text style={{ color: colors.muted, fontSize: compactWeb ? 12 : 13 }}>Defesa</Text></Pressable>
  </View>;
}

export function CourtSimulationTransport({ playing, progress, speed, rotation, onPlay, onRestart, onPreviousRotation, onNextRotation, onSeek, onSpeed, onOpenSteps, disabled = false, bottom = 20, showRotation = true, uiScale = 1 }: {
  playing: boolean; progress: number; speed: number; rotation: number;
  onPlay: () => void; onRestart: () => void; onPreviousRotation: () => void; onNextRotation: () => void;
  onSeek: (value: number) => void; onSpeed: (value: number) => void; onOpenSteps: () => void;
  disabled?: boolean; bottom?: number; showRotation?: boolean; uiScale?: number;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const compact = width < 460;
  const touch = Platform.OS !== "web" || width <= 700;
  const selectedRotation = Math.floor(clamp(rotation, 0, 5));
  const boundedSpeed = clamp(speed, 0.25, 2);
  const rate = `${boundedSpeed.toFixed(2).replace(/0$/, "").replace(".", ",")}×`;
  const nextSpeed = PLAYBACK_SPEEDS.find(value => value > boundedSpeed) ?? PLAYBACK_SPEEDS[0];
  return <View accessibilityLabel="Reprodução da jogada" style={[styles.transport, { bottom, width: Math.min(440, width - 24), paddingHorizontal: compact ? 4 : 8, paddingVertical: touch ? 0 : 5, transform: [{ scale: uiScale }], transformOrigin: "bottom center", borderColor: colors.border, backgroundColor: colors.surface }, shadow.elevated]}>
    <View style={[styles.transportRow, { gap: compact ? 2 : touch ? 4 : 8 }]}>
      <IconButton transport label={playing ? "Pausar jogada" : "Reproduzir jogada"} icon={playing ? "pause" : "play"} onPress={onPlay} primary disabled={disabled} />
      <IconButton transport label="Voltar ao início da jogada" icon="refresh" onPress={onRestart} disabled={disabled} />
      {showRotation ? touch ? <>
        <IconButton transport label={`Rotação anterior: ${ROTATIONS[(selectedRotation + 5) % 6]}`} icon="chevronBack" onPress={onPreviousRotation} disabled={disabled} />
        <IconButton transport label={`Próxima rotação: ${ROTATIONS[(selectedRotation + 1) % 6]}`} icon="chevronForward" onPress={onNextRotation} disabled={disabled}><Text style={{ fontSize: 11, color: colors.text }}>{ROTATIONS[selectedRotation]}</Text></IconButton>
      </> : <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <IconButton transport label={`Rotação anterior: ${ROTATIONS[(selectedRotation + 5) % 6]}`} icon="chevronBack" onPress={onPreviousRotation} disabled={disabled} />
        <Text style={{ width: 20, textAlign: "center", fontSize: 11, color: colors.text }}>{ROTATIONS[selectedRotation]}</Text>
        <IconButton transport label={`Próxima rotação: ${ROTATIONS[(selectedRotation + 1) % 6]}`} icon="chevronForward" onPress={onNextRotation} disabled={disabled} />
      </View> : null}
      <View style={{ flex: 1, minWidth: 24 }}><Range transport label="Avançar ou voltar na jogada" value={progress} min={0} max={1} step={0.001} onChange={onSeek} disabled={disabled} text={`${Math.round(clamp(progress, 0, 1) * 100)}%`} /></View>
      <View style={[styles.separator, { height: 14, marginHorizontal: compact ? 1 : 2, backgroundColor: colors.border }]} />
      <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel="Velocidade da reprodução" accessibilityValue={{ text: rate }} accessibilityHint={`Alterar para ${String(nextSpeed).replace(".", ",")}×`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) onSpeed(nextSpeed); }} style={({ hovered, pressed }) => [styles.iconButton, { minWidth: 40, minHeight: touch ? 40 : 28, flexShrink: 0, backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}><Text numberOfLines={1} style={{ fontSize: touch ? 11 : 10, color: colors.muted, fontVariant: ["tabular-nums"] }}>{rate}</Text></Pressable>
      <IconButton transport label="Mostrar etapas" icon="list" onPress={onOpenSteps} />
    </View>
  </View>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useAppTheme();
  const touch = Platform.OS !== "web";
  return <View style={[styles.row, !touch ? { gap: 16 } : null]}><Text style={{ flex: touch ? 0.39 : 1, color: colors.muted, fontSize: touch ? 10 : 11, letterSpacing: touch ? 0.5 : 0.6 }}>{label}</Text><View style={touch ? { flex: 0.61, minWidth: 0 } : { width: "60%", minWidth: 0 }}>{children}</View></View>;
}

export function CourtSimulationSettings({ config, mode, onChange, onRestore, onShare, cameraView, onCameraView, labelsVisible = true, onLabelsVisible, disabled = false, attackArcValue = .03, showRotation = mode === "receive" }: {
  config: CourtSimulation | null; mode: SimulationMode; onChange: (patch: Partial<CourtSimulation>) => void;
  onRestore: () => void; onShare: () => void;
  cameraView: CameraView; onCameraView: (view: CameraView) => void; labelsVisible?: boolean; onLabelsVisible?: (value: boolean) => void;
  disabled?: boolean;
  attackArcValue?: number;
  showRotation?: boolean;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [angleTarget, setAngleTarget] = useState<number | "all">("all");
  const mobile = width <= 700;
  const touch = Platform.OS !== "web";
  const blockers = config?.blockers ?? 1;
  const activeAngleTarget = angleTarget !== "all" && !BLOCKER_IDS.slice(0, blockers).includes(angleTarget) ? "all" : angleTarget;
  const attackSettings: CourtSimulation["attackSettings"] = config?.attackSettings ?? { targetOverride: null, hitOverride: null, setHeight: null, passHeight: 2.1, blockAngle: 0, blockAngles: {}, manualBlockers: [] };
  const angle = activeAngleTarget === "all" ? attackSettings.blockAngle : attackSettings.blockAngles[String(activeAngleTarget)] ?? attackSettings.blockAngle;
  const layers = config?.layers ?? { attack: true, pass: true, block: true };
  const preset = config?.preset ?? "4";
  const attackArc = attackSettings.attackArc ?? attackArcValue;
  const curveText = `${attackArc.toFixed(2).replace(".", ",")} m`;
  const choosePreset = (delta: number) => {
    const index = Math.max(0, PRESETS.indexOf(preset));
    onChange({ preset: PRESETS[(index + delta + PRESETS.length) % PRESETS.length], attackSettings: { ...attackSettings, hitOverride: null, setHeight: null, attackArc: null } });
  };
  const rotationControl = <Row label="RODÍZIO"><View accessibilityRole="radiogroup" accessibilityLabel="Rodízio" style={{ flexDirection: "row", gap: touch ? 1 : undefined, justifyContent: touch ? undefined : "space-between" }}>{ROTATIONS.map((label, rotation) => <Pressable suppressWebHoverFeedback disableWebPressScale key={label} accessibilityRole="radio" accessibilityLabel={`Rodízio ${label}`} accessibilityState={{ checked: (config?.rotation ?? 0) === rotation, disabled }} aria-checked={(config?.rotation ?? 0) === rotation} disabled={disabled} onPress={() => onChange({ rotation })} style={({ hovered, pressed }) => ({ flex: touch ? 1 : undefined, width: touch ? undefined : 30, minWidth: 0, height: mobile && touch ? 44 : 30, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: (config?.rotation ?? 0) === rotation ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 })}><Text style={{ color: (config?.rotation ?? 0) === rotation ? colors.primaryText : colors.muted, fontSize: touch ? 10 : 12 }}>{label}</Text></Pressable>)}</View></Row>;
  return <ScrollView accessibilityLabel="Ajustes da jogada" keyboardShouldPersistTaps="handled" style={{ flex: 1, minHeight: 0 }} contentContainerStyle={{ gap: 10, paddingBottom: spacing.sm }}>
        {mode === "attack" ? <Row label="CAMADAS"><View accessibilityLabel="Camadas da simulação" style={[styles.segments, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>{([["attack", "Ataque"], ["pass", "Passe"], ["block", "Bloqueio"]] as const).map(([key, label]) => <Pressable suppressWebHoverFeedback disableWebPressScale key={key} accessibilityRole="button" accessibilityLabel={`Camada ${label.toLowerCase()}`} accessibilityState={{ selected: layers[key], disabled }} aria-pressed={layers[key]} disabled={disabled} onPress={() => onChange({ layers: { ...layers, [key]: !layers[key] } })} style={({ hovered, pressed }) => [styles.segment, mobile && touch ? { minHeight: 36 } : null, { backgroundColor: layers[key] ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}><Text style={{ color: layers[key] ? colors.primaryText : colors.muted, fontSize: 12 }}>{label}</Text></Pressable>)}</View></Row> : null}
        {mode === "attack" && showRotation ? rotationControl : null}
        {mode === "receive" ? <>
          <Row label="SISTEMA"><Segments label="Sistema" value={config?.system ?? "5-1"} options={[{ value: "5-1", label: "5–1" }, { value: "6-2", label: "6–2" }]} onChange={system => onChange({ system })} disabled={disabled} /></Row>
          {showRotation ? rotationControl : null}
          <Row label="SAQUE"><Segments label="Saque" value={config?.serve ?? "Float"} options={[{ value: "Float", label: "Flutuante" }, { value: "Topspin", label: "Com rotação" }]} onChange={serve => onChange({ serve })} disabled={disabled} /></Row>
          <Row label="ALVO"><Segments label="Alvo do saque" value={config?.seam ?? "Left"} options={[{ value: "Left", label: "Esquerda" }, { value: "Right", label: "Direita" }]} onChange={seam => onChange({ seam })} disabled={disabled} /></Row>
        </> : <>
          <Row label="FORMATO"><Segments label="Formato" value={config?.format ?? "Indoor"} options={[{ value: "Indoor", label: "Quadra" }, { value: "9-man", label: "9 jogadores", disabled: true, accessibilityLabel: "9 jogadores. Em breve" }]} onChange={format => onChange({ format })} disabled={disabled} /></Row>
          <Row label="JOGADA"><View style={[styles.segments, { borderColor: colors.border, backgroundColor: colors.inputBg }]}><IconButton label="Jogada anterior" icon="chevronBack" onPress={() => choosePreset(-1)} disabled={disabled} /><Text numberOfLines={1} style={{ flex: 1, minWidth: 0, textAlign: "center", color: colors.text, fontSize: 12 }}>{PRESET_LABELS[preset] ?? preset}</Text><IconButton label="Próxima jogada" icon="chevronForward" onPress={() => choosePreset(1)} disabled={disabled} /></View></Row>
          {layers.attack ? <Row label="CURVA"><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}><Range key={preset} label="Curva do ataque" value={attackArc} min={.03} max={4} step={.01} onChange={value => onChange({ attackSettings: { ...attackSettings, attackArc: value } })} onReset={() => onChange({ attackSettings: { ...attackSettings, attackArc: null } })} disabled={disabled} text={curveText} commitOnEnd /></View><Text style={{ color: colors.muted, minWidth: 38, fontSize: 11 }}>{curveText}</Text></View></Row> : null}
          {layers.block ? <>
            <Row label="BLOQUEADORES"><Segments label="Bloqueadores" value={blockers} options={[{ value: 1, label: "1" }, { value: 2, label: "2" }, { value: 3, label: "3" }]} onChange={value => onChange({ blockers: value as 1 | 2 | 3 })} disabled={disabled} /></Row>
            <Row label="AJUSTAR"><Segments<number | "all"> label="Mãos do bloqueio" value={activeAngleTarget} options={[{ value: "all", label: "Todos" }, ...BLOCKER_IDS.slice(0, blockers).map((value, index) => ({ value, label: String(index + 1) }))]} onChange={setAngleTarget} disabled={disabled} /></Row>
            <Row label="MÃOS"><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}><Range key={activeAngleTarget} label="Ângulo das mãos do bloqueio" value={angle} min={-65} max={65} step={1} onChange={value => onChange({ attackSettings: activeAngleTarget === "all" ? { ...attackSettings, blockAngle: value, blockAngles: {} } : { ...attackSettings, blockAngles: { ...attackSettings.blockAngles, [activeAngleTarget]: value } } })} disabled={disabled} text={`${angle} graus`} commitOnEnd /></View><Text style={{ color: colors.muted, minWidth: 30, fontSize: 11 }}>{angle}°</Text></View></Row>
          </> : null}
        </>}
        <Row label="VISÃO"><Segments label="Visão" value={cameraView} options={[{ value: "front", label: "Frente" }, { value: "side", label: "Lateral" }, { value: "orbit", label: "Livre" }]} onChange={onCameraView} /></Row>
        {onLabelsVisible ? <Row label={mode === "receive" ? "POSIÇÕES" : "TRAJETÓRIAS"}><Segments label={mode === "receive" ? "Posições" : "Trajetórias"} value={labelsVisible ? "show" : "hide"} options={[{ value: "show", label: "Mostrar" }, { value: "hide", label: "Ocultar" }]} onChange={value => onLabelsVisible(value === "show")} /></Row> : null}
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 2, flexDirection: "row", gap: 6 }}>
          {([["Restaurar", onRestore], ["Exportar", onShare]] as const).map(([label, onPress]) => <Pressable suppressWebHoverFeedback disableWebPressScale key={label} accessibilityRole="button" accessibilityLabel={label === "Restaurar" ? "Restaurar simulação" : "Exportar jogada"} disabled={disabled} onPress={onPress} style={({ hovered, pressed }) => [styles.panelAction, { borderColor: colors.border, backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent", opacity: disabled ? 0.55 : 1 }]}><Text numberOfLines={1} style={{ color: colors.text, fontSize: touch ? 11 : 12 }}>{label}</Text></Pressable>)}
        </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  modes: { position: "absolute", alignSelf: "center", flexDirection: "row", padding: 4, borderWidth: 1, borderRadius: radius.full, zIndex: 20 },
  mode: { minWidth: 89, minHeight: 34, paddingHorizontal: 22, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  transport: { position: "absolute", alignSelf: "center", borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 5, zIndex: 25 },
  transportRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconButton: { minWidth: 28, minHeight: 28, paddingHorizontal: 0, gap: 2, borderRadius: radius.full, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  separator: { width: 1, height: 18, marginHorizontal: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 34 },
  segments: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.full, overflow: "hidden", padding: 3 },
  segment: { flex: 1, minWidth: 0, minHeight: 26, paddingHorizontal: 4, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  panelAction: { flex: 1, minWidth: 0, minHeight: 34, paddingHorizontal: 4, borderWidth: 1, borderRadius: radius.full, overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
