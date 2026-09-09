import { buildRotation5x1Preset, type CourtPoint, type CourtVisualPayload, type CourtVisualStep } from "./visual-court";

export type DrawingKind = "arrow" | "curve" | "pen" | "area" | "text" | "ball" | "cone" | "target" | "ladder";
export type CourtDrawing = { id: string; kind: DrawingKind; points: CourtPoint[]; color: string; text?: string; dashed?: boolean; size: number; rotation: number; locked?: boolean; motion?: CourtPoint[] };
export type CourtEditorMetadata = {
  version: 1;
  coordinates: "regulation";
  title: string;
  folder: string;
  tags: string;
  favorite: boolean;
  actorMeta: Record<string, { team?: "A" | "B"; locked?: boolean; studentId?: string }>;
  drawings: Record<string, CourtDrawing[]>;
  hiddenLayers: string[];
  lessonLink?: { date: string; block: string; revision: string };
};
export type EditorSnapshot = { payload: CourtVisualPayload; stepIndex: number };
export const editorId = () => `board_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
export const limitPoint = (p: CourtPoint): CourtPoint => ({ x: Math.max(-0.2, Math.min(1.2, p.x)), y: Math.max(-0.15, Math.min(1.15, p.y)) });
/** Half-metre intersections on the 9 × 18 m court, independent of orientation. */
export const snapCourtPoint = (p: CourtPoint): CourtPoint => ({ x: Math.round(p.x * 18) / 18, y: Math.round(p.y * 36) / 36 });

/** Convert legacy didactic/official positions once. View rotation never changes the document. */
export function upgradeCourtEditor(payload: CourtVisualPayload, title: string): CourtVisualPayload {
  const repairedSteps = payload.timeline.steps.map(s => {
    if (s.formationKind !== "5x1_receive_3" || !s.legalPositions || s.legalPositions.lib || !s.visibleActorIds?.includes("lib")) return s;
    const replaced = ["c1", "c2"].find(id => !s.visibleActorIds!.includes(id) && s.legalPositions![id]);
    if (!replaced) return s;
    const position = s.legalPositions[replaced];
    const restored = !s.trajectories?.length && !s.transitions?.length && ["lev", "op", "p1", "p2"].every(id => JSON.stringify(s.actorPositions[id]) === JSON.stringify(s.legalPositions![id]));
    return { ...s, legalPositions: { ...s.legalPositions, lib: position }, ...(restored ? { actorPositions: { ...s.actorPositions, lib: position }, baselineActorPositions: { ...s.baselineActorPositions, lib: position } } : {}) };
  });
  if (repairedSteps.some((s, i) => s !== payload.timeline.steps[i])) payload = { ...payload, timeline: { steps: repairedSteps } };
  // Old presets carried a setter destination as a visible target material.
  // Keep user-created targets; remove only the two known preset marker IDs.
  const automatic = new Set(["target", "receive-target"]);
  const markers = payload.markers.filter(m => !automatic.has(m.id));
  const editor = payload.editor ? { ...payload.editor, drawings: Object.fromEntries(Object.entries(payload.editor.drawings).map(([step, drawings]) => [step, drawings.filter(d => ![...automatic].some(id => d.id === `legacy_${step}_${id}`))])) } : undefined;
  if (markers.length !== payload.markers.length || (editor && JSON.stringify(editor.drawings) !== JSON.stringify(payload.editor?.drawings))) payload = { ...payload, markers, ...(editor ? { editor } : {}) };
  if (payload.editor?.version === 1) {
    if (!payload.markers.length && !payload.timeline.steps.some(s => s.arrows?.length)) return payload;
    const drawings = { ...payload.editor.drawings };
    for (const step of payload.timeline.steps) {
      const existing = drawings[step.id] ?? [];
      const migrated: CourtDrawing[] = [
        ...payload.markers.filter(m => !step.markerIds || step.markerIds.includes(m.id)).map(m => ({ id: `legacy_${step.id}_${m.id}`, kind: m.type, points: [m.position], color: m.color ?? "#ffdc53", size: 28, rotation: 0 })),
        ...(step.arrows ?? []).map(a => ({ id: `legacy_${step.id}_${a.id}`, kind: "arrow" as const, points: [a.from, a.to], color: a.color ?? "#fff", size: 28, rotation: 0 })),
      ];
      drawings[step.id] = [...existing, ...migrated.filter(m => !existing.some(d => d.id === m.id))];
    }
    return { ...payload, markers: [], editor: { ...payload.editor, drawings }, timeline: { steps: payload.timeline.steps.map(s => ({ ...s, markerIds: [], arrows: undefined })) } };
  }
  const official = payload.court.layoutMode !== "didactic_slots" && payload.court.labelMode !== "slots";
  const map = (p: CourtPoint): CourtPoint => ({ x: p.x, y: official ? (p.y <= 0.5 ? 0.5 + p.y / 3 : 2 / 3 + (p.y - 0.5) * 2 / 3) : 0.5 + p.y / 2 });
  const positions = (v?: Record<string, CourtPoint>) => v ? Object.fromEntries(Object.entries(v).map(([k, p]) => [k, map(p)])) : undefined;
  return {
    ...payload,
    editor: { version: 1, coordinates: "regulation", title, folder: "", tags: "", favorite: false, actorMeta: {}, drawings: Object.fromEntries(payload.timeline.steps.map(s => [s.id, [
      ...payload.markers.filter(m => !s.markerIds || s.markerIds.includes(m.id)).map(m => ({ id: `legacy_${s.id}_${m.id}`, kind: m.type, points: [map(m.position)], color: m.color ?? "#ffdc53", size: 32, rotation: 0 })),
      ...(s.arrows ?? []).map(a => ({ id: `legacy_${s.id}_${a.id}`, kind: "arrow" as const, points: [map(a.from), map(a.to)], color: a.color ?? "#ffffff", size: 32, rotation: 0 })),
    ]])), hiddenLayers: [] },
    court: { ...payload.court, courtView: "full_court", renderStyle: "coach_board", showZones: false },
    actors: payload.actors.map(a => ({ ...a, initialPosition: map(a.initialPosition) })),
    markers: [],
    timeline: { steps: payload.timeline.steps.map(s => ({ ...s,
      actorPositions: positions(s.actorPositions)!, baselineActorPositions: positions(s.baselineActorPositions),
      legalPositions: positions(s.legalPositions), tacticalPositions: positions(s.tacticalPositions),
      setterTarget: s.setterTarget ? map(s.setterTarget) : undefined,
      arrows: undefined,
      trajectories: s.trajectories?.map(t => ({ ...t, points: t.points.map(map) })),
      transitions: s.transitions?.map(t => ({ ...t, points: t.points.map(map) })),
    })) },
  };
}

export function newCourtBoard(title = "Nova jogada"): CourtVisualPayload {
  const p = upgradeCourtEditor(buildRotation5x1Preset(), title);
  const actors = ["A", "B"].flatMap((team, ti) => Array.from({ length: 6 }, (_, i) => ({
    id: editorId(), label: i === 5 ? "Lb" : String(i + 1), number: i + 1,
    role: i === 5 ? "libero" as const : "athlete" as const,
    color: i === 5 ? (ti ? "#c7d9ff" : "#c5fff0") : ti ? "#4389ff" : "#19c87b",
    initialPosition: { x: 0.22 + (i % 3) * 0.28, y: (ti ? 0.12 : 0.65) + Math.floor(i / 3) * 0.18 },
  })));
  return { ...p, actors, markers: [], editor: { ...p.editor!, drawings: {}, actorMeta: Object.fromEntries(actors.map((a, i) => [a.id, { team: i < 6 ? "A" : "B" }])) },
    timeline: { steps: [{ id: editorId(), label: "Posição inicial", durationMs: 1600, actorPositions: Object.fromEntries(actors.map(a => [a.id, a.initialPosition])) }] } };
}

export const frameDrawings = (p: CourtVisualPayload, index: number) => p.editor?.drawings[p.timeline.steps[index]?.id] ?? [];
export const actorPoint = (p: CourtVisualPayload, index: number, id: string) => p.timeline.steps[index]?.actorPositions[id] ?? p.actors.find(a => a.id === id)?.initialPosition ?? { x: 0.5, y: 0.75 };
export function changeStep(p: CourtVisualPayload, index: number, change: (s: CourtVisualStep) => CourtVisualStep): CourtVisualPayload {
  return { ...p, timeline: { steps: p.timeline.steps.map((s, i) => i === index ? change(s) : s) } };
}
export function changeDrawings(p: CourtVisualPayload, index: number, drawings: CourtDrawing[]): CourtVisualPayload {
  return { ...p, editor: { ...p.editor!, drawings: { ...p.editor!.drawings, [p.timeline.steps[index].id]: drawings } } };
}
export function moveSelection(p: CourtVisualPayload, index: number, ids: string[], delta: CourtPoint, animate: boolean, path?: CourtPoint[]): CourtVisualPayload {
  const movable = ids.filter(id => !p.editor?.actorMeta[id]?.locked);
  let next = changeStep(p, index, s => {
    const actorPositions = { ...s.actorPositions };
    let trajectories = [...(s.trajectories ?? s.transitions ?? [])];
    const baseline = { ...(s.baselineActorPositions ?? s.actorPositions) };
    for (const a of p.actors.filter(a => movable.includes(a.id))) {
      const from = path?.length ? (s.trajectories ?? s.transitions)?.find(t => t.actorId === a.id)?.points[0] ?? actorPoint(p, index, a.id) : actorPoint(p, index, a.id);
      const to = limitPoint({ x: from.x + delta.x, y: from.y + delta.y });
      actorPositions[a.id] = to;
      if (animate) {
        const old = trajectories.find(t => t.actorId === a.id);
        trajectories = [...trajectories.filter(t => t.actorId !== a.id), { id: old?.id ?? editorId(), actorId: a.id, points: path?.length ? path.map(pt => limitPoint({ x: from.x + pt.x, y: from.y + pt.y })) : [old?.points[0] ?? from, to], color: a.color }];
      } else {
        baseline[a.id] = to;
        trajectories = trajectories.filter(t => t.actorId !== a.id);
      }
    }
    return { ...s, actorPositions, baselineActorPositions: baseline, trajectories, transitions: undefined };
  });
  next = changeDrawings(next, index, frameDrawings(p, index).map(d => {
    if (!ids.includes(d.id) || d.locked) return d;
    const points = d.points.map(pt => limitPoint({ x: pt.x + delta.x, y: pt.y + delta.y }));
    return { ...d, points, motion: animate && d.kind === "ball" ? path?.length ? path.map(pt => limitPoint({ x: (d.motion?.[0] ?? d.points[0]).x + pt.x, y: (d.motion?.[0] ?? d.points[0]).y + pt.y })) : [d.motion?.[0] ?? d.points[0], points[0]] : undefined };
  }));
  return next;
}
export function alignSelection(p: CourtVisualPayload, index: number, ids: string[], axis: "x" | "y") {
  const points = ids.map(id => p.actors.some(a => a.id === id) ? actorPoint(p, index, id) : frameDrawings(p, index).find(d => d.id === id)?.points[0]).filter((pt): pt is CourtPoint => !!pt);
  if (points.length < 2) return p;
  const value = points.reduce((sum, pt) => sum + pt[axis], 0) / points.length;
  return ids.reduce((next, id) => {
    const pt = p.actors.some(a => a.id === id) ? actorPoint(p, index, id) : frameDrawings(p, index).find(d => d.id === id)?.points[0];
    return pt ? moveSelection(next, index, [id], { x: axis === "x" ? value - pt.x : 0, y: axis === "y" ? value - pt.y : 0 }, false) : next;
  }, p);
}
export function resetStepAnimation(p: CourtVisualPayload, index: number): CourtVisualPayload {
  p = upgradeCourtEditor(p, p.editor?.title ?? "Jogada");
  const next = changeStep(p, index, s => {
    const starts = Object.fromEntries((s.trajectories ?? s.transitions ?? []).filter(t => t.points.length).map(t => [t.actorId, t.points[0]]));
    const positions = { ...s.actorPositions, ...starts, ...s.baselineActorPositions, ...s.legalPositions };
    return { ...s, actorPositions: positions, baselineActorPositions: { ...positions }, trajectories: [], transitions: undefined };
  });
  return changeDrawings(next, index, frameDrawings(next, index).map(d => ({ ...d, points: d.motion?.length ? [d.motion[0]] : d.points, motion: undefined })));
}
export function deleteSelection(p: CourtVisualPayload, index: number, ids: string[]) {
  const next = changeStep(p, index, s => ({ ...s, visibleActorIds: (s.visibleActorIds ?? p.actors.map(a => a.id)).filter(id => !ids.includes(id) || p.editor?.actorMeta[id]?.locked),
    trajectories: (s.trajectories ?? s.transitions)?.filter(t => !ids.includes(t.actorId) || p.editor?.actorMeta[t.actorId]?.locked), transitions: undefined }));
  return changeDrawings(next, index, frameDrawings(next, index).filter(d => !ids.includes(d.id) || d.locked));
}
export function duplicateSelection(p: CourtVisualPayload, index: number, ids: string[]) {
  let next = p;
  const selected: string[] = [];
  for (const a of p.actors.filter(a => ids.includes(a.id))) {
    const id = editorId(); selected.push(id);
    const point = actorPoint(p, index, a.id);
    const clone = { ...a, id, initialPosition: limitPoint({ x: point.x + 0.06, y: point.y + 0.03 }) };
    next = { ...next, actors: [...next.actors, clone], editor: { ...next.editor!, actorMeta: { ...next.editor!.actorMeta, [id]: { ...next.editor!.actorMeta[a.id], locked: false } } } };
    next = { ...next, timeline: { steps: next.timeline.steps.map((s, i) => ({ ...s, visibleActorIds: [...(s.visibleActorIds ?? p.actors.map(a => a.id)), ...(i === index ? [id] : [])], actorPositions: i === index ? { ...s.actorPositions, [id]: clone.initialPosition } : s.actorPositions })) } };
  }
  const clones = frameDrawings(p, index).filter(d => ids.includes(d.id)).map(d => { const id = editorId(); selected.push(id); return { ...d, id, locked: false, points: d.points.map(pt => limitPoint({ x: pt.x + 0.06, y: pt.y + 0.03 })) }; });
  return { payload: changeDrawings(next, index, [...frameDrawings(next, index), ...clones]), selected };
}
export function duplicateStep(p: CourtVisualPayload, index: number): EditorSnapshot {
  const source = p.timeline.steps[index];
  const id = editorId();
  const step = { ...JSON.parse(JSON.stringify(source)), id, label: `${source.label} · cópia` } as CourtVisualStep;
  const steps = [...p.timeline.steps]; steps.splice(index + 1, 0, step);
  return { payload: { ...p, timeline: { steps }, editor: { ...p.editor!, drawings: { ...p.editor!.drawings, [id]: frameDrawings(p, index).map(d => ({ ...d, id: editorId() })) } } }, stepIndex: index + 1 };
}
export function removeStep(p: CourtVisualPayload, index: number): EditorSnapshot {
  if (p.timeline.steps.length <= 1) return { payload: p, stepIndex: index };
  const drawings = { ...p.editor!.drawings }; delete drawings[p.timeline.steps[index].id];
  return { payload: { ...p, timeline: { steps: p.timeline.steps.filter((_, i) => i !== index) }, editor: { ...p.editor!, drawings } }, stepIndex: Math.max(0, index - 1) };
}
export function reorderStep(p: CourtVisualPayload, index: number, direction: number): EditorSnapshot {
  const target = Math.max(0, Math.min(p.timeline.steps.length - 1, index + direction));
  const steps = [...p.timeline.steps]; [steps[index], steps[target]] = [steps[target], steps[index]];
  return { payload: { ...p, timeline: { steps } }, stepIndex: target };
}
export function pointAlong(points: CourtPoint[], progress: number): CourtPoint {
  if (!points.length) return { x: 0.5, y: 0.5 };
  const segment = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const i = Math.floor(segment), a = points[i], b = points[Math.min(i + 1, points.length - 1)];
  return { x: a.x + (b.x - a.x) * (segment - i), y: a.y + (b.y - a.y) * (segment - i) };
}

/** The traveled path ends at the rear edge of the moving token. */
export function motionTrail(points: CourtPoint[], progress: number, clearance: number): CourtPoint[] {
  if (points.length < 2 || progress <= 0) return [];
  const segment = Math.min(1, progress) * (points.length - 1);
  const trail = [...points.slice(0, Math.floor(segment) + 1), pointAlong(points, progress)];
  let remaining = clearance;
  while (trail.length > 1) {
    const b = trail[trail.length - 1], a = trail[trail.length - 2];
    const length = Math.hypot((b.x - a.x) * 900, (b.y - a.y) * 1800);
    if (length <= remaining) { remaining -= length; trail.pop(); continue; }
    const ratio = (length - remaining) / length;
    trail[trail.length - 1] = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
    break;
  }
  return trail.length > 1 ? trail : [];
}

/** Bounded, typed import. Never accept organization IDs, executable markup or arbitrary links. */
export function parseEditorImport(raw: string): CourtVisualPayload {
  if (raw.length > 2_000_000) throw new Error("Arquivo acima de 2 MB.");
  const value = JSON.parse(raw);
  const p = value?.format === "goatleta-court" && value?.version === 1 ? value.payload : null;
  if (!p || p.version !== 1 || p.sport !== "volleyball_indoor" || p.editor?.version !== 1 || p.editor?.coordinates !== "regulation" || !Array.isArray(p.actors) || !Array.isArray(p.timeline?.steps) || p.actors.length > 100 || !p.timeline.steps.length || p.timeline.steps.length > 200) throw new Error("Formato de quadra incompatível.");
  const text = (v: unknown, max = 120) => typeof v === "string" ? v.slice(0, max) : "";
  const point = (v: unknown) => { const pt = v as CourtPoint; if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) throw new Error("Coordenada inválida."); return limitPoint(pt); };
  const color = (v: unknown) => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : "#19c87b";
  const actors = p.actors.map((a: { id: string; label: string; number: number; color: string; role: string; initialPosition: CourtPoint }) => ({ id: text(a.id), label: text(a.label, 24), number: Math.min(99, Math.max(0, Number(a.number) || 0)), color: color(a.color), role: ["setter", "outside", "middle", "opposite", "libero", "athlete", "coach"].includes(a.role) ? a.role : "athlete", initialPosition: point(a.initialPosition) }));
  if (new Set(actors.map((a: {id: string}) => a.id)).size !== actors.length) throw new Error("Jogadores duplicados no arquivo.");
  const steps = p.timeline.steps.map((s: CourtVisualStep) => ({ id: text(s.id), label: text(s.label), note: text(s.note, 1000), durationMs: Math.max(450, Math.min(30000, Number(s.durationMs) || 1600)), actorPositions: Object.fromEntries(actors.map((a: {id: string; initialPosition: CourtPoint}) => [a.id, point(s.actorPositions?.[a.id] ?? a.initialPosition)])), visibleActorIds: actors.filter((a: {id: string}) => !s.visibleActorIds || s.visibleActorIds.includes(a.id)).map((a: {id: string}) => a.id), trajectories: (Array.isArray(s.trajectories) ? s.trajectories : []).slice(0, 100).map(t => ({ id: text(t.id), actorId: text(t.actorId), color: color(t.color), points: t.points.slice(0, 300).map(point) })) }));
  if (new Set(steps.map((s: CourtVisualStep) => s.id)).size !== steps.length) throw new Error("Etapas duplicadas no arquivo.");
  const drawings = Object.fromEntries(steps.map((s: CourtVisualStep) => [s.id, (Array.isArray(p.editor.drawings?.[s.id]) ? p.editor.drawings[s.id] : []).slice(0, 200).map((d: CourtDrawing) => {
    if (!["arrow", "curve", "pen", "area", "text", "ball", "cone", "target", "ladder"].includes(d.kind) || !Array.isArray(d.points) || !d.points.length) throw new Error("Objeto inválido.");
    return { id: text(d.id), kind: d.kind, points: d.points.slice(0, 500).map(point), text: text(d.text, 200), color: color(d.color), dashed: Boolean(d.dashed), size: Math.max(12, Math.min(80, Number(d.size) || 28)), rotation: Number(d.rotation) % 360 || 0, locked: Boolean(d.locked), motion: d.kind === "ball" && Array.isArray(d.motion) ? d.motion.slice(0, 300).map(point) : undefined };
  })]));
  return { ...newCourtBoard(), actors, markers: [], timeline: { steps }, editor: { version: 1, coordinates: "regulation", title: text(p.editor.title) || "Jogada importada", folder: text(p.editor.folder), tags: text(p.editor.tags), favorite: false, actorMeta: Object.fromEntries(actors.map((a: { id: string }) => [a.id, { team: p.editor.actorMeta?.[a.id]?.team === "B" ? "B" : "A", locked: Boolean(p.editor.actorMeta?.[a.id]?.locked) }])), hiddenLayers: [], drawings } } as CourtVisualPayload;
}
