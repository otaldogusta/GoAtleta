import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { editorId } from "../../core/visual-court-editor";
import { buildCourtPerspectiveFrame } from "../../core/visual-court-perspective";
import { useAppTheme } from "../../ui/app-theme";
import { parseCourtPerspectiveCommand } from "./court-perspective-bridge";
import type { CourtPerspectiveCanvasProps } from "./CourtPerspectiveCanvas.types";

const CHANNEL = "goatleta-court-3d";

/** A rendering surface only: the workspace owns the document, gestures and history. */
export function CourtPerspectiveCanvas(props: CourtPerspectiveCanvasProps) {
  const { colors } = useAppTheme();
  const iframe = useRef<HTMLIFrameElement>(null);
  const [token] = useState(editorId);
  const live = useRef(props);
  const context = useRef({ payload: props.payload, stepIndex: props.stepIndex, revision: 0 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  const [bounds, setBounds] = useState({ width: 1, height: 1 });
  const frame = useMemo(() => buildCourtPerspectiveFrame(props.payload, props.stepIndex, props.progress ?? 0, props.selected), [props.payload, props.stepIndex, props.progress, props.selected]);
  const outgoing = useRef<object | null>(null);
  const sendFrame = useCallback(() => {
    if (outgoing.current) iframe.current?.contentWindow?.postMessage(outgoing.current, window.location.origin);
  }, []);
  useLayoutEffect(() => {
    const previous = context.current;
    const changed = previous.payload !== props.payload || previous.stepIndex !== props.stepIndex;
    const revision = previous.revision + Number(changed);
    // Publish one committed snapshot before browser messages can dispatch a
    // gesture. An interrupted render never advances the protocol revision.
    live.current = props;
    context.current = { payload: props.payload, stepIndex: props.stepIndex, revision };
    outgoing.current = {
      channel: CHANNEL, version: 1, type: "frame", token, revision,
      frame, active: props.active, tool: props.tool, motionMode: props.motionMode,
      grid: props.grid, disabled: Boolean(props.disabled), multiple: Boolean(props.multiple),
      color: props.color, dashed: props.dashed, zoom: props.zoom,
      cameraView: props.cameraView, cameraReset: props.cameraReset, half: props.half, plain: props.plain, landscape: props.landscape,
      simulationHandles: Boolean(props.onSimulationHandle), allowServeHandle: Boolean(props.allowServeHandle),
    };
  }, [props, frame, token]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframe.current?.contentWindow) return;
      const value = event.data;
      if (!value || value.channel !== CHANNEL || value.version !== 1) return;
      if (value.type === "ready") { setReady(true); setFailed(false); sendFrame(); return; }
      if (value.type === "error") { setFailed(true); return; }
      if (value.token !== token || value.revision !== context.current.revision || !live.current.active) return;
      if (value.type === "selection-anchor") {
        const point = value.anchor;
        if (!point) setAnchor(null);
        else if (Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) < 20000 && Math.abs(point.y) < 20000) setAnchor({ x: point.x, y: point.y });
        return;
      }
      const p = live.current;
      const command = parseCourtPerspectiveCommand(value, { token, revision: context.current.revision, payload: p.payload, stepIndex: p.stepIndex, disabled: Boolean(p.disabled), allowServeHandle: Boolean(p.allowServeHandle), tool: p.tool });
      if (!command) return;
      if (command.type === "select") p.onSelect(command.ids);
      else if (command.type === "move") p.onMove(command.ids, command.delta, command.path, command.duplicate);
      else if (command.type === "draw") p.onDraw({ ...command.drawing, id: editorId() });
      else if (command.type === "add-player") p.onAddPlayer(command.point);
      else if (command.type === "edit-text") { p.onSelect([command.id]); p.onOpenProperties(); }
      else if (command.type === "shortcut") p.onShortcut(command.key, command.shift);
      else if (command.type === "simulation-handle") p.onSimulationHandle?.({ kind: command.kind, point: command.point, ...(command.value !== undefined ? { value: command.value } : {}) });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [token, sendFrame]);
  useEffect(() => {
    if (!ready) return;
    const request = requestAnimationFrame(sendFrame);
    return () => cancelAnimationFrame(request);
  }, [ready, sendFrame, frame, props.active, props.tool, props.motionMode, props.grid, props.disabled, props.multiple, props.color, props.dashed, props.zoom, props.cameraView, props.cameraReset, props.half, props.plain, props.landscape, props.onSimulationHandle]);
  const actionsTop = anchor ? Math.max(props.selectionTopInset ?? 80, Math.min(bounds.height - (props.selectionBottomInset ?? 80) - 145, anchor.y - 130)) : 80;
  return <View style={{ flex: 1, backgroundColor: "#09090f" }} onLayout={event => setBounds(event.nativeEvent.layout)}>
    <iframe ref={iframe} title="Quadra 3D da mesma jogada" src="/visual-court-3d/index.html?v=viewer-serve-20261027" referrerPolicy="no-referrer" onLoad={sendFrame} style={{ display: "block", border: 0, width: "100%", height: "100%", position: "absolute", inset: 0 }} />
    {!ready && !failed && props.active ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 10 }}><ActivityIndicator color={colors.primaryBg} /><Text style={{ color: "#e7edf8" }}>Abrindo vista 3D…</Text></View> : null}
    {failed ? <View style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", padding: 28 }}><Text accessibilityRole="alert" style={{ color: "#e7edf8", textAlign: "center" }}>Não foi possível abrir a vista 3D neste navegador. Sua jogada continua disponível em Quadra 2D.</Text></View> : null}
    {props.active && anchor && props.selected.length && props.selectionActions ? <View style={{ position: "absolute", left: Math.max(66, Math.min(bounds.width - 54, anchor.x + 22)), top: actionsTop }}>{props.selectionActions}</View> : null}
  </View>;
}
