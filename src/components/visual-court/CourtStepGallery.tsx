import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent, type ViewStyle } from "react-native";
import type { CourtVisualPayload } from "../../core/visual-court";
import { spacing } from "../../theme/tokens";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { CourtEditorScene } from "./CourtEditorScene";

type Props = {
  payload: CourtVisualPayload;
  stepIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  compact?: boolean;
  headerActions?: ReactNode;
};

const Preview = memo(function Preview({ payload, index }: { payload: CourtVisualPayload; index: number }) {
  return <View pointerEvents="none" aria-hidden accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.preview}>
    <CourtEditorScene payload={payload} stepIndex={index} landscape progress={0} />
  </View>;
});

/** Uses the existing court-step drag protocol; the parent still owns reordering. */
function DraggableStepFrame({ index, active, over, disabled, onDragState, onMove, onLayout, width, children }: {
  index: number; active: boolean; over: boolean; disabled: boolean;
  onDragState: (dragged: number | null | undefined, target?: number | null) => void;
  onMove: (from: number, to: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  width: ViewStyle["width"]; children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const ref = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || disabled) return;
    const node = ref.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;
    node.draggable = true;
    const start = (event: DragEvent) => {
      event.dataTransfer?.setData("application/x-goatleta-court-step", String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      onDragState(index, index);
    };
    const enter = (event: DragEvent) => { event.preventDefault(); onDragState(undefined, index); };
    const dragOver = (event: DragEvent) => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = "move"; };
    const drop = (event: DragEvent) => {
      event.preventDefault();
      const source = event.dataTransfer?.getData("application/x-goatleta-court-step");
      if (source?.trim()) onMove(Number(source), index);
      onDragState(null, null);
    };
    const end = () => onDragState(null, null);
    node.addEventListener("dragstart", start); node.addEventListener("dragenter", enter); node.addEventListener("dragover", dragOver); node.addEventListener("drop", drop); node.addEventListener("dragend", end);
    return () => { node.draggable = false; node.removeEventListener("dragstart", start); node.removeEventListener("dragenter", enter); node.removeEventListener("dragover", dragOver); node.removeEventListener("drop", drop); node.removeEventListener("dragend", end); };
  }, [index, disabled, onDragState, onMove]);
  return <View ref={ref} testID={`court-step-drag-${index}`} onLayout={onLayout} style={[styles.stepFrame, { width }, over && !active ? { transform: [{ translateY: -4 }], borderColor: colors.primaryBg } : null, active ? { opacity: .5, transform: [{ scale: .96 }] } : null, Platform.OS === "web" ? { cursor: disabled ? "default" : "grab", transition: "transform 160ms ease, opacity 160ms ease, border-color 160ms ease" } as unknown as ViewStyle : null]}>{children}</View>;
}

/** A single vertical inspector gallery, independent from the playback controls. */
export function CourtStepGallery({ payload, stepIndex, onSelect, onAdd, onMove, disabled = false, readOnly = false, compact = false, headerActions }: Props) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const compactWeb = compact && Platform.OS === "web" && width <= 700;
  const steps = payload.timeline.steps, current = Math.max(0, Math.min(steps.length - 1, Number.isFinite(stepIndex) ? Math.floor(stepIndex) : 0));
  const [gridWidth, setGridWidth] = useState(0), [dragged, setDragged] = useState<number | null>(null), [dragOver, setDragOver] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null), viewport = useRef(0), offset = useRef(0);
  const layouts = useRef(new Map<string, { y: number; height: number }>());
  const selectedId = steps[current]?.id, pendingReveal = useRef<string | undefined>(selectedId);
  const gap = compactWeb ? 6 : spacing.xs, cardWidth: ViewStyle["width"] = gridWidth > 0 ? Math.max(0, (gridWidth - gap) / 2) : "48%";
  const revealSelection = useCallback((animated: boolean) => {
    const id = pendingReveal.current, bounds = id ? layouts.current.get(id) : undefined;
    if (!bounds || viewport.current <= 0 || bounds.height <= 0) return;
    const top = bounds.y, bottom = bounds.y + bounds.height;
    const target = top < offset.current ? top : bottom > offset.current + viewport.current ? bottom - viewport.current : offset.current;
    if (Math.abs(target - offset.current) > .5) { offset.current = Math.max(0, target); scroll.current?.scrollTo({ y: offset.current, animated }); }
    pendingReveal.current = undefined;
  }, []);
  useLayoutEffect(() => { pendingReveal.current = selectedId; revealSelection(true); }, [selectedId, revealSelection]);
  const choose = (index: number) => { if (!disabled && index >= 0 && index < steps.length) onSelect(index); };
  const updateDrag = useCallback((from: number | null | undefined, to?: number | null) => { if (from !== undefined) setDragged(from); if (to !== undefined) setDragOver(to); }, []);
  const move = useCallback((from: number, to: number) => {
    if (!disabled && !readOnly && Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to >= 0 && from < steps.length && to < steps.length && from !== to) onMove(from, to);
  }, [disabled, readOnly, onMove, steps.length]);
  return <View style={styles.gallery}>
    <View style={styles.header}>
      <Text accessibilityLiveRegion="polite" style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: compactWeb ? 11 : 12, fontWeight: "600" }}>{`Etapa ${steps.length ? current + 1 : 0} de ${steps.length}`}</Text>
      {([[-1, "Etapa anterior", "chevronBack"], [1, "Próxima etapa", "chevronForward"]] as const).map(([direction, label, icon]) => {
        const unavailable = disabled || !steps.length || current + direction < 0 || current + direction >= steps.length;
        return <Pressable key={label} suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={label} disabled={unavailable} onPress={() => choose(current + direction)} style={({ hovered, pressed }) => [styles.headerButton, { minHeight: compactWeb ? 28 : compact ? 34 : 44, minWidth: compactWeb ? 28 : compact ? 34 : 44, opacity: unavailable ? .4 : 1, backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" }]}><GoAtletaIcon name={icon} size={compactWeb ? 14 : 18} color={colors.text} /></Pressable>;
      })}
      {headerActions}
    </View>
    <ScrollView ref={scroll} accessibilityLabel="Etapas da jogada" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator style={styles.scroll} contentContainerStyle={{ paddingBottom: gap }} scrollEventThrottle={16} onLayout={event => { viewport.current = event.nativeEvent.layout.height; revealSelection(false); }} onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} onContentSizeChange={() => revealSelection(false)}>
      <View style={[styles.grid, { gap }]} onLayout={event => { const width = event.nativeEvent.layout.width; setGridWidth(previous => Math.abs(previous - width) > .5 ? width : previous); }}>
        {steps.map((step, index) => <DraggableStepFrame key={step.id} index={index} active={dragged === index} over={dragOver === index} disabled={disabled || readOnly} width={cardWidth} onDragState={updateDrag} onMove={move} onLayout={event => { const { y, height } = event.nativeEvent.layout; layouts.current.set(step.id, { y, height }); revealSelection(false); }}>
          <Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel={`Etapa ${index + 1}: ${step.label}.${readOnly ? "" : " Arraste para reordenar."}`} accessibilityState={{ selected: index === current }} disabled={disabled} onPress={() => choose(index)} style={({ hovered, pressed }) => [styles.card, { borderColor: index === current ? colors.primaryBg : colors.border, backgroundColor: index === current ? colors.secondaryBg : hovered || pressed ? colors.inputBg : "transparent", opacity: disabled ? .55 : 1 }]}>
            <Preview payload={payload} index={index} />
            <View style={[styles.caption, compactWeb ? { padding: 6 } : null]}><Text numberOfLines={2} style={[styles.label, compactWeb ? { minHeight: 26, fontSize: 10, lineHeight: 13 } : null, { color: colors.text }]}>{`${index + 1}. ${step.label}`}</Text><Text style={{ color: colors.muted, fontSize: compactWeb ? 9 : 11 }}>{`${(Math.max(0, step.durationMs) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`}</Text></View>
          </Pressable>
        </DraggableStepFrame>)}
        <View style={[styles.stepFrame, { width: cardWidth }]}><Pressable suppressWebHoverFeedback disableWebPressScale accessibilityRole="button" accessibilityLabel="Adicionar etapa vazia ao final" disabled={disabled || readOnly} onPress={() => { if (!disabled && !readOnly) onAdd(); }} style={({ hovered, pressed }) => [styles.card, { borderColor: colors.border, backgroundColor: hovered || pressed ? colors.secondaryBg : colors.inputBg, opacity: disabled ? .55 : 1 }]}>
          <View style={[styles.preview, { alignItems: "center", justifyContent: "center" }]}><GoAtletaIcon name="add" size={compactWeb ? 20 : 26} color={colors.primaryBg} /></View><View style={[styles.caption, compactWeb ? { padding: 6 } : null]}><Text numberOfLines={2} style={[styles.label, compactWeb ? { minHeight: 26, fontSize: 10, lineHeight: 13 } : null, { color: colors.text }]}>Adicionar etapa</Text><Text style={{ color: colors.muted, fontSize: compactWeb ? 9 : 11 }}>Ao final da jogada</Text></View>
        </Pressable></View>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  gallery: { flex: 1, minHeight: 0, gap: spacing.xs },
  header: { flexDirection: "row", alignItems: "center", gap: 2 },
  headerButton: { borderRadius: 999, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1, minHeight: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap", alignItems: "stretch" },
  stepFrame: { position: "relative", borderWidth: 1, borderColor: "transparent", borderRadius: 12 },
  card: { width: "100%", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  preview: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden" },
  caption: { padding: spacing.xs, gap: 2 },
  label: { minHeight: 32, fontSize: 12, lineHeight: 16, fontWeight: "600" },
});
