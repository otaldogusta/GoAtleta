import {
  Canvas,
  Circle,
  Line,
  Path,
  Rect,
  RoundedRect,
  Skia,
  vec,
} from "@shopify/react-native-skia";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";

import {
  getDidacticSlotBounds,
  normalizeExtendedCourtPoint,
  normalizeCourtPoint,
  resolveCourtZone,
  getStepAtIndex,
  getVisibleLayerIdsForStep,
  type CourtDidacticSlot,
  type CourtPoint,
  type CourtVisualMarker,
  type CourtVisualPayload,
  type CourtZone,
} from "../../core/visual-court";
import { useAppTheme } from "../../ui/app-theme";

type Props = {
  payload: CourtVisualPayload;
  stepIndex: number;
  height?: number;
  editable?: boolean;
  showMovementLines?: boolean;
  animationProgress?: number;
  animationStepIndex?: number;
  selectedActorId?: string | null;
  onActorMove?: (actorId: string, point: CourtPoint) => void;
  onActorMoveEnd?: (actorId: string, point: CourtPoint) => void;
  onActorSelect?: (actorId: string) => void;
};

type LayoutState = {
  width: number;
  height: number;
};

type CourtFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const FULL_COURT_RATIO = 9 / 18;
const TEAM_HALF_COURT_RATIO = 1;
const COURT_PADDING = 18;
const MIN_CANVAS_HEIGHT = 420;
const MIN_TEAM_HALF_CANVAS_HEIGHT = 360;
const MAX_CANVAS_HEIGHT = 620;
const MAX_TEAM_HALF_CANVAS_HEIGHT = 560;

const mapOfficialDisplayPoint = (
  point: CourtPoint,
  courtView: CourtVisualPayload["court"]["courtView"]
): CourtPoint => {
  if (courtView === "team_half") {
    if (point.y <= 0.5) {
      return { x: point.x, y: point.y * (2 / 3) };
    }
    return { x: point.x, y: 1 / 3 + (point.y - 0.5) * (4 / 3) };
  }
  if (point.y <= 0.5) {
    return { x: point.x, y: 0.5 + point.y / 3 };
  }
  return { x: point.x, y: 2 / 3 + (point.y - 0.5) * (2 / 3) };
};

const resolvePoint = (point: CourtPoint, frame: CourtFrame) => ({
  x: frame.x + point.x * frame.width,
  y: frame.y + point.y * frame.height,
});

const resolveCourtPoint = (
  point: CourtPoint,
  frame: CourtFrame,
  isDidacticSlots: boolean,
  courtView: CourtVisualPayload["court"]["courtView"]
) => resolvePoint(isDidacticSlots ? point : mapOfficialDisplayPoint(point, courtView), frame);

const mapOfficialDisplayPointToCourt = (
  point: CourtPoint,
  courtView: CourtVisualPayload["court"]["courtView"]
): CourtPoint => {
  if (courtView === "team_half") {
    if (point.y <= 1 / 3) {
      return normalizeExtendedCourtPoint({ x: point.x, y: point.y * 1.5 });
    }
    return normalizeExtendedCourtPoint({
      x: point.x,
      y: 0.5 + (point.y - 1 / 3) * 0.75,
    });
  }
  if (point.y <= 2 / 3) {
    return normalizeExtendedCourtPoint({ x: point.x, y: (point.y - 0.5) * 3 });
  }
  return normalizeExtendedCourtPoint({
    x: point.x,
    y: 0.5 + (point.y - 2 / 3) * 1.5,
  });
};

const resolveCourtPointFromPixel = (
  pixel: { x: number; y: number },
  frame: CourtFrame,
  isDidacticSlots: boolean,
  courtView: CourtVisualPayload["court"]["courtView"]
) => {
  const displayPoint = normalizeExtendedCourtPoint({
    x: (pixel.x - frame.x) / frame.width,
    y: (pixel.y - frame.y) / frame.height,
  });
  return isDidacticSlots
    ? displayPoint
    : mapOfficialDisplayPointToCourt(displayPoint, courtView);
};

const getArrowHeadSegments = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  size = 14
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length < 1) return [];
  const angle = Math.atan2(dy, dx);
  const spread = Math.PI / 7;
  return [angle - spread, angle + spread].map((headAngle) => ({
    from: {
      x: to.x - Math.cos(headAngle) * size,
      y: to.y - Math.sin(headAngle) * size,
    },
    to,
  }));
};

const shortenLineEnd = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  offset: number
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  if (length <= offset + 1) return to;
  return {
    x: to.x - (dx / length) * offset,
    y: to.y - (dy / length) * offset,
  };
};

const resolveFrame = (
  layout: LayoutState,
  courtView: CourtVisualPayload["court"]["courtView"]
): CourtFrame => {
  const courtRatio = courtView === "team_half" ? TEAM_HALF_COURT_RATIO : FULL_COURT_RATIO;
  const maxWidth = Math.max(1, layout.width - COURT_PADDING * 2);
  const maxHeight = Math.max(1, layout.height - COURT_PADDING * 2);
  const widthFromHeight = maxHeight * courtRatio;
  const courtWidth = Math.min(maxWidth, widthFromHeight);
  const courtHeight = courtWidth / courtRatio;
  return {
    x: (layout.width - courtWidth) / 2,
    y: (layout.height - courtHeight) / 2,
    width: courtWidth,
    height: courtHeight,
  };
};

const buildMarkerPath = (
  marker: CourtVisualMarker,
  frame: CourtFrame,
  isDidacticSlots: boolean,
  courtView: CourtVisualPayload["court"]["courtView"]
) => {
  const point = resolveCourtPoint(marker.position, frame, isDidacticSlots, courtView);
  const path = Skia.Path.Make();
  path.moveTo(point.x, point.y - 12);
  path.lineTo(point.x - 10, point.y + 10);
  path.lineTo(point.x + 10, point.y + 10);
  path.close();
  return path;
};

const didacticSlotLabels: CourtDidacticSlot[] = [1, 2, 3, 4, 5, 6];
const officialZoneLabels: CourtZone[] = [4, 3, 2, 5, 6, 1];

const getActorDisplayLabel = (actor: CourtVisualPayload["actors"][number]) => {
  if (typeof actor.number === "number") return String(actor.number);
  if (actor.label.length <= 3) return actor.label;
  return actor.label.slice(0, 1);
};

const getHighlightBounds = (
  payload: CourtVisualPayload,
  highlight: NonNullable<ReturnType<typeof getStepAtIndex>["highlights"]>[number]
) => {
  if (payload.court.layoutMode === "didactic_slots" && highlight.slot) {
    return getDidacticSlotBounds(highlight.slot);
  }
  if (highlight.zone) return getOfficialDisplayZoneBounds(highlight.zone, payload.court.courtView);
  return null;
};

const getOfficialDisplayZoneBounds = (
  zone: CourtZone,
  courtView: CourtVisualPayload["court"]["courtView"]
) => {
  const columnByZone: Record<CourtZone, number> = {
    4: 0,
    3: 1,
    2: 2,
    5: 0,
    6: 1,
    1: 2,
  };
  const row = zone === 4 || zone === 3 || zone === 2 ? 0 : 1;
  if (courtView === "team_half") {
    return {
      x: columnByZone[zone] / 3,
      y: row === 0 ? 0 : 1 / 3,
      width: 1 / 3,
      height: row === 0 ? 1 / 3 : 2 / 3,
    };
  }
  return {
    x: columnByZone[zone] / 3,
    y: row === 0 ? 0.5 : 2 / 3,
    width: 1 / 3,
    height: row === 0 ? 1 / 6 : 1 / 3,
  };
};

const getDisplayLabelBounds = (
  isDidacticSlots: boolean,
  item: CourtDidacticSlot | CourtZone,
  courtView: CourtVisualPayload["court"]["courtView"]
) =>
  isDidacticSlots
    ? getDidacticSlotBounds(item as CourtDidacticSlot)
    : getOfficialDisplayZoneBounds(item as CourtZone, courtView);

const getHighlightLabels = (
  payload: CourtVisualPayload,
  step: ReturnType<typeof getStepAtIndex>
) =>
  step.phase === "attack_shape"
    ? (step.highlights ?? [])
        .filter((highlight) => highlight.label)
        .map((highlight) => {
          const actorId = step.attackOptions?.find((id) => highlight.id.endsWith(`-${id}`));
          const bounds = getHighlightBounds(payload, highlight);
          return {
            highlight,
            point:
              (actorId ? step.actorPositions[actorId] : undefined) ??
              (bounds
                ? {
                    x: bounds.x + bounds.width / 2,
                    y: bounds.y + Math.min(0.12, bounds.height / 3),
                  }
                : undefined),
          };
        })
        .filter((item): item is {
          highlight: NonNullable<ReturnType<typeof getStepAtIndex>["highlights"]>[number];
          point: CourtPoint;
        } => Boolean(item.point))
    : [];

const withAlpha = (color: string, alpha: number) => {
  if (!color.startsWith("#") || color.length !== 7) return color;
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
};

const isMeaningfulGhostPoint = (current: CourtPoint, next?: CourtPoint) =>
  Boolean(next && Math.abs(current.x - next.x) + Math.abs(current.y - next.y) > 0.035);

const getActorVisualState = (
  actor: CourtVisualPayload["actors"][number],
  step: ReturnType<typeof getStepAtIndex>,
  fallbackColor: string,
  renderStyle: CourtVisualPayload["court"]["renderStyle"],
  mode: string
) => {
  const baseColor = actor.baseColor ?? actor.color ?? fallbackColor;
  const isSetter = actor.id === "lev";
  const isPasser = step.passers?.includes(actor.id) ?? false;
  const isAttackOption = step.attackOptions?.includes(actor.id) ?? false;
  const isReceiveMoment =
    step.formationKind === "5x1_receive_3" &&
    (step.phase === "receive_legal" || step.phase === "receive_release");
  const isAttackMoment =
    step.formationKind === "5x1_receive_3" && step.phase === "attack_shape";
  const isReceiveLegal =
    step.formationKind === "5x1_receive_3" && step.phase === "receive_legal";
  const isCoachBoard = renderStyle === "coach_board";
  const coachLabelColor = mode === "dark" ? "#F8FAFC" : "#243447";
  const isOutlinedRole = actor.id === "op" || actor.id === "lib";

  if (isCoachBoard) {
    const isPrimary =
      (isReceiveLegal ? isPasser : isSetter || isPasser || isAttackOption) ||
      (step.formationKind === "5x1_serving" && resolveCourtZone(step.legalPositions?.[actor.id] ?? step.actorPositions[actor.id] ?? actor.initialPosition) === 1);
    const receiveLegalBorder = isPasser ? baseColor : "transparent";
    const roleBorder = isPrimary || isOutlinedRole ? baseColor : "transparent";
    return {
      fillColor: withAlpha(
        baseColor,
        isReceiveLegal ? (isPasser ? 1 : 0.38) : isPrimary ? 0.76 : 0.44
      ),
      borderColor: isReceiveLegal ? receiveLegalBorder : roleBorder,
      borderWidth: isReceiveLegal ? (isPasser ? 5 : 0) : isPrimary || isOutlinedRole ? 3 : 0,
      labelColor: isReceiveLegal && !isPasser ? "rgba(248,250,252,0.58)" : coachLabelColor,
      radius: 32,
      labelFontSize: actor.label.length > 1 ? 25 : 26,
    };
  }

  if (isReceiveMoment) {
    const isPrimary = isSetter || isPasser;
    return {
      fillColor: withAlpha(baseColor, isPrimary ? 1 : 0.34),
      borderColor: isSetter ? "#3DDC84" : isPasser ? "#14B8A6" : "transparent",
      borderWidth: isSetter ? 4 : isPasser ? 3 : 0,
      labelColor: isPrimary ? "#FFFFFF" : "rgba(255,255,255,0.72)",
      radius: 22,
      labelFontSize: 13,
    };
  }

  if (isAttackMoment) {
    const isPrimary = isSetter || isAttackOption;
    return {
      fillColor: withAlpha(baseColor, isPrimary ? 1 : 0.42),
      borderColor: isSetter ? "#3DDC84" : isAttackOption ? "#E5484D" : "transparent",
      borderWidth: isSetter ? 4 : isAttackOption ? 2 : 0,
      labelColor: isPrimary ? "#FFFFFF" : "rgba(255,255,255,0.72)",
      radius: 22,
      labelFontSize: 13,
    };
  }

  return {
    fillColor: baseColor,
    borderColor: "transparent",
    borderWidth: 0,
    labelColor: "#FFFFFF",
    radius: 21,
    labelFontSize: 13,
  };
};

const getTrajectoryColor = (
  payload: CourtVisualPayload,
  trajectory: NonNullable<ReturnType<typeof getStepAtIndex>["trajectories"]>[number],
  fallbackColor: string
) => {
  if (trajectory.color && !trajectory.id.startsWith("manual-move-")) {
    return trajectory.color;
  }
  const actor = trajectory.actorId
    ? payload.actors.find((item) => item.id === trajectory.actorId)
    : undefined;
  return actor?.baseColor ?? actor?.color ?? trajectory.color ?? fallbackColor;
};

const interpolatePoint = (from: CourtPoint, to: CourtPoint, progress: number): CourtPoint => ({
  x: from.x + (to.x - from.x) * progress,
  y: from.y + (to.y - from.y) * progress,
});

const resolveAnimatedTrajectoryPoints = (
  points: CourtPoint[],
  progress?: number
) => {
  if (typeof progress !== "number" || points.length < 2) return points;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const segmentCount = points.length - 1;
  const scaledProgress = clampedProgress * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress));
  const segmentProgress = scaledProgress - segmentIndex;
  const currentPoint = interpolatePoint(
    points[segmentIndex],
    points[segmentIndex + 1],
    segmentProgress
  );

  return [...points.slice(0, segmentIndex + 1), currentPoint];
};

const resolveAnimatedActorPosition = (
  actorId: string,
  step: ReturnType<typeof getStepAtIndex>,
  fallbackPoint: CourtPoint,
  progress?: number
) => {
  if (typeof progress !== "number") return fallbackPoint;
  const trajectory = (step.trajectories ?? step.transitions)?.find(
    (item) => item.actorId === actorId && item.points.length >= 2
  );
  if (!trajectory) return fallbackPoint;
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const segmentCount = trajectory.points.length - 1;
  const scaledProgress = clampedProgress * segmentCount;
  const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress));
  const segmentProgress = scaledProgress - segmentIndex;
  return interpolatePoint(
    trajectory.points[segmentIndex],
    trajectory.points[segmentIndex + 1],
    segmentProgress
  );
};

export function VisualCourtCanvas({
  payload,
  stepIndex,
  height = 620,
  editable = false,
  showMovementLines: forceShowMovementLines = false,
  animationProgress,
  animationStepIndex,
  selectedActorId,
  onActorMove,
  onActorMoveEnd,
  onActorSelect,
}: Props) {
  const { colors, mode } = useAppTheme();
  const dragStartPointRef = useRef<Record<string, CourtPoint>>({});
  const dragPointerOffsetRef = useRef<Record<string, { x: number; y: number }>>({});
  const selectionPulse = useRef(new Animated.Value(0)).current;
  const isTeamHalfView = payload.court.courtView === "team_half";
  const isCoachBoard = payload.court.renderStyle === "coach_board";
  const minCanvasHeight = isTeamHalfView ? MIN_TEAM_HALF_CANVAS_HEIGHT : MIN_CANVAS_HEIGHT;
  const maxCanvasHeight = isTeamHalfView ? MAX_TEAM_HALF_CANVAS_HEIGHT : MAX_CANVAS_HEIGHT;
  const initialHeight = Math.max(minCanvasHeight, Math.min(maxCanvasHeight, height));
  const [layout, setLayout] = useState<LayoutState>({ width: 0, height: initialHeight });
  const resolvedHeight = Math.max(
    minCanvasHeight,
    Math.min(
      maxCanvasHeight,
      height,
      layout.width > 0 ? layout.width * (isTeamHalfView ? 0.72 : 1.28) : height
    )
  );
  const step = getStepAtIndex(payload, stepIndex);
  const animationStep =
    typeof animationProgress === "number"
      ? getStepAtIndex(payload, animationStepIndex ?? stepIndex)
      : step;
  const visibleLayerIds = getVisibleLayerIdsForStep(payload, step);
  const movementLines = animationStep.trajectories ?? animationStep.transitions;
  const showMovementLines =
    forceShowMovementLines ||
    visibleLayerIds.includes("trajectories") ||
    (typeof animationProgress === "number" && Boolean(movementLines?.length));
  const isDidacticSlots =
    payload.court.layoutMode === "didactic_slots" || payload.court.labelMode === "slots";
  const frame = useMemo(
    () => resolveFrame({ width: layout.width, height: resolvedHeight }, payload.court.courtView),
    [layout.width, payload.court.courtView, resolvedHeight]
  );
  const activeMarkerIds = new Set(step.markerIds ?? payload.markers.map((marker) => marker.id));
  const activeMarkers = payload.markers.filter(
    (marker) =>
      activeMarkerIds.has(marker.id) &&
      !(step.formationKind === "5x1_serving" && marker.type === "ball")
  );
  const activeArrows = step.arrows?.filter(
    (arrow) =>
      !(step.formationKind === "5x1_serving" && arrow.id.includes("serve-arrow"))
  );
  const highlightLabels = getHighlightLabels(payload, step);
  const visibleActorIds = new Set(step.visibleActorIds ?? payload.actors.map((actor) => actor.id));
  const ghostActors =
    !isCoachBoard && step.formationKind === "5x1_receive_3" && step.phase === "receive_legal"
      ? payload.actors
          .filter((actor) => {
            const current = step.actorPositions[actor.id] ?? actor.initialPosition;
            return (
              visibleActorIds.has(actor.id) &&
              (actor.id === "lev" || step.passers?.includes(actor.id)) &&
              isMeaningfulGhostPoint(current, step.tacticalPositions?.[actor.id])
            );
          })
          .map((actor) => ({
            actor,
            point: step.tacticalPositions?.[actor.id] ?? actor.initialPosition,
          }))
      : [];
  const courtSurroundFill = mode === "dark" ? "#406A4C" : "#6E9E63";
  const courtLineColor = isDidacticSlots
    ? mode === "dark" ? "rgba(255,255,255,0.42)" : "rgba(30,41,59,0.24)"
    : "#F8FAFC";
  const gridColor = isDidacticSlots
    ? mode === "dark" ? "rgba(255,255,255,0.16)" : "rgba(30,41,59,0.11)"
    : "rgba(248,250,252,0.78)";
  const courtFill = isDidacticSlots
    ? mode === "dark" ? "rgba(15, 118, 110, 0.2)" : "rgba(61, 220, 132, 0.1)"
    : "#D8A05C";
  const attackFill = isDidacticSlots
    ? mode === "dark" ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.045)"
    : "transparent";
  const labelItems = isDidacticSlots ? didacticSlotLabels : officialZoneLabels;
  const courtRadius = isCoachBoard ? 10 : 18;
  const extensionLines = isTeamHalfView ? [1 / 3] : [1 / 3, 2 / 3];
  const canEditActors =
    editable && (Boolean(onActorMove) || Boolean(onActorMoveEnd)) && frame.width > 0;
  useEffect(() => {
    selectionPulse.stopAnimation();
    selectionPulse.setValue(0);
    if (!selectedActorId) return undefined;
    const animation = Animated.loop(
      Animated.timing(selectionPulse, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [selectedActorId, selectionPulse]);
  const selectionScale = selectionPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.22],
  });
  const selectionOpacity = selectionPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 0.16],
  });
  const getResponderPagePoint = (
    event: GestureResponderEvent,
    gesture?: PanResponderGestureState
  ) => {
    const native = event.nativeEvent as {
      locationX?: number;
      locationY?: number;
      pageX?: number;
      pageY?: number;
    };
    const x =
      gesture && Number.isFinite(gesture.moveX) && gesture.moveX !== 0
        ? gesture.moveX
        : native.pageX ?? native.locationX ?? 0;
    const y =
      gesture && Number.isFinite(gesture.moveY) && gesture.moveY !== 0
        ? gesture.moveY
        : native.pageY ?? native.locationY ?? 0;
    return { x, y };
  };
  const resolveDraggedPointFromDelta = (
    startPoint: CourtPoint,
    gesture: { dx: number; dy: number }
  ) => {
    const startPixel = resolveCourtPoint(
      startPoint,
      frame,
      isDidacticSlots,
      payload.court.courtView
    );
    return resolveCourtPointFromPixel(
      { x: startPixel.x + gesture.dx, y: startPixel.y + gesture.dy },
      frame,
      isDidacticSlots,
      payload.court.courtView
    );
  };
  const resolveDraggedPointFromPointer = (
    actorId: string,
    event: GestureResponderEvent,
    gesture?: PanResponderGestureState
  ) => {
    const pointer = getResponderPagePoint(event, gesture);
    const offset = dragPointerOffsetRef.current[actorId] ?? { x: 0, y: 0 };
    const nextPixel = { x: pointer.x + offset.x, y: pointer.y + offset.y };
    if (!Number.isFinite(nextPixel.x) || !Number.isFinite(nextPixel.y)) {
      return null;
    }
    return resolveCourtPointFromPixel(
      nextPixel,
      frame,
      isDidacticSlots,
      payload.court.courtView
    );
  };
  const getWebMousePoint = (event: {
    clientX?: number;
    clientY?: number;
    nativeEvent?: { clientX?: number; clientY?: number; pageX?: number; pageY?: number };
    pageX?: number;
    pageY?: number;
  }) => ({
    x: event.nativeEvent?.pageX ?? event.pageX ?? event.nativeEvent?.clientX ?? event.clientX ?? 0,
    y: event.nativeEvent?.pageY ?? event.pageY ?? event.nativeEvent?.clientY ?? event.clientY ?? 0,
  });
  const getActorDragHandlers = (actorId: string, currentPoint: CourtPoint) => {
    if (!canEditActors) {
      if (!onActorSelect) return {};
      if (Platform.OS === "web") {
        return {
          onMouseDown: (event: {
            preventDefault?: () => void;
            stopPropagation?: () => void;
          }) => {
            event.preventDefault?.();
            event.stopPropagation?.();
            onActorSelect(actorId);
          },
        };
      }
      return PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderRelease: () => {
          onActorSelect(actorId);
        },
      }).panHandlers;
    }

    if (Platform.OS === "web") {
      return {
        onMouseDown: (event: {
          nativeEvent?: { clientX?: number; clientY?: number; pageX?: number; pageY?: number };
          pageX?: number;
          pageY?: number;
          preventDefault?: () => void;
          stopPropagation?: () => void;
        }) => {
          event.preventDefault?.();
          event.stopPropagation?.();
          onActorSelect?.(actorId);
          const startPointer = getWebMousePoint(event);
          const startPoint = currentPoint;
          const handleMove = (moveEvent: MouseEvent) => {
            const pointer = getWebMousePoint(moveEvent);
            onActorMove?.(
              actorId,
              resolveDraggedPointFromDelta(startPoint, {
                dx: pointer.x - startPointer.x,
                dy: pointer.y - startPointer.y,
              })
            );
          };
          const handleEnd = (upEvent: MouseEvent) => {
            const pointer = getWebMousePoint(upEvent);
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleEnd);
            onActorMoveEnd?.(
              actorId,
              resolveDraggedPointFromDelta(startPoint, {
                dx: pointer.x - startPointer.x,
                dy: pointer.y - startPointer.y,
              })
            );
          };
          window.addEventListener("mousemove", handleMove);
          window.addEventListener("mouseup", handleEnd);
        },
      };
    }

    return PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: (_, gesture) =>
            Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
          onPanResponderGrant: (event) => {
            onActorSelect?.(actorId);
            dragStartPointRef.current[actorId] = currentPoint;
            const pointer = getResponderPagePoint(event);
            const actorPixel = resolveCourtPoint(
              currentPoint,
              frame,
              isDidacticSlots,
              payload.court.courtView
            );
            dragPointerOffsetRef.current[actorId] = {
              x: actorPixel.x - pointer.x,
              y: actorPixel.y - pointer.y,
            };
          },
          onPanResponderMove: (
            event: GestureResponderEvent,
            gesture: PanResponderGestureState
          ) => {
            const startPoint = dragStartPointRef.current[actorId] ?? currentPoint;
            onActorMove?.(
              actorId,
              resolveDraggedPointFromPointer(actorId, event, gesture) ??
                resolveDraggedPointFromDelta(startPoint, gesture)
            );
          },
          onPanResponderRelease: (
            event: GestureResponderEvent,
            gesture: PanResponderGestureState
          ) => {
            const startPoint = dragStartPointRef.current[actorId] ?? currentPoint;
            const nextPoint =
              resolveDraggedPointFromPointer(actorId, event, gesture) ??
              resolveDraggedPointFromDelta(startPoint, gesture);
            delete dragStartPointRef.current[actorId];
            delete dragPointerOffsetRef.current[actorId];
            onActorMoveEnd?.(actorId, nextPoint);
          },
          onPanResponderTerminate: (
            event: GestureResponderEvent,
            gesture: PanResponderGestureState
          ) => {
            const startPoint = dragStartPointRef.current[actorId] ?? currentPoint;
            const nextPoint =
              resolveDraggedPointFromPointer(actorId, event, gesture) ??
              resolveDraggedPointFromDelta(startPoint, gesture);
            delete dragStartPointRef.current[actorId];
            delete dragPointerOffsetRef.current[actorId];
            onActorMoveEnd?.(actorId, nextPoint);
          },
        }).panHandlers;
  };

  if (Platform.OS === "web") {
    return (
      <View
        onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0) {
            setLayout({ width: nextWidth, height: resolvedHeight });
          }
        }}
        style={{
          height: resolvedHeight,
          borderRadius: isCoachBoard ? 12 : 18,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: isDidacticSlots ? colors.border : "rgba(248,250,252,0.18)",
          backgroundColor: isDidacticSlots ? colors.inputBg : courtSurroundFill,
        }}
      >
        <View
          testID="visual-court-frame"
          style={{
            position: "absolute",
            left: frame.x,
            top: frame.y,
            width: frame.width,
            height: frame.height,
            borderRadius: courtRadius,
            borderWidth: 2,
            borderColor: courtLineColor,
            backgroundColor: courtFill,
            overflow: "hidden",
          }}
        >
          {!isDidacticSlots && !isTeamHalfView ? (
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: frame.width,
                height: frame.height / 2,
                backgroundColor: attackFill,
              }}
            />
          ) : null}
          {isDidacticSlots ? (
            <WebGridLine x={0} y={frame.height / 2} width={frame.width} color={courtLineColor} thickness={2} />
          ) : isTeamHalfView ? (
            <>
              <WebGridLine x={0} y={0} width={frame.width} color={courtLineColor} thickness={5} />
              <WebGridLine x={0} y={frame.height / 3} width={frame.width} color={courtLineColor} thickness={3} />
              {[1, 2].map((column) => (
                <View
                  key={`web-official-column-${column}`}
                  style={{
                    position: "absolute",
                    left: (frame.width * column) / 3,
                    top: 0,
                    width: 1,
                    height: frame.height,
                    backgroundColor: gridColor,
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <WebGridLine x={0} y={frame.height / 3} width={frame.width} color={courtLineColor} thickness={2} />
              <WebGridLine x={0} y={frame.height / 2} width={frame.width} color={courtLineColor} thickness={2} />
              <WebGridLine x={0} y={(frame.height * 2) / 3} width={frame.width} color={gridColor} />
            </>
          )}
          {isDidacticSlots ? [1, 2].map((column) => (
            <View
              key={`web-column-${column}`}
              style={{
                position: "absolute",
                left: (frame.width * column) / 3,
                top: 0,
                width: 1,
                height: frame.height,
                backgroundColor: gridColor,
              }}
            />
          )) : null}
        </View>

        {!isDidacticSlots ? (
          <>
            {extensionLines.map((lineY) => (
              <Fragment key={`web-extension-${lineY}`}>
                <View
                  style={{
                    position: "absolute",
                    left: Math.max(0, frame.x - 88),
                    top: frame.y + frame.height * lineY,
                    width: 72,
                    borderTopWidth: 3,
                    borderColor: "rgba(248,250,252,0.86)",
                    borderStyle: "dashed",
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    left: frame.x + frame.width + 16,
                    top: frame.y + frame.height * lineY,
                    width: 72,
                    borderTopWidth: 3,
                    borderColor: "rgba(248,250,252,0.86)",
                    borderStyle: "dashed",
                  }}
                />
              </Fragment>
            ))}
          </>
        ) : null}

        {visibleLayerIds.includes("highlights")
          ? step.highlights?.map((highlight) => {
              if (isCoachBoard) return null;
              if (step.phase === "attack_shape" && highlight.label) return null;
              const zone = getHighlightBounds(payload, highlight);
              if (!zone) return null;
              return (
                <View
                  key={highlight.id}
                  style={{
                    position: "absolute",
                    left: frame.x + zone.x * frame.width,
                    top: frame.y + zone.y * frame.height,
                    width: zone.width * frame.width,
                    height: zone.height * frame.height,
                    backgroundColor: highlight.color ?? "rgba(242,160,61,0.2)",
                  }}
                />
              );
            })
          : null}

        {visibleLayerIds.includes("highlights")
          ? highlightLabels.map(({ highlight, point }) => {
              const resolved = resolveCourtPoint(point, frame, isDidacticSlots, payload.court.courtView);
              return (
              <View
                key={`web-highlight-label-${highlight.id}`}
                style={{
                  position: "absolute",
                  left: resolved.x - 28,
                  top: resolved.y - 48,
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#E5484D",
                  }}
                />
                <Text
                  style={{
                  color: colors.text,
                  fontSize: 11,
                  fontWeight: "900",
                  backgroundColor:
                    mode === "dark" ? "rgba(14,23,41,0.78)" : "rgba(255,255,255,0.82)",
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                {highlight.label}
              </Text>
              </View>
              );
            })
          : null}

        {showMovementLines
          ? movementLines?.flatMap((trajectory) => {
              const animatedPoints = resolveAnimatedTrajectoryPoints(
                trajectory.points,
                animationProgress
              );
              return animatedPoints.slice(1).map((point, index) => {
                const from = resolveCourtPoint(animatedPoints[index], frame, isDidacticSlots, payload.court.courtView);
                const rawTo = resolveCourtPoint(point, frame, isDidacticSlots, payload.court.courtView);
                const isFinalSegment = index === animatedPoints.length - 2;
                const to =
                  isFinalSegment && trajectory.actorId
                    ? shortenLineEnd(from, rawTo, isCoachBoard ? 30 : 22)
                    : rawTo;
                return (
                  <WebLine
                    key={`${trajectory.id}-${index}`}
                    from={from}
                    to={to}
                    color={getTrajectoryColor(payload, trajectory, colors.primaryBg)}
                    thickness={3}
                    arrowHead={isFinalSegment}
                  />
                );
              });
            })
          : null}

        {visibleLayerIds.includes("arrows")
          ? activeArrows?.map((arrow) => (
              <WebLine
                key={arrow.id}
                from={resolveCourtPoint(arrow.from, frame, isDidacticSlots, payload.court.courtView)}
                to={resolveCourtPoint(arrow.to, frame, isDidacticSlots, payload.court.courtView)}
                color={arrow.color ?? colors.primaryBg}
                thickness={4}
                arrowHead
              />
            ))
          : null}

        {visibleLayerIds.includes("markers")
          ? activeMarkers.map((marker) => {
                const point = resolveCourtPoint(marker.position, frame, isDidacticSlots, payload.court.courtView);
                return (
                  <View key={marker.id} pointerEvents="none">
                    <View
                      style={{
                        position: "absolute",
                        left: point.x - 10,
                        top: point.y - 10,
                        width: marker.type === "target" ? 24 : 20,
                        height: marker.type === "target" ? 24 : 20,
                        borderRadius: marker.type === "cone" ? 4 : 999,
                        borderWidth: marker.type === "target" ? 3 : 0,
                        borderColor: marker.color ?? colors.warningText,
                        backgroundColor:
                          marker.type === "target"
                            ? "transparent"
                            : marker.color ?? colors.warningText,
                        transform: marker.type === "cone" ? [{ rotate: "45deg" }] : undefined,
                      }}
                    />
                    {marker.label ? (
                      <Text
                        style={{
                          position: "absolute",
                          left: point.x - 44,
                          top: point.y + 16,
                          width: 88,
                          color: marker.color ?? colors.text,
                          fontSize: 11,
                          fontWeight: "900",
                          textAlign: "center",
                        }}
                      >
                        {marker.label}
                      </Text>
                    ) : null}
                  </View>
                );
              })
          : null}

        {visibleLayerIds.includes("zones")
          ? labelItems.map((item) => {
              const bounds = isDidacticSlots
                ? getDisplayLabelBounds(true, item as CourtDidacticSlot, payload.court.courtView)
                : getDisplayLabelBounds(false, item as CourtZone, payload.court.courtView);
              return (
                <Text
                  key={`web-zone-label-${item}`}
                  style={{
                    position: "absolute",
                    left: isDidacticSlots
                      ? frame.x + bounds.x * frame.width + 8
                      : frame.x + bounds.x * frame.width + (isCoachBoard ? 14 : 0),
                    top: isDidacticSlots
                      ? frame.y + bounds.y * frame.height + 8
                      : isCoachBoard
                        ? frame.y + bounds.y * frame.height + bounds.height * frame.height - 40
                        : frame.y + bounds.y * frame.height + bounds.height * frame.height * 0.42,
                    width: isDidacticSlots || isCoachBoard ? undefined : bounds.width * frame.width,
                    color: isDidacticSlots
                      ? colors.muted
                      : isCoachBoard
                        ? "rgba(255,255,255,0.68)"
                        : "rgba(255,255,255,0.9)",
                    fontSize: isDidacticSlots ? 12 : isCoachBoard ? 20 : 22,
                    fontWeight: "900",
                    textAlign: isDidacticSlots || isCoachBoard ? undefined : "center",
                  }}
                >
                  {item}
                </Text>
              );
            })
          : null}

        {visibleLayerIds.includes("actors")
          ? ghostActors.map(({ actor, point }) => {
              const resolved = resolveCourtPoint(point, frame, isDidacticSlots, payload.court.courtView);
              const visual = getActorVisualState(actor, step, colors.primaryBg, payload.court.renderStyle, mode);
              return (
                <View
                  key={`web-ghost-${actor.id}`}
                  style={{
                    position: "absolute",
                    left: resolved.x - 17,
                    top: resolved.y - 17,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    borderWidth: 2,
                    borderColor: visual.borderColor,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    borderStyle: "dashed",
                  }}
                />
              );
            })
          : null}

        {visibleLayerIds.includes("actors")
          ? payload.actors.filter((actor) => visibleActorIds.has(actor.id)).map((actor) => {
              const actorPosition = step.actorPositions[actor.id] ?? actor.initialPosition;
              const displayPosition = resolveAnimatedActorPosition(
                actor.id,
                animationStep,
                actorPosition,
                animationProgress
              );
              const point = resolveCourtPoint(
                displayPosition,
                frame,
                isDidacticSlots,
                payload.court.courtView
              );
              const visual = getActorVisualState(actor, step, colors.primaryBg, payload.court.renderStyle, mode);
              const isSelected = selectedActorId === actor.id;
              const selectionColor =
                visual.borderColor && visual.borderColor !== "transparent"
                  ? visual.borderColor
                  : visual.fillColor;
              return (
                <View
                  key={actor.id}
                  testID={`visual-court-actor-${actor.id}`}
                  {...getActorDragHandlers(actor.id, actorPosition)}
                  style={{
                    position: "absolute",
                    left: point.x - visual.radius,
                    top: point.y - visual.radius,
                    width: visual.radius * 2,
                    height: visual.radius * 2,
                    borderRadius: visual.radius,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: visual.borderWidth,
                    borderColor: visual.borderColor,
                    backgroundColor: visual.fillColor,
                  }}
                >
                  {isSelected ? (
                    <>
                      <Animated.View
                        pointerEvents="none"
                        testID={`visual-court-selection-${actor.id}`}
                        style={{
                          position: "absolute",
                          left: -8,
                          top: -8,
                          width: visual.radius * 2 + 16,
                          height: visual.radius * 2 + 16,
                          borderRadius: visual.radius + 8,
                          borderWidth: 2,
                          borderColor: selectionColor,
                          opacity: selectionOpacity,
                          transform: [{ scale: selectionScale }],
                        }}
                      />
                      <View
                        pointerEvents="none"
                        style={{
                          position: "absolute",
                          left: -4,
                          top: -4,
                          width: visual.radius * 2 + 8,
                          height: visual.radius * 2 + 8,
                          borderRadius: visual.radius + 4,
                          borderWidth: 2,
                          borderColor: selectionColor,
                        }}
                      />
                    </>
                  ) : null}
                  <Text style={{ color: visual.labelColor, fontSize: visual.labelFontSize, fontWeight: "900" }}>
                    {getActorDisplayLabel(actor)}
                  </Text>
                </View>
              );
            })
          : null}

      </View>
    );
  }

  return (
    <View
      onLayout={(event) => {
          const nextWidth = event.nativeEvent.layout.width;
          if (nextWidth > 0) {
          setLayout({ width: nextWidth, height: resolvedHeight });
        }
      }}
      style={{
        height: resolvedHeight,
        borderRadius: isCoachBoard ? 12 : 18,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDidacticSlots ? colors.border : "rgba(248,250,252,0.18)",
        backgroundColor: isDidacticSlots ? colors.inputBg : courtSurroundFill,
      }}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        <RoundedRect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          r={courtRadius}
          color={courtFill}
        />
        {!isDidacticSlots && !isTeamHalfView ? (
          <Rect
            x={frame.x}
            y={frame.y}
            width={frame.width}
            height={frame.height / 2}
            color={attackFill}
          />
        ) : null}
        <RoundedRect
          x={frame.x}
          y={frame.y}
          width={frame.width}
          height={frame.height}
          r={courtRadius}
          color={courtLineColor}
          style="stroke"
          strokeWidth={2}
        />
        {isDidacticSlots ? (
          <Line
            p1={vec(frame.x, frame.y + frame.height / 2)}
            p2={vec(frame.x + frame.width, frame.y + frame.height / 2)}
            color={courtLineColor}
            strokeWidth={2}
          />
        ) : isTeamHalfView ? (
          <>
            <Line
              p1={vec(frame.x, frame.y)}
              p2={vec(frame.x + frame.width, frame.y)}
              color={courtLineColor}
              strokeWidth={5}
            />
            <Line
              p1={vec(frame.x, frame.y + frame.height / 3)}
              p2={vec(frame.x + frame.width, frame.y + frame.height / 3)}
              color={courtLineColor}
              strokeWidth={3}
            />
            {[1, 2].map((column) => (
              <Line
                key={`official-column-${column}`}
                p1={vec(frame.x + (frame.width * column) / 3, frame.y)}
                p2={vec(frame.x + (frame.width * column) / 3, frame.y + frame.height)}
                color={gridColor}
                strokeWidth={1}
              />
            ))}
          </>
        ) : (
          <>
            <Line
              p1={vec(frame.x, frame.y + frame.height / 3)}
              p2={vec(frame.x + frame.width, frame.y + frame.height / 3)}
              color={courtLineColor}
              strokeWidth={2}
            />
            <Line
              p1={vec(frame.x, frame.y + frame.height / 2)}
              p2={vec(frame.x + frame.width, frame.y + frame.height / 2)}
              color={courtLineColor}
              strokeWidth={2}
            />
            <Line
              p1={vec(frame.x, frame.y + (frame.height * 2) / 3)}
              p2={vec(frame.x + frame.width, frame.y + (frame.height * 2) / 3)}
              color={gridColor}
              strokeWidth={1}
            />
          </>
        )}
        {!isDidacticSlots ? (
          <>
            {extensionLines.flatMap((lineY) => [
              <Line
                key={`extension-left-${lineY}`}
                p1={vec(Math.max(0, frame.x - 88), frame.y + frame.height * lineY)}
                p2={vec(Math.max(0, frame.x - 16), frame.y + frame.height * lineY)}
                color="rgba(248,250,252,0.86)"
                strokeWidth={3}
              />,
              <Line
                key={`extension-right-${lineY}`}
                p1={vec(frame.x + frame.width + 16, frame.y + frame.height * lineY)}
                p2={vec(frame.x + frame.width + 88, frame.y + frame.height * lineY)}
                color="rgba(248,250,252,0.86)"
                strokeWidth={3}
              />,
            ])}
          </>
        ) : null}
        {isDidacticSlots ? [1, 2].map((column) => (
          <Line
            key={`column-${column}`}
            p1={vec(frame.x + (frame.width * column) / 3, frame.y)}
            p2={vec(frame.x + (frame.width * column) / 3, frame.y + frame.height)}
            color={gridColor}
            strokeWidth={1}
          />
        )) : null}

        {visibleLayerIds.includes("highlights")
          ? step.highlights?.map((highlight) => {
              if (isCoachBoard) return null;
              if (step.phase === "attack_shape" && highlight.label) return null;
              const zone = getHighlightBounds(payload, highlight);
              if (!zone) return null;
              return (
                <Rect
                  key={highlight.id}
                  x={frame.x + zone.x * frame.width}
                  y={frame.y + zone.y * frame.height}
                  width={zone.width * frame.width}
                  height={zone.height * frame.height}
                  color={highlight.color ?? "rgba(242,160,61,0.2)"}
                />
              );
            })
          : null}

        {showMovementLines
          ? movementLines?.map((trajectory) => {
              const path = Skia.Path.Make();
              const animatedPoints = resolveAnimatedTrajectoryPoints(
                trajectory.points,
                animationProgress
              );
              const resolvedPoints = animatedPoints.map((point) =>
                resolveCourtPoint(point, frame, isDidacticSlots, payload.court.courtView)
              );
              const drawablePoints =
                trajectory.actorId && resolvedPoints.length >= 2
                  ? resolvedPoints.map((point, index) =>
                      index === resolvedPoints.length - 1
                        ? shortenLineEnd(
                            resolvedPoints[resolvedPoints.length - 2],
                            point,
                            isCoachBoard ? 30 : 22
                          )
                        : point
                    )
                  : resolvedPoints;
              drawablePoints.forEach((resolved, index) => {
                if (index === 0) path.moveTo(resolved.x, resolved.y);
                else path.lineTo(resolved.x, resolved.y);
              });
              const arrowHead =
                drawablePoints.length >= 2
                  ? getArrowHeadSegments(
                      drawablePoints[drawablePoints.length - 2],
                      drawablePoints[drawablePoints.length - 1]
                    )
                  : [];
              return (
                <Fragment key={trajectory.id}>
                  <Path
                    path={path}
                    color={getTrajectoryColor(payload, trajectory, colors.primaryBg)}
                    style="stroke"
                    strokeWidth={3}
                  />
                  {arrowHead.map((segment, index) => (
                    <Line
                      key={`${trajectory.id}-head-${index}`}
                      p1={vec(segment.from.x, segment.from.y)}
                      p2={vec(segment.to.x, segment.to.y)}
                      color={getTrajectoryColor(payload, trajectory, colors.primaryBg)}
                      strokeWidth={3}
                    />
                  ))}
                </Fragment>
              );
            })
          : null}

        {visibleLayerIds.includes("arrows")
          ? activeArrows?.map((arrow) => {
              const from = resolveCourtPoint(arrow.from, frame, isDidacticSlots, payload.court.courtView);
              const to = resolveCourtPoint(arrow.to, frame, isDidacticSlots, payload.court.courtView);
              const arrowHead = getArrowHeadSegments(from, to);
              return (
                <Fragment key={arrow.id}>
                  <Line
                    p1={vec(from.x, from.y)}
                    p2={vec(to.x, to.y)}
                    color={arrow.color ?? colors.primaryBg}
                    strokeWidth={4}
                  />
                  {arrowHead.map((segment, index) => (
                    <Line
                      key={`${arrow.id}-head-${index}`}
                      p1={vec(segment.from.x, segment.from.y)}
                      p2={vec(segment.to.x, segment.to.y)}
                      color={arrow.color ?? colors.primaryBg}
                      strokeWidth={4}
                    />
                  ))}
                </Fragment>
              );
            })
          : null}

        {visibleLayerIds.includes("markers")
          ? activeMarkers.map((marker) => {
                const point = resolveCourtPoint(marker.position, frame, isDidacticSlots, payload.court.courtView);
                if (marker.type === "cone") {
                  return (
                    <Path
                      key={marker.id}
                      path={buildMarkerPath(marker, frame, isDidacticSlots, payload.court.courtView)}
                      color={marker.color ?? colors.warningText}
                    />
                  );
                }
                return (
                  <Circle
                    key={marker.id}
                    cx={point.x}
                    cy={point.y}
                    r={marker.type === "target" ? 13 : 9}
                    color={marker.color ?? colors.warningText}
                    style={marker.type === "target" ? "stroke" : "fill"}
                    strokeWidth={marker.type === "target" ? 3 : undefined}
                  />
                );
              })
          : null}

        {visibleLayerIds.includes("actors")
          ? ghostActors.map(({ actor, point }) => {
              const resolved = resolveCourtPoint(point, frame, isDidacticSlots, payload.court.courtView);
              const visual = getActorVisualState(actor, step, colors.primaryBg, payload.court.renderStyle, mode);
              return (
                <Circle
                  key={`ghost-${actor.id}`}
                  cx={resolved.x}
                  cy={resolved.y}
                  r={17}
                  color={visual.borderColor}
                  style="stroke"
                  strokeWidth={2}
                />
              );
            })
          : null}

        {visibleLayerIds.includes("actors")
          ? payload.actors.filter((actor) => visibleActorIds.has(actor.id)).map((actor) => {
              const actorPosition = step.actorPositions[actor.id] ?? actor.initialPosition;
              const displayPosition = resolveAnimatedActorPosition(
                actor.id,
                animationStep,
                actorPosition,
                animationProgress
              );
              const point = resolveCourtPoint(
                displayPosition,
                frame,
                isDidacticSlots,
                payload.court.courtView
              );
              const visual = getActorVisualState(actor, step, colors.primaryBg, payload.court.renderStyle, mode);
              return (
                <Fragment key={actor.id}>
                  <Circle
                    key={`${actor.id}-fill`}
                    cx={point.x}
                    cy={point.y}
                    r={visual.radius}
                    color={visual.fillColor}
                  />
                  {visual.borderWidth > 0 ? (
                    <Circle
                      key={`${actor.id}-stroke`}
                      cx={point.x}
                      cy={point.y}
                      r={visual.radius - visual.borderWidth / 2}
                      color={visual.borderColor}
                      style="stroke"
                      strokeWidth={visual.borderWidth}
                    />
                  ) : null}
                </Fragment>
              );
            })
          : null}
      </Canvas>

      {visibleLayerIds.includes("markers")
        ? activeMarkers
            .filter((marker) => marker.label)
            .map((marker) => {
              const point = resolveCourtPoint(marker.position, frame, isDidacticSlots, payload.court.courtView);
              return (
                <Text
                  key={`marker-label-${marker.id}`}
                  style={{
                    position: "absolute",
                    left: point.x - 44,
                    top: point.y + 16,
                    width: 88,
                    color: marker.color ?? colors.text,
                    fontSize: 11,
                    fontWeight: "900",
                    textAlign: "center",
                  }}
                >
                  {marker.label}
                </Text>
              );
            })
        : null}

      {visibleLayerIds.includes("highlights")
        ? highlightLabels.map(({ highlight, point }) => {
            const resolved = resolveCourtPoint(point, frame, isDidacticSlots, payload.court.courtView);
            return (
            <View
              key={`highlight-label-${highlight.id}`}
              style={{
                position: "absolute",
                left: resolved.x - 28,
                top: resolved.y - 48,
                alignItems: "center",
                gap: 4,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#E5484D",
                }}
              />
              <Text
                style={{
                color: colors.text,
                fontSize: 11,
                fontWeight: "900",
                backgroundColor:
                  mode === "dark" ? "rgba(14,23,41,0.78)" : "rgba(255,255,255,0.82)",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 999,
                overflow: "hidden",
              }}
            >
              {highlight.label}
            </Text>
            </View>
            );
          })
        : null}

      {visibleLayerIds.includes("zones")
        ? labelItems.map((item) => {
            const bounds = isDidacticSlots
              ? getDisplayLabelBounds(true, item as CourtDidacticSlot, payload.court.courtView)
              : getDisplayLabelBounds(false, item as CourtZone, payload.court.courtView);
            return (
              <Text
                key={`zone-label-${item}`}
                style={{
                  position: "absolute",
                  left: isDidacticSlots
                    ? frame.x + bounds.x * frame.width + 8
                    : frame.x + bounds.x * frame.width + (isCoachBoard ? 14 : 0),
                  top: isDidacticSlots
                    ? frame.y + bounds.y * frame.height + 8
                    : isCoachBoard
                      ? frame.y + bounds.y * frame.height + bounds.height * frame.height - 40
                      : frame.y + bounds.y * frame.height + bounds.height * frame.height * 0.42,
                  width: isDidacticSlots || isCoachBoard ? undefined : bounds.width * frame.width,
                  color: isDidacticSlots
                    ? colors.muted
                    : isCoachBoard
                      ? "rgba(255,255,255,0.68)"
                      : "rgba(255,255,255,0.9)",
                  fontSize: isDidacticSlots ? 12 : isCoachBoard ? 20 : 22,
                  fontWeight: "900",
                  textAlign: isDidacticSlots || isCoachBoard ? undefined : "center",
                }}
              >
                {item}
              </Text>
            );
          })
        : null}
      {visibleLayerIds.includes("actors")
        ? payload.actors.filter((actor) => visibleActorIds.has(actor.id)).map((actor) => {
            const actorPosition = step.actorPositions[actor.id] ?? actor.initialPosition;
            const displayPosition = resolveAnimatedActorPosition(
              actor.id,
              animationStep,
              actorPosition,
              animationProgress
            );
            const point = resolveCourtPoint(
              displayPosition,
              frame,
              isDidacticSlots,
              payload.court.courtView
            );
            const visual = getActorVisualState(actor, step, colors.primaryBg, payload.court.renderStyle, mode);
            const isSelected = selectedActorId === actor.id;
            const selectionColor =
              visual.borderColor && visual.borderColor !== "transparent"
                ? visual.borderColor
                : visual.fillColor;
            return (
              <View
                key={`actor-label-${actor.id}`}
                {...getActorDragHandlers(actor.id, actorPosition)}
                style={{
                  position: "absolute",
                  left: point.x - visual.radius,
                  top: point.y - visual.radius,
                  width: visual.radius * 2,
                  height: visual.radius * 2,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected ? (
                  <>
                    <Animated.View
                      pointerEvents="none"
                      testID={`visual-court-selection-${actor.id}`}
                      style={{
                        position: "absolute",
                        left: -8,
                        top: -8,
                        width: visual.radius * 2 + 16,
                        height: visual.radius * 2 + 16,
                        borderRadius: visual.radius + 8,
                        borderWidth: 2,
                        borderColor: selectionColor,
                        opacity: selectionOpacity,
                        transform: [{ scale: selectionScale }],
                      }}
                    />
                    <View
                      pointerEvents="none"
                      style={{
                        position: "absolute",
                        left: -4,
                        top: -4,
                        width: visual.radius * 2 + 8,
                        height: visual.radius * 2 + 8,
                        borderRadius: visual.radius + 4,
                        borderWidth: 2,
                        borderColor: selectionColor,
                      }}
                    />
                  </>
                ) : null}
                <Text style={{ color: visual.labelColor, fontSize: visual.labelFontSize, fontWeight: "900" }}>
                  {getActorDisplayLabel(actor)}
                </Text>
              </View>
            );
          })
        : null}

    </View>
  );
}

function WebGridLine({
  x,
  y,
  width,
  color,
  thickness = 1,
}: {
  x: number;
  y: number;
  width: number;
  color: string;
  thickness?: number;
}) {
  return (
    <View
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height: thickness,
        backgroundColor: color,
      }}
    />
  );
}

function WebLine({
  from,
  to,
  color,
  thickness,
  arrowHead = false,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  thickness: number;
  arrowHead?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = `${Math.atan2(dy, dx)}rad`;
  return (
    <Fragment>
      <View
        style={{
          position: "absolute",
          left: from.x,
          top: from.y - thickness / 2,
          width: length,
          height: thickness,
          borderRadius: thickness,
          backgroundColor: color,
          transform: [{ rotate: angle }],
          transformOrigin: "0px 50%",
        }}
      />
      {arrowHead
        ? getArrowHeadSegments(from, to).map((segment, index) => (
            <WebLine
              key={`head-${index}`}
              from={segment.from}
              to={segment.to}
              color={color}
              thickness={thickness}
            />
          ))
        : null}
    </Fragment>
  );
}
