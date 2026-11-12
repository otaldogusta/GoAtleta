import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, PanResponder, Platform, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { resolveCourtLayers, type CourtLayerRef } from "../../core/court-layers";
import { frameDrawings, type DrawingKind } from "../../core/visual-court-editor";
import type { CourtVisualPayload } from "../../core/visual-court";
import { compactUiMetrics, motion, radius, shadow, spacing, zIndex } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { CourtToolIcon, type CourtActionIcon } from "./CourtEditorControls";

type LayerItem = { ref: CourtLayerRef; label: string; displayLabel: string; icon: CourtActionIcon; color: string; locked: boolean; hidden: boolean; groupHidden: boolean };
type Props = {
  payload: CourtVisualPayload; stepIndex: number; selected: string[];
  onSelect: (ref: CourtLayerRef) => void;
  /** Destination is the final index in the canonical back-to-front order. */
  onMove: (ref: CourtLayerRef, destinationIndex: number) => void;
  onSetHidden: (ref: CourtLayerRef, hidden: boolean) => void;
  onSetLocked: (ref: CourtLayerRef, locked: boolean) => void;
  disabled?: boolean; readOnly?: boolean; perspective?: boolean; visualScale?: number; onView2D: () => void; onContentHeight?: (height: number) => void;
};
const keyOf = (ref: CourtLayerRef) => `${ref.kind}:${ref.id}`;
const DRAWINGS: Record<DrawingKind, { label: string; icon: CourtActionIcon }> = {
  arrow: { label: "Seta", icon: "courtArrow" }, curve: { label: "Curva", icon: "courtCurve" }, pen: { label: "Desenho", icon: "pencil" },
  area: { label: "Área", icon: "courtArea" }, text: { label: "Texto", icon: "courtText" }, ball: { label: "Bola", icon: "courtBall" },
  cone: { label: "Cone", icon: "courtCone" }, target: { label: "Alvo", icon: "courtTarget" }, ladder: { label: "Escada", icon: "courtLadder" },
};

function LayerHandle({ label, disabled, dragging, onStart, onMove, onEnd, onStep }: {
  label: string; disabled: boolean; dragging: boolean; onStart: () => void; onMove: (dy: number) => void; onEnd: (canceled: boolean) => void; onStep: (direction: number) => void;
}) {
  const { colors } = useAppTheme();
  const host = useRef<View>(null);
  const live = useRef({ disabled, onStart, onMove, onEnd, onStep });
  useLayoutEffect(() => { live.current = { disabled, onStart, onMove, onEnd, onStep }; });
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = host.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    let pointer: { id: number; y: number } | null = null;
    const finish = (canceled: boolean) => { if (!pointer) return; pointer = null; live.current.onEnd(canceled); };
    const down = (event: PointerEvent) => {
      if (live.current.disabled || event.button !== 0 || pointer) return;
      event.preventDefault(); event.stopPropagation(); node.querySelector<HTMLElement>('[role="button"]')?.focus();
      pointer = { id: event.pointerId, y: event.clientY };
      node.setPointerCapture(event.pointerId); live.current.onStart();
    };
    const move = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      event.preventDefault(); live.current.onMove(event.clientY - pointer.y);
    };
    const up = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (event.type !== "pointercancel") live.current.onMove(event.clientY - pointer.y);
      finish(event.type === "pointercancel");
    };
    const cancel = () => finish(true);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pointer) { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (["ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); event.stopPropagation();
        if (!live.current.disabled && !pointer) live.current.onStep(event.key === "ArrowUp" ? -1 : 1);
      }
    };
    node.addEventListener("pointerdown", down); node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up); node.addEventListener("pointercancel", up);
    node.addEventListener("lostpointercapture", cancel); node.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      node.removeEventListener("pointerdown", down); node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up); node.removeEventListener("pointercancel", up);
      node.removeEventListener("lostpointercapture", cancel); node.removeEventListener("keydown", key); window.removeEventListener("blur", cancel);
    };
  }, []);
  /* eslint-disable react-hooks/refs -- handlers read the latest callbacks only when a gesture fires. */
  const [native] = useState(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled,
    onPanResponderGrant: () => live.current.onStart(),
    onPanResponderMove: (_, gesture) => live.current.onMove(gesture.dy),
    onPanResponderRelease: (_, gesture) => { live.current.onMove(gesture.dy); live.current.onEnd(false); },
    onPanResponderTerminate: () => live.current.onEnd(true),
  }));
  /* eslint-enable react-hooks/refs */
  return <View ref={host} testID={`court-layer-handle-${label}`}><Pressable {...(Platform.OS === "web" ? {} : native.panHandlers)} suppressWebHoverFeedback disableWebPressScale
    accessibilityRole="button" accessibilityLabel={`Reordenar ${label}`} accessibilityHint="Arraste para cima ou para baixo. No teclado, use as setas."
    accessibilityState={{ disabled }} disabled={disabled} onPress={() => { if (!disabled) { onStart(); onEnd(true); } }}
    style={[styles.handle, { opacity: disabled ? .4 : 1 }, Platform.OS === "web" ? { touchAction: "none", cursor: disabled ? "default" : dragging ? "grabbing" : "grab" } as unknown as ViewStyle : null]}>
    <GoAtletaIcon name="align" size={compactUiMetrics.iconSize} color={colors.muted} />
  </Pressable></View>;
}

function LayerMotion({ id, active, dragging, displacement, dragY, reduceMotion, style, children }: {
  id: string; active: boolean; dragging: boolean; displacement: number; dragY: Animated.Value; reduceMotion: boolean; style: ViewStyle[]; children: ReactNode;
}) {
  const [shiftY] = useState(() => new Animated.Value(0));
  useLayoutEffect(() => {
    // Direct manipulation never eases behind the finger; only neighboring rows animate.
    if (!active || dragging || reduceMotion) { shiftY.setValue(displacement); return; }
    const animation = Animated.timing(shiftY, { toValue: displacement, duration: motion.durationFast, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [active, dragging, displacement, reduceMotion, shiftY]);
  return <Animated.View testID={`court-layer-motion-${id}`} style={[...style, { transform: [{ translateY: dragging ? dragY : shiftY }] }]}>{children}</Animated.View>;
}

type Drag = { key: string; ref: CourtLayerRef; from: number; to: number; dy: number; moved: boolean; offset: number; centers: number[]; tops: number[]; heights: number[]; payload: CourtVisualPayload; stepId: string };
export function CourtLayersPanel({ payload, stepIndex, selected, onSelect, onMove, onSetHidden, onSetLocked, disabled = false, readOnly = false, perspective = false, visualScale = 1, onView2D, onContentHeight }: Props) {
  const { colors } = useAppTheme();
  const root = useRef<View>(null), scroll = useRef<ScrollView>(null);
  const offset = useRef(0), viewport = useRef(0), contentHeight = useRef(0);
  const introHeight = useRef(0), footerHeight = useRef(0);
  const layouts = useRef(new Map<string, { y: number; height: number }>());
  const rowNodes = useRef(new Map<string, View>());
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dragY] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const blocked = disabled || readOnly;
  const items = useMemo<LayerItem[]>(() => {
    const drawings = frameDrawings(payload, stepIndex);
    return resolveCourtLayers(payload, stepIndex).reverse().map(ref => {
      if (ref.kind === "actor") {
        const actor = payload.actors.find(item => item.id === ref.id)!;
        const team = payload.editor?.actorMeta[ref.id]?.team;
        const displayLabel = `${actor.label || actor.number || "Jogador"}${team ? ` · ${team}` : ""}`;
        return { ref, label: `Jogador ${actor.label || actor.number || "sem rótulo"}${team ? ` · ${team}` : ""}`, displayLabel, icon: "profile", color: actor.color ?? colors.text,
          locked: Boolean(payload.editor?.actorMeta[ref.id]?.locked), hidden: Boolean(payload.editor?.actorMeta[ref.id]?.hidden), groupHidden: Boolean(payload.editor?.hiddenLayers.includes("actors")) };
      }
      const drawing = drawings.find(item => item.id === ref.id)!;
      const kind = DRAWINGS[drawing.kind];
      const peers = drawings.filter(item => item.kind === drawing.kind);
      const label = `${kind.label}${peers.length > 1 ? ` ${peers.findIndex(item => item.id === drawing.id) + 1}` : ""}`;
      const displayLabel = drawing.kind === "text" && drawing.text ? `${label}: ${drawing.text}` : label;
      return { ref, label: displayLabel, displayLabel, icon: kind.icon, color: drawing.color,
        locked: Boolean(drawing.locked), hidden: Boolean(drawing.hidden), groupHidden: Boolean(payload.editor?.hiddenLayers.includes("drawings")) };
    });
  }, [payload, stepIndex, colors.text]);
  const stepId = payload.timeline.steps[stepIndex]?.id;
  const latest = useRef({ payload, stepId, blocked, items, onMove, onSelect });
  useLayoutEffect(() => { latest.current = { payload, stepId, blocked, items, onMove, onSelect }; });
  if (drag && (drag.payload !== payload || drag.stepId !== stepId || blocked)) setDrag(null);
  const resetDrag = useCallback(() => { dragRef.current = null; dragY.setValue(0); }, [dragY]);
  useLayoutEffect(resetDrag, [payload, stepId, blocked, resetDrag]);
  const finish = useCallback((canceled: boolean) => {
    const current = dragRef.current;
    resetDrag();
    setDrag(null);
    if (current?.moved && !canceled && !latest.current.blocked && current.payload === latest.current.payload && current.stepId === latest.current.stepId && current.from !== current.to)
      latest.current.onMove(current.ref, latest.current.items.length - 1 - current.to);
  }, [resetDrag]);
  const updateTarget = useCallback(() => {
    const current = dragRef.current; if (!current) return;
    const displacement = current.dy + offset.current - current.offset;
    dragY.setValue(displacement);
    const y = current.centers[current.from] + displacement;
    const to = current.centers.reduce((best, center, index) => Math.abs(center - y) < Math.abs(current.centers[best] - y) ? index : best, current.from);
    if (to !== current.to) { current.to = to; setDrag({ ...current }); }
  }, [dragY]);
  const isDragging = Boolean(drag);
  useEffect(() => {
    if (!isDragging) return;
    const timer = setInterval(() => {
      const current = dragRef.current; if (!current?.moved || viewport.current <= 0) return;
      const pointerY = current.centers[current.from] + current.dy - current.offset;
      const delta = pointerY < 24 ? -12 : pointerY > viewport.current - 24 ? 12 : 0;
      const next = Math.max(0, Math.min(contentHeight.current - viewport.current, offset.current + delta));
      if (next !== offset.current) { offset.current = next; scroll.current?.scrollTo({ y: next, animated: false }); updateTarget(); }
    }, 48);
    return () => clearInterval(timer);
  }, [isDragging, updateTarget]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = root.current as unknown as HTMLElement | null;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { if (dragRef.current) { event.stopPropagation(); finish(true); } return; }
      // A focused layer control must not move/delete a player via canvas shortcuts.
      if (!(event.ctrlKey || event.metaKey)) event.stopPropagation();
    };
    node?.addEventListener?.("keydown", key);
    return () => node?.removeEventListener?.("keydown", key);
  }, [finish]);
  const start = (item: LayerItem, from: number) => {
    if (blocked || item.locked || !stepId) return;
    // RN Web's layout observer need not fire when only the DOM order changes.
    // Measure the current order on web; native uses current-order heights, never cached y by id.
    const bounds = Platform.OS === "web" ? items.map(entry => (rowNodes.current.get(keyOf(entry.ref)) as unknown as HTMLElement | undefined)?.getBoundingClientRect?.()) : [];
    let y = 0;
    const measured = bounds.length === items.length && bounds.every(rect => rect && rect.height > 0);
    const heights = items.map((entry, index) => measured ? bounds[index]!.height / visualScale : layouts.current.get(keyOf(entry.ref))?.height ?? 48);
    const tops = items.map((_, index) => { const top = measured ? (bounds[index]!.top - bounds[0]!.top) / visualScale : y; y += heights[index] + spacing.xs / 2; return top; });
    const centers = tops.map((top, index) => top + heights[index] / 2);
    const next: Drag = { key: keyOf(item.ref), ref: item.ref, from, to: from, dy: 0, moved: false, offset: offset.current, centers, tops, heights, payload, stepId };
    dragY.setValue(0);
    dragRef.current = next; setDrag(next); onSelect(item.ref);
  };
  const shift = (ref: CourtLayerRef, direction: number) => {
    const from = items.findIndex(item => keyOf(item.ref) === keyOf(ref)), to = from + direction;
    if (!blocked && from >= 0 && !items[from].locked && to >= 0 && to < items.length) { onSelect(ref); onMove(ref, items.length - 1 - to); }
  };
  const activeIndex = items.findIndex(item => selected.includes(item.ref.id));
  const active = items[activeIndex];
  const reportSize = () => {
    if (introHeight.current > 0 && contentHeight.current > 0 && (!items.length || footerHeight.current > 0))
      onContentHeight?.(introHeight.current + contentHeight.current + (items.length ? footerHeight.current : 0) + spacing.xs * (items.length ? 2 : 1));
  };
  return <View ref={root} style={styles.panel}>
    <View style={styles.intro} onLayout={event => { introHeight.current = event.nativeEvent.layout.height; reportSize(); }}>
      <Text accessibilityLiveRegion="polite" style={[styles.caption, { color: colors.muted }]}>{drag ? `Solte na posição ${drag.to + 1} de ${items.length}` : perspective ? "A ordem vale no 2D. O 3D mantém a profundidade." : "No topo da lista = à frente na quadra."}</Text>
      {perspective ? <Pressable accessibilityRole="button" accessibilityLabel="Ver camadas na Quadra 2D" onPress={onView2D} style={styles.viewButton}><Text style={[styles.label, { color: colors.primaryBg }]}>Ver em 2D</Text></Pressable> : null}
    </View>
    {items.length ? <ScrollView ref={scroll} accessibilityLabel="Camadas da etapa, da frente para o fundo" showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" scrollEnabled={!drag}
      style={styles.scroll} contentContainerStyle={{ padding: 2 }} scrollEventThrottle={16}
      onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; if (dragRef.current?.moved) updateTarget(); }} onLayout={event => { viewport.current = event.nativeEvent.layout.height; }} onContentSizeChange={(_, height) => { contentHeight.current = height; reportSize(); }}>
      <View style={{ gap: spacing.xs / 2 }}>
        {drag?.moved ? <View testID="court-layer-drag-origin" pointerEvents="none" style={[styles.placeholder, { top: drag.tops[drag.from], height: drag.heights[drag.from], backgroundColor: colors.inputBg, borderColor: colors.border }]} /> : null}
        {drag?.moved ? <View testID="court-layer-drop-target" pointerEvents="none" style={[styles.placeholder, { top: drag.tops[drag.to] + (drag.to > drag.from ? drag.heights[drag.to] - drag.heights[drag.from] : 0), height: drag.heights[drag.from], backgroundColor: colors.secondaryBg, borderColor: colors.primaryBg }]} /> : null}
        {items.map(item => {
        const key = keyOf(item.ref), selectedItem = selected.includes(item.ref.id), from = items.findIndex(entry => keyOf(entry.ref) === key);
        const activeDrag = Boolean(drag?.moved), dragging = activeDrag && drag?.key === key;
        const displacement = drag?.moved && from !== drag.from
          ? (drag.from < from && from <= drag.to ? -1 : drag.to <= from && from < drag.from ? 1 : 0) * (drag.heights[drag.from] + spacing.xs / 2) : 0;
        return <View key={key} ref={node => { if (node) rowNodes.current.set(key, node); else rowNodes.current.delete(key); }} testID={`court-layer-${key}`} onLayout={event => { const { y, height } = event.nativeEvent.layout; if (!dragRef.current) layouts.current.set(key, { y, height }); }}
          style={{ zIndex: dragging ? zIndex.raised : zIndex.base }}>
          <LayerMotion id={key} active={activeDrag} dragging={dragging} displacement={displacement} dragY={dragY} reduceMotion={reduceMotion}
            style={[styles.row, dragging ? shadow.elevated : shadow.none, { backgroundColor: dragging ? colors.inputBg : selectedItem ? colors.secondaryBg : "transparent", borderColor: dragging ? colors.primaryBg : selectedItem ? colors.border : "transparent" }]}>
          <LayerHandle label={item.label} disabled={blocked || item.locked} dragging={dragging} onStart={() => start(item, from)} onMove={dy => { if (dragRef.current) { const current = dragRef.current, wasMoved = current.moved; current.dy = dy / visualScale; current.moved ||= Math.abs(current.dy) >= 5; if (current.moved) { if (!wasMoved) setDrag({ ...current }); updateTarget(); } } }} onEnd={finish} onStep={direction => shift(item.ref, direction)} />
          <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={`Selecionar camada ${item.label}${item.locked ? ", bloqueada" : ""}${item.hidden || item.groupHidden ? ", oculta" : ""}`} accessibilityState={{ selected: selectedItem, disabled: blocked }} disabled={blocked} onPress={() => { if (!blocked) onSelect(item.ref); }}
            style={({ hovered, pressed }) => [styles.select, { backgroundColor: hovered || pressed ? colors.inputBg : "transparent" }]}>
            <CourtToolIcon name={item.icon} color={item.color} size={compactUiMetrics.iconSize} />
            <Text numberOfLines={1} style={[styles.label, { flex: 1, color: colors.text, opacity: item.hidden || item.groupHidden ? .6 : 1 }]}>{item.displayLabel}</Text>
          </Pressable>
          <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={`${item.hidden ? "Mostrar" : "Ocultar"} camada ${item.label}`}
            accessibilityHint={item.groupHidden ? `O grupo ${item.ref.kind === "actor" ? "Jogadores" : "Desenhos e materiais"} está oculto nos ajustes.` : undefined}
            accessibilityState={{ selected: item.hidden, disabled: blocked || Boolean(drag) }} disabled={blocked || Boolean(drag)}
            onPress={() => { if (!blocked && !dragRef.current) onSetHidden(item.ref, !item.hidden); }}
            style={({ hovered, pressed }) => [styles.layerToggle, { opacity: blocked ? .4 : 1, backgroundColor: hovered || pressed ? colors.inputBg : "transparent" }]}>
            <GoAtletaIcon name={item.hidden ? "eyeOff" : "view"} size={compactUiMetrics.iconSize} color={item.hidden ? colors.muted : colors.text} />
          </Pressable>
          <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={`${item.locked ? "Desbloquear" : "Bloquear"} camada ${item.label}`}
            accessibilityState={{ selected: item.locked, disabled: blocked || Boolean(drag) }} disabled={blocked || Boolean(drag)}
            onPress={() => { if (!blocked && !dragRef.current) onSetLocked(item.ref, !item.locked); }}
            style={({ hovered, pressed }) => [styles.layerToggle, { opacity: blocked ? .4 : 1, backgroundColor: hovered || pressed ? colors.inputBg : "transparent" }]}>
            <GoAtletaIcon name={item.locked ? "lock" : "unlock"} size={compactUiMetrics.iconSize} color={item.locked ? colors.primaryBg : colors.muted} />
          </Pressable>
          </LayerMotion>
        </View>;
      })}</View>
    </ScrollView> : <Text onLayout={event => { contentHeight.current = event.nativeEvent.layout.height; reportSize(); }} style={[styles.caption, { color: colors.muted }]}>Esta etapa não tem jogadores ou objetos.</Text>}
    {items.length ? <View style={[styles.actions, { borderTopColor: colors.border }]} onLayout={event => { footerHeight.current = event.nativeEvent.layout.height; reportSize(); }}>
      {([[-1, "Mover camada para frente", "Frente", "chevronUp"], [1, "Mover camada para trás", "Trás", "chevronDown"]] as const).map(([direction, label, text, icon]) => {
        const unavailable = blocked || !active || active.locked || Boolean(drag) || activeIndex + direction < 0 || activeIndex + direction >= items.length;
        return <Pressable key={label} suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: unavailable }} disabled={unavailable} onPress={() => { if (active) shift(active.ref, direction); }}
          style={({ hovered, pressed }) => [styles.action, { opacity: unavailable ? .4 : 1, backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" }]}><GoAtletaIcon name={icon} size={16} color={colors.text} /><Text style={[styles.label, { color: colors.text }]}>{text}</Text></Pressable>;
      })}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { flex: 1, minHeight: 0, gap: spacing.xs }, intro: { gap: spacing.xs / 2 }, caption: { fontSize: 11, lineHeight: 16 }, label: { fontSize: 12, lineHeight: 18 },
  scroll: { flex: 1, minHeight: 0 }, row: { minHeight: 48, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: radius.internal },
  placeholder: { position: "absolute", left: 0, right: 0, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.internal },
  handle: { width: compactUiMetrics.touchTarget, minHeight: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center" },
  select: { flex: 1, minWidth: 0, minHeight: compactUiMetrics.touchTarget, flexDirection: "row", gap: spacing.xs / 2, alignItems: "center", paddingHorizontal: spacing.xs / 2, borderRadius: radius.internal },
  layerToggle: { width: compactUiMetrics.touchTarget, minWidth: compactUiMetrics.touchTarget, minHeight: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center", borderRadius: radius.internal },
  actions: { flexDirection: "row", gap: spacing.xs, borderTopWidth: 1, paddingTop: spacing.xs / 2 },
  action: { flex: 1, minHeight: compactUiMetrics.touchTarget, borderRadius: radius.internal, flexDirection: "row", gap: spacing.xs, alignItems: "center", justifyContent: "center" },
  viewButton: { minHeight: compactUiMetrics.touchTarget, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: spacing.xs },
});
