export type CourtVisualSourceKind = "rotation" | "lesson" | "scouting" | "free";

export type CourtVisualSport = "volleyball_indoor";

export type CourtZone = 1 | 2 | 3 | 4 | 5 | 6;
export type CourtDidacticSlot = 1 | 2 | 3 | 4 | 5 | 6;
export type CourtVisualRotationIndex = 1 | 2 | 3 | 4 | 5 | 6;
export type CourtVisualPhase =
  | "receive_legal"
  | "receive_release"
  | "attack_shape"
  | "defense_shape"
  | "serve_base"
  | "serve_after_hit";
export type CourtVisualFormationKind =
  | "didactic_grid"
  | "5x1_receive_3"
  | "5x1_serving"
  | "defense_base_6_back";
export type CourtVisualAttackOrigin = "left" | "middle" | "right";
export type CourtVisualDefenseKind =
  | "parallel"
  | "diagonal"
  | "deep"
  | "short_tip";
export type CourtVisualDefensiveRole = CourtVisualDefenseKind;
export type CourtVisualSourceOfTruth = "coach_adjusted";
export type CourtVisualInitialLayout = "base_perimeter_6_back";
export type CourtVisualLayoutMode =
  | "didactic_slots"
  | "official_volleyball_zones"
  | "official_zones";
export type CourtVisualLabelMode = "slots" | "official_zones";
export type CourtVisualCourtView = "full_court" | "team_half";
export type CourtVisualRenderStyle = "standard" | "coach_board";

export type CourtPoint = {
  x: number;
  y: number;
};

export type CourtVisualActorRole =
  | "setter"
  | "outside"
  | "middle"
  | "opposite"
  | "libero"
  | "athlete"
  | "coach";

export type CourtVisualLegendActorLabel = "Lv" | "Op" | "P" | "C" | "Lb";

export type CourtVisualActor = {
  id: string;
  label: string;
  number?: number;
  role: CourtVisualActorRole;
  color?: string;
  baseColor?: string;
  currentZone?: CourtZone;
  rotationOrder?: number;
  isBackRow?: boolean;
  isFrontRow?: boolean;
  initialPosition: CourtPoint;
};

export type CourtVisualMarkerType = "cone" | "ball" | "target";

export type CourtVisualMarker = {
  id: string;
  type: CourtVisualMarkerType;
  label?: string;
  position: CourtPoint;
  color?: string;
};

export type CourtVisualArrow = {
  id: string;
  from: CourtPoint;
  to: CourtPoint;
  label?: string;
  color?: string;
};

export type CourtVisualTrajectory = {
  id: string;
  actorId: string;
  points: CourtPoint[];
  color?: string;
};

export type CourtVisualHighlight = {
  id: string;
  zone?: CourtZone;
  slot?: CourtDidacticSlot;
  label?: string;
  color?: string;
};

export type CourtVisualLayer = {
  id: string;
  label: string;
  kind: "zones" | "actors" | "markers" | "arrows" | "trajectories" | "highlights";
  visibleByDefault: boolean;
};

export type CourtVisualStep = {
  id: string;
  label: string;
  durationMs: number;
  note?: string;
  rotationIndex?: CourtVisualRotationIndex;
  phase?: CourtVisualPhase;
  formationKind?: CourtVisualFormationKind;
  actorPositions: Record<string, CourtPoint>;
  baselineActorPositions?: Record<string, CourtPoint>;
  legalPositions?: Record<string, CourtPoint>;
  tacticalPositions?: Record<string, CourtPoint>;
  transitions?: CourtVisualTrajectory[];
  passers?: string[];
  setterTarget?: CourtPoint;
  attackOptions?: string[];
  attackOrigin?: CourtVisualAttackOrigin;
  defenseKind?: CourtVisualDefenseKind;
  defensiveRoles?: Record<string, CourtVisualDefensiveRole>;
  sourceOfTruth?: CourtVisualSourceOfTruth;
  initialLayout?: CourtVisualInitialLayout;
  visibleActorIds?: string[];
  markerIds?: string[];
  arrows?: CourtVisualArrow[];
  trajectories?: CourtVisualTrajectory[];
  highlights?: CourtVisualHighlight[];
  visibleLayerIds?: string[];
};

export type CourtVisualPayload = {
  version: 1;
  sport: CourtVisualSport;
  court: {
    orientation: "vertical";
    showZones: boolean;
    layoutMode: CourtVisualLayoutMode;
    labelMode: CourtVisualLabelMode;
    courtView: CourtVisualCourtView;
    renderStyle: CourtVisualRenderStyle;
  };
  actors: CourtVisualActor[];
  markers: CourtVisualMarker[];
  layers: CourtVisualLayer[];
  timeline: {
    steps: CourtVisualStep[];
  };
};

export type CourtVisualDocument = {
  id: string;
  organizationId: string;
  classId: string;
  sourceKind: CourtVisualSourceKind;
  sourceId?: string | null;
  title: string;
  payload: CourtVisualPayload;
  createdAt: string;
  updatedAt: string;
};

export const clampCourtUnit = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
};

const clampCourtExtendedUnit = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1.3, Math.max(-0.3, value));
};

export const normalizeCourtPoint = (point: CourtPoint): CourtPoint => ({
  x: Number(clampCourtUnit(point.x).toFixed(4)),
  y: Number(clampCourtUnit(point.y).toFixed(4)),
});

export const normalizeExtendedCourtPoint = (point: CourtPoint): CourtPoint => ({
  x: Number(clampCourtExtendedUnit(point.x).toFixed(4)),
  y: Number(clampCourtExtendedUnit(point.y).toFixed(4)),
});

const normalizeCourtVisualActorLabel = (actor: CourtVisualActor) => {
  if (actor.id === "p1") return "P¹";
  if (actor.id === "p2") return "P²";
  return actor.label;
};

export const normalizeCourtPayload = (
  payload: CourtVisualPayload
): CourtVisualPayload => ({
  ...payload,
  court: {
    ...payload.court,
    courtView:
      payload.court.courtView ??
      (payload.court.layoutMode === "official_volleyball_zones" ||
      payload.court.layoutMode === "official_zones"
        ? "team_half"
        : "team_half"),
    renderStyle: payload.court.renderStyle ?? "standard",
  },
  actors: payload.actors.map((actor) => ({
    ...actor,
    label: normalizeCourtVisualActorLabel(actor),
    initialPosition: normalizeCourtPoint(actor.initialPosition),
  })),
  markers: payload.markers.map((marker) => ({
    ...marker,
    position: normalizeCourtPoint(marker.position),
  })),
  timeline: {
    steps: payload.timeline.steps.map((step) => ({
      ...step,
      actorPositions: Object.fromEntries(
        Object.entries(step.actorPositions).map(([actorId, point]) => [
          actorId,
          normalizeExtendedCourtPoint(point),
        ])
      ),
      baselineActorPositions: step.baselineActorPositions
        ? Object.fromEntries(
            Object.entries(step.baselineActorPositions).map(([actorId, point]) => [
              actorId,
              normalizeExtendedCourtPoint(point),
            ])
          )
        : undefined,
      legalPositions: step.legalPositions
        ? Object.fromEntries(
            Object.entries(step.legalPositions).map(([actorId, point]) => [
              actorId,
              normalizeCourtPoint(point),
            ])
          )
        : undefined,
      tacticalPositions: step.tacticalPositions
        ? Object.fromEntries(
            Object.entries(step.tacticalPositions).map(([actorId, point]) => [
              actorId,
              normalizeExtendedCourtPoint(point),
            ])
          )
        : undefined,
      transitions: step.transitions?.map((transition) => ({
        ...transition,
        points: transition.points.map(normalizeExtendedCourtPoint),
      })),
      setterTarget: step.setterTarget
        ? normalizeCourtPoint(step.setterTarget)
        : undefined,
      arrows: step.arrows?.map((arrow) => ({
        ...arrow,
        from: normalizeCourtPoint(arrow.from),
        to: normalizeCourtPoint(arrow.to),
      })),
      trajectories: step.trajectories?.map((trajectory) => ({
        ...trajectory,
        points: trajectory.points.map(normalizeExtendedCourtPoint),
      })),
    })),
  },
});

export const serializeCourtVisualPayload = (payload: CourtVisualPayload) =>
  JSON.stringify(normalizeCourtPayload(payload));

export const parseCourtVisualPayload = (value: unknown): CourtVisualPayload => {
  const raw =
    typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  const payload = raw as Partial<CourtVisualPayload>;
  if (
    payload.version !== 1 ||
    payload.sport !== "volleyball_indoor" ||
    !Array.isArray(payload.actors) ||
    !payload.timeline ||
    !Array.isArray(payload.timeline.steps)
  ) {
    throw new Error("Payload visual de quadra inválido.");
  }
  return normalizeCourtPayload({
    version: 1,
    sport: "volleyball_indoor",
    court: {
      orientation: "vertical",
      showZones: payload.court?.showZones ?? true,
      layoutMode: payload.court?.layoutMode ?? "didactic_slots",
      labelMode: payload.court?.labelMode ?? "slots",
      courtView:
        payload.court?.courtView ??
        (payload.court?.layoutMode === "official_volleyball_zones" ||
        payload.court?.layoutMode === "official_zones"
          ? "team_half"
          : "team_half"),
      renderStyle: payload.court?.renderStyle ?? "standard",
    },
    actors: payload.actors,
    markers: payload.markers ?? [],
    layers: payload.layers ?? defaultCourtVisualLayers,
    timeline: {
      steps: payload.timeline.steps,
    },
  });
};

export const resolveCourtZone = (point: CourtPoint): CourtZone => {
  const normalized = normalizeCourtPoint(point);
  const column = normalized.x < 1 / 3 ? 0 : normalized.x < 2 / 3 ? 1 : 2;
  const isBackRow = normalized.y >= 0.5;
  if (!isBackRow) {
    return ([4, 3, 2] as CourtZone[])[column];
  }
  return ([5, 6, 1] as CourtZone[])[column];
};

export const getZoneBounds = (zone: CourtZone) => {
  const zoneMap: Record<CourtZone, { column: 0 | 1 | 2; row: 0 | 1 }> = {
    4: { column: 0, row: 0 },
    3: { column: 1, row: 0 },
    2: { column: 2, row: 0 },
    5: { column: 0, row: 1 },
    6: { column: 1, row: 1 },
    1: { column: 2, row: 1 },
  };
  const item = zoneMap[zone];
  return {
    x: item.column / 3,
    y: item.row / 2,
    width: 1 / 3,
    height: 1 / 2,
  };
};

export const getDidacticSlotBounds = (slot: CourtDidacticSlot) => {
  const slotIndex = slot - 1;
  return {
    x: (slotIndex % 3) / 3,
    y: Math.floor(slotIndex / 3) / 2,
    width: 1 / 3,
    height: 1 / 2,
  };
};

export const getDidacticSlotCenter = (slot: CourtDidacticSlot): CourtPoint => {
  const bounds = getDidacticSlotBounds(slot);
  return normalizeCourtPoint({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  });
};

export const getOfficialZoneCenter = (zone: CourtZone): CourtPoint => {
  const bounds = getZoneBounds(zone);
  return normalizeCourtPoint({
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  });
};

const offsetPoint = (point: CourtPoint, offset: CourtPoint): CourtPoint =>
  normalizeCourtPoint({
    x: point.x + offset.x,
    y: point.y + offset.y,
  });

export const OFFICIAL_VOLLEYBALL_ZONE_ORDER: CourtZone[] = [4, 3, 2, 5, 6, 1];
export const OFFICIAL_VOLLEYBALL_ROTATION_PATH: CourtZone[] = [2, 1, 6, 5, 4, 3];
export const SETTER_ROTATION_ZONES_5X1: CourtZone[] = [1, 6, 5, 4, 3, 2];
type Brazilian5x1ActorId = "lev" | "op" | "p1" | "p2" | "c1" | "c2";
type Brazilian5x1SetterPosition = "P1" | "P6" | "P5" | "P4" | "P3" | "P2";

export const DEFENSE_ATTACK_ORIGIN_LABELS: Record<CourtVisualAttackOrigin, string> = {
  left: "Entrada",
  middle: "Meio",
  right: "Saída",
};

export const DEFENSE_KIND_LABELS: Record<CourtVisualDefenseKind, string> = {
  parallel: "Paralela",
  diagonal: "Diagonal",
  deep: "Fundo",
  short_tip: "Curta/largada",
};

export const DEFENSE_ATTACK_ORIGIN_ORDER: CourtVisualAttackOrigin[] = [
  "left",
  "middle",
  "right",
];

export const DEFENSE_KIND_ORDER: CourtVisualDefenseKind[] = [
  "parallel",
  "diagonal",
  "deep",
  "short_tip",
];

export const SETTER_POSITION_LABEL_BY_ROTATION: Record<
  CourtVisualRotationIndex,
  Brazilian5x1SetterPosition
> = {
  1: "P1",
  2: "P6",
  3: "P5",
  4: "P4",
  5: "P3",
  6: "P2",
};

export const getSetterPositionLabel = (
  rotationIndex: CourtVisualRotationIndex
): Brazilian5x1SetterPosition => SETTER_POSITION_LABEL_BY_ROTATION[rotationIndex];

export const BRAZILIAN_5X1_LINEUP_BY_SETTER_POSITION: Record<
  Brazilian5x1SetterPosition,
  Record<CourtZone, Brazilian5x1ActorId>
> = {
  P1: { 4: "op", 3: "c2", 2: "p1", 5: "p2", 6: "c1", 1: "lev" },
  P6: { 4: "p2", 3: "op", 2: "c2", 5: "c1", 6: "lev", 1: "p1" },
  P5: { 4: "c1", 3: "p2", 2: "op", 5: "lev", 6: "p1", 1: "c2" },
  P4: { 4: "lev", 3: "c1", 2: "p2", 5: "p1", 6: "c2", 1: "op" },
  P3: { 4: "p1", 3: "lev", 2: "c1", 5: "c2", 6: "op", 1: "p2" },
  P2: { 4: "c2", 3: "p1", 2: "lev", 5: "op", 6: "p2", 1: "c1" },
};

const setterPositionLabelByZone: Record<CourtZone, Brazilian5x1SetterPosition> = {
  1: "P1",
  6: "P6",
  5: "P5",
  4: "P4",
  3: "P3",
  2: "P2",
};

export const getNextOfficialRotationZone = (zone: CourtZone): CourtZone => {
  const currentIndex = OFFICIAL_VOLLEYBALL_ROTATION_PATH.indexOf(zone);
  return OFFICIAL_VOLLEYBALL_ROTATION_PATH[
    (currentIndex + 1) % OFFICIAL_VOLLEYBALL_ROTATION_PATH.length
  ];
};

const getOppositeOfficialZone = (zone: CourtZone): CourtZone => {
  const oppositeMap: Record<CourtZone, CourtZone> = {
    1: 4,
    2: 5,
    3: 6,
    4: 1,
    5: 2,
    6: 3,
  };
  return oppositeMap[zone];
};

const rotateZoneBackwards = (zone: CourtZone, steps: number): CourtZone => {
  let next = zone;
  for (let index = 0; index < steps; index += 1) {
    next = getNextOfficialRotationZone(next);
  }
  return next;
};

export const build5x1RotationZones = (setterZone: CourtZone) => {
  const lineup =
    BRAZILIAN_5X1_LINEUP_BY_SETTER_POSITION[setterPositionLabelByZone[setterZone]];
  const getZoneForActor = (actorId: Brazilian5x1ActorId) =>
    (Object.entries(lineup) as [string, Brazilian5x1ActorId][]).find(
      ([, id]) => id === actorId
    )?.[0];
  return {
    LEV: setterZone,
    OP: Number(getZoneForActor("op")) as CourtZone,
    P1: Number(getZoneForActor("p1")) as CourtZone,
    P2: Number(getZoneForActor("p2")) as CourtZone,
    C1: Number(getZoneForActor("c1")) as CourtZone,
    C2: Number(getZoneForActor("c2")) as CourtZone,
  } satisfies Record<string, CourtZone>;
};

export const defaultCourtVisualLayers: CourtVisualLayer[] = [
  { id: "zones", label: "Zonas", kind: "zones", visibleByDefault: true },
  { id: "actors", label: "Atletas", kind: "actors", visibleByDefault: true },
  { id: "markers", label: "Materiais", kind: "markers", visibleByDefault: true },
  { id: "arrows", label: "Setas", kind: "arrows", visibleByDefault: true },
  {
    id: "trajectories",
    label: "Trajetórias",
    kind: "trajectories",
    visibleByDefault: true,
  },
  {
    id: "highlights",
    label: "Destaques",
    kind: "highlights",
    visibleByDefault: true,
  },
];

const didacticTeamActors: CourtVisualActor[] = [
  {
    id: "a1",
    label: "Levantador",
    number: 1,
    role: "setter",
    color: "#3DDC84",
    initialPosition: getDidacticSlotCenter(1),
  },
  {
    id: "a2",
    label: "Ponteiro",
    number: 2,
    role: "outside",
    color: "#60A5FA",
    initialPosition: getDidacticSlotCenter(2),
  },
  {
    id: "a3",
    label: "Central",
    number: 3,
    role: "middle",
    color: "#F2A03D",
    initialPosition: getDidacticSlotCenter(3),
  },
  {
    id: "a4",
    label: "Oposto",
    number: 4,
    role: "opposite",
    color: "#E5484D",
    initialPosition: getDidacticSlotCenter(4),
  },
  {
    id: "a5",
    label: "Ponteiro",
    number: 5,
    role: "outside",
    color: "#A78BFA",
    initialPosition: getDidacticSlotCenter(5),
  },
  {
    id: "a6",
    label: "Libero",
    number: 6,
    role: "libero",
    color: "#14B8A6",
    initialPosition: getDidacticSlotCenter(6),
  },
];

export const buildDidacticRotationGridPreset = (): CourtVisualPayload => {
  const basePositions = Object.fromEntries(
    didacticTeamActors.map((actor) => [actor.id, actor.initialPosition])
  ) as Record<string, CourtPoint>;
  const nextRotationPositions: Record<string, CourtPoint> = {
    a1: getDidacticSlotCenter(2),
    a2: getDidacticSlotCenter(3),
    a3: getDidacticSlotCenter(6),
    a4: getDidacticSlotCenter(1),
    a5: getDidacticSlotCenter(4),
    a6: getDidacticSlotCenter(5),
  };
  const serveSlot = getDidacticSlotCenter(1);
  const targetSlot = getDidacticSlotCenter(2);

  return normalizeCourtPayload({
    version: 1,
    sport: "volleyball_indoor",
    court: {
      orientation: "vertical",
      showZones: true,
      layoutMode: "didactic_slots",
      labelMode: "slots",
      courtView: "team_half",
      renderStyle: "standard",
    },
    actors: didacticTeamActors,
    markers: [
      {
        id: "ball",
        type: "ball",
        label: "Bola",
        position: offsetPoint(serveSlot, { x: 0.08, y: 0.12 }),
        color: "#F2A03D",
      },
      {
        id: "target",
        type: "target",
        label: "Alvo",
        position: offsetPoint(targetSlot, { x: 0, y: -0.08 }),
        color: "#3DDC84",
      },
    ],
    layers: defaultCourtVisualLayers,
    timeline: {
      steps: [
        {
          id: "initial",
          label: "Posição inicial",
          durationMs: 1800,
          note: "Sistema 5x1 em base, com levantador no fundo.",
          actorPositions: basePositions,
          markerIds: ["ball"],
          highlights: [{ id: "slot-1", slot: 1, label: "Saque" }],
        },
        {
          id: "serve",
          label: "Saque",
          durationMs: 1800,
          note: "Saque indicado no slot 1, sem cruzar a grade didática.",
          actorPositions: basePositions,
          markerIds: ["ball", "target"],
          arrows: [
            {
              id: "serve-arrow",
              from: offsetPoint(serveSlot, { x: 0.06, y: 0.08 }),
              to: offsetPoint(serveSlot, { x: 0.1, y: -0.04 }),
              label: "Saque",
              color: "#F2A03D",
            },
          ],
          highlights: [{ id: "slot-1-serve", slot: 1, label: "Origem" }],
        },
        {
          id: "reception-w",
          label: "Recepção em W",
          durationMs: 2200,
          note: "Linha de passe abre em W e protege fundo de quadra.",
          actorPositions: {
            ...basePositions,
            a1: offsetPoint(getDidacticSlotCenter(1), { x: 0, y: 0.06 }),
            a4: offsetPoint(getDidacticSlotCenter(4), { x: 0, y: -0.06 }),
            a5: offsetPoint(getDidacticSlotCenter(5), { x: 0, y: -0.06 }),
            a6: offsetPoint(getDidacticSlotCenter(6), { x: 0, y: -0.06 }),
          },
          markerIds: ["target"],
          highlights: [
            { id: "slot-4-pass", slot: 4, label: "Passe" },
            { id: "slot-5-pass", slot: 5, label: "Passe" },
            { id: "slot-6-pass", slot: 6, label: "Passe" },
          ],
        },
        {
          id: "setter-entry",
          label: "Levantador infiltra",
          durationMs: 2200,
          note: "Levantador sai do fundo e entra para organizar o ataque.",
          actorPositions: {
            ...basePositions,
            a1: offsetPoint(getDidacticSlotCenter(2), { x: 0, y: 0.06 }),
          },
          trajectories: [
            {
              id: "setter-entry-line",
              actorId: "a1",
              points: [
                getDidacticSlotCenter(1),
                offsetPoint(getDidacticSlotCenter(2), { x: 0, y: 0.06 }),
              ],
              color: "#3DDC84",
            },
          ],
          highlights: [{ id: "slot-2-entry", slot: 2, label: "Entrada" }],
        },
        {
          id: "attack-cover",
          label: "Ataque e cobertura",
          durationMs: 2400,
          note: "Ataque pela entrada e cobertura fecha atras da bola.",
          actorPositions: {
            ...basePositions,
            a1: offsetPoint(getDidacticSlotCenter(2), { x: 0, y: 0.06 }),
            a3: offsetPoint(getDidacticSlotCenter(3), { x: -0.04, y: -0.04 }),
            a4: offsetPoint(getDidacticSlotCenter(4), { x: 0.04, y: -0.04 }),
            a5: offsetPoint(getDidacticSlotCenter(5), { x: 0, y: -0.05 }),
            a6: offsetPoint(getDidacticSlotCenter(6), { x: 0, y: -0.05 }),
          },
          arrows: [
            {
              id: "set-arrow",
              from: offsetPoint(getDidacticSlotCenter(2), { x: 0, y: 0.04 }),
              to: offsetPoint(getDidacticSlotCenter(3), { x: -0.04, y: -0.04 }),
              label: "Levantamento",
              color: "#3DDC84",
            },
            {
              id: "attack-arrow",
              from: offsetPoint(getDidacticSlotCenter(3), { x: -0.02, y: -0.04 }),
              to: offsetPoint(getDidacticSlotCenter(3), { x: 0.07, y: -0.08 }),
              label: "Ataque",
              color: "#E5484D",
            },
          ],
          highlights: [{ id: "slot-3-attack", slot: 3, label: "Ataque" }],
        },
        {
          id: "next-rotation",
          label: "Próxima rotação",
          durationMs: 2200,
          note: "Equipe gira uma posição no sentido do rodízio.",
          actorPositions: nextRotationPositions,
          trajectories: didacticTeamActors.map((actor) => ({
            id: `${actor.id}-rotation`,
            actorId: actor.id,
            points: [
              basePositions[actor.id],
              nextRotationPositions[actor.id],
            ],
            color: actor.color,
          })),
          highlights: [{ id: "rotation-highlight", slot: 5, label: "Giro" }],
        },
      ],
    },
  });
};

export const isDidacticRotation5x1Preset = (payload: CourtVisualPayload) => {
  if (
    payload.court.layoutMode !== "didactic_slots" ||
    payload.court.labelMode !== "slots"
  ) {
    return false;
  }
  const actorsByNumber = new Map(
    payload.actors
      .filter((actor) => typeof actor.number === "number")
      .map((actor) => [actor.number, actor])
  );
  return ([1, 2, 3, 4, 5, 6] as CourtDidacticSlot[]).every((slot) => {
    const actor = actorsByNumber.get(slot);
    if (!actor) return false;
    const expected = getDidacticSlotCenter(slot);
    const firstStepPoint =
      payload.timeline.steps[0]?.actorPositions[actor.id] ?? actor.initialPosition;
    return (
      actor.initialPosition.x === expected.x &&
      actor.initialPosition.y === expected.y &&
      firstStepPoint.x === expected.x &&
      firstStepPoint.y === expected.y
    );
  });
};

export const isOfficialRotation5x1Preset = (payload: CourtVisualPayload) => {
  if (
    payload.court.layoutMode !== "official_volleyball_zones" ||
    payload.court.labelMode !== "official_zones"
  ) {
    return false;
  }
  const setterZones = payload.timeline.steps
    .filter((step) => step.phase === "receive_legal")
    .map((step) => resolveCourtZone(step.legalPositions?.lev ?? step.actorPositions.lev));
  const situationIds = new Set(
    payload.timeline.steps.map((step) => step.phase)
  );
  return (
    JSON.stringify(setterZones) === JSON.stringify(SETTER_ROTATION_ZONES_5X1) &&
    situationIds.has("receive_legal") &&
    situationIds.has("receive_release")
  );
};

export const isDefenseBase6BackPreset = (payload: CourtVisualPayload) => {
  if (
    payload.court.layoutMode !== "official_volleyball_zones" ||
    payload.court.labelMode !== "official_zones"
  ) {
    return false;
  }
  const steps = payload.timeline.steps.filter(
    (step) => step.formationKind === "defense_base_6_back"
  );
  const rotations = new Set(steps.map((step) => step.rotationIndex));
  const origins = new Set(steps.map((step) => step.attackOrigin));
  const kinds = new Set(steps.map((step) => step.defenseKind));
  return (
    steps.length >=
      SETTER_ROTATION_ZONES_5X1.length *
        DEFENSE_ATTACK_ORIGIN_ORDER.length *
        DEFENSE_KIND_ORDER.length &&
    SETTER_ROTATION_ZONES_5X1.every((_, index) =>
      rotations.has((index + 1) as CourtVisualRotationIndex)
    ) &&
    DEFENSE_ATTACK_ORIGIN_ORDER.every((origin) => origins.has(origin)) &&
    DEFENSE_KIND_ORDER.every((kind) => kinds.has(kind)) &&
    steps.every(
      (step) =>
        step.phase === "defense_shape" &&
        step.sourceOfTruth === "coach_adjusted" &&
        step.initialLayout === "base_perimeter_6_back"
    )
  );
};

export const isServing5x1Preset = (payload: CourtVisualPayload) => {
  if (
    payload.court.layoutMode !== "official_volleyball_zones" ||
    payload.court.labelMode !== "official_zones"
  ) {
    return false;
  }
  const setterZones = payload.timeline.steps
    .filter((step) => step.phase === "serve_base")
    .map((step) => resolveCourtZone(step.legalPositions?.lev ?? step.actorPositions.lev));
  const situationIds = new Set(payload.timeline.steps.map((step) => step.phase));
  return (
    JSON.stringify(setterZones) === JSON.stringify(SETTER_ROTATION_ZONES_5X1) &&
    situationIds.has("serve_base") &&
    situationIds.has("serve_after_hit")
  );
};

const tacticalActors: CourtVisualActor[] = [
  {
    id: "lev",
    label: "Lv",
    role: "setter",
    color: "#3DDC84",
    baseColor: "#3DDC84",
    currentZone: 1,
    rotationOrder: 1,
    isBackRow: true,
    initialPosition: getOfficialZoneCenter(1),
  },
  {
    id: "op",
    label: "Op",
    role: "opposite",
    color: "#22C55E",
    baseColor: "#22C55E",
    currentZone: 4,
    rotationOrder: 4,
    isFrontRow: true,
    initialPosition: getOfficialZoneCenter(4),
  },
  {
    id: "p1",
    label: "P¹",
    role: "outside",
    color: "#60A5FA",
    baseColor: "#60A5FA",
    currentZone: 6,
    rotationOrder: 6,
    isBackRow: true,
    initialPosition: getOfficialZoneCenter(6),
  },
  {
    id: "p2",
    label: "P²",
    role: "outside",
    color: "#60A5FA",
    baseColor: "#60A5FA",
    currentZone: 3,
    rotationOrder: 3,
    isFrontRow: true,
    initialPosition: getOfficialZoneCenter(3),
  },
  {
    id: "c1",
    label: "C",
    role: "middle",
    color: "#8B5CF6",
    baseColor: "#8B5CF6",
    currentZone: 5,
    rotationOrder: 5,
    isBackRow: true,
    initialPosition: getOfficialZoneCenter(5),
  },
  {
    id: "c2",
    label: "C",
    role: "middle",
    color: "#8B5CF6",
    baseColor: "#8B5CF6",
    currentZone: 2,
    rotationOrder: 2,
    isFrontRow: true,
    initialPosition: getOfficialZoneCenter(2),
  },
  {
    id: "lib",
    label: "Lb",
    role: "libero",
    color: "#A78BFA",
    baseColor: "#A78BFA",
    currentZone: 5,
    rotationOrder: 0,
    isBackRow: true,
    initialPosition: getOfficialZoneCenter(5),
  },
];

const tacticalActorTemplateByLegendLabel: Record<
  CourtVisualLegendActorLabel,
  Pick<CourtVisualActor, "label" | "role" | "color" | "baseColor">
> = {
  Lv: { label: "Lv", role: "setter", color: "#3DDC84", baseColor: "#3DDC84" },
  Op: { label: "Op", role: "opposite", color: "#22C55E", baseColor: "#22C55E" },
  P: { label: "P", role: "outside", color: "#60A5FA", baseColor: "#60A5FA" },
  C: { label: "C", role: "middle", color: "#8B5CF6", baseColor: "#8B5CF6" },
  Lb: { label: "Lb", role: "libero", color: "#A78BFA", baseColor: "#A78BFA" },
};

const getActorBaseColor = (actorId: string) => {
  const actor = tacticalActors.find((item) => item.id === actorId);
  return actor?.baseColor ?? actor?.color ?? "#243447";
};

type TacticalActorKey = "LEV" | "OP" | "P1" | "P2" | "C1" | "C2";

const tacticalActorIdByKey: Record<TacticalActorKey, string> = {
  LEV: "lev",
  OP: "op",
  P1: "p1",
  P2: "p2",
  C1: "c1",
  C2: "c2",
};

const backRowZones: CourtZone[] = [5, 6, 1];
const frontRowZones: CourtZone[] = [4, 3, 2];

const pointInZone = (
  zone: CourtZone,
  offset: CourtPoint = { x: 0, y: 0 }
): CourtPoint => offsetPoint(getOfficialZoneCenter(zone), offset);

const buildOfficialPositions = (
  zones: Record<TacticalActorKey, CourtZone>,
  options: { libero?: boolean; kind?: "legal" | "receive" | "attack" | "serve" } = {}
) => {
  const positions: Record<string, CourtPoint> = {};
  const visibleActorIds: string[] = [];
  let liberoZone: CourtZone | null = null;
  (Object.entries(zones) as [TacticalActorKey, CourtZone][]).forEach(([key, zone]) => {
    const actorId = tacticalActorIdByKey[key];
    if (options.libero && (key === "C1" || key === "C2") && backRowZones.includes(zone)) {
      liberoZone = zone;
      return;
    }
    const rowOffset = frontRowZones.includes(zone) ? -0.04 : 0.04;
    const keyOffset: Record<TacticalActorKey, CourtPoint> = {
      LEV: { x: 0.03, y: rowOffset },
      OP: { x: -0.03, y: rowOffset },
      P1: { x: -0.04, y: rowOffset },
      P2: { x: 0.04, y: rowOffset },
      C1: { x: 0, y: rowOffset },
      C2: { x: 0, y: rowOffset },
    };
    positions[actorId] = pointInZone(zone, keyOffset[key]);
    visibleActorIds.push(actorId);
  });
  if (liberoZone) {
    positions.lib = pointInZone(liberoZone, { x: 0, y: 0.06 });
    visibleActorIds.push("lib");
  }
  return { positions, visibleActorIds };
};

const SETTER_RECEIVE_TARGET: CourtPoint = { x: 0.64, y: 0.18 };

type Receive3RotationTemplate = {
  receive: Record<string, CourtPoint>;
  attack: Record<string, CourtPoint>;
};

type Receive3PasserId = "p1" | "p2" | "lib";

type Receive3BeforeServeTemplate = {
  positions: Record<string, CourtPoint>;
  passers: Receive3PasserId[];
};

const receiveLinePositions: Record<string, CourtPoint> = {
  p1: { x: 0.18, y: 0.68 },
  lib: { x: 0.5, y: 0.76 },
  p2: { x: 0.82, y: 0.68 },
};

const attackSlotPositions: Record<CourtZone, CourtPoint> = {
  1: { x: 0.78, y: 0.58 },
  2: { x: 0.84, y: 0.15 },
  3: { x: 0.5, y: 0.13 },
  4: { x: 0.16, y: 0.15 },
  5: { x: 0.22, y: 0.58 },
  6: { x: 0.5, y: 0.54 },
};

const baseReceivePositions: Record<string, CourtPoint> = {
  lev: SETTER_RECEIVE_TARGET,
  op: { x: 0.84, y: 0.23 },
  p1: receiveLinePositions.p1,
  p2: receiveLinePositions.p2,
  c1: { x: 0.5, y: 0.2 },
  c2: { x: 0.5, y: 0.2 },
  lib: receiveLinePositions.lib,
};

const receive3RotationTemplates: Record<CourtVisualRotationIndex, Receive3RotationTemplate> = {
  1: {
    receive: {
      ...baseReceivePositions,
      lev: { x: 0.82, y: 0.82 },
      op: { x: 0.14, y: 0.22 },
      c2: { x: 0.5, y: 0.21 },
      p1: { x: 0.82, y: 0.62 },
      p2: { x: 0.18, y: 0.68 },
      lib: { x: 0.5, y: 0.74 },
    },
    attack: {
      lev: SETTER_RECEIVE_TARGET,
      op: { x: 0.16, y: 0.17 },
      c2: { x: 0.5, y: 0.14 },
      p1: { x: 0.84, y: 0.18 },
      p2: { x: 0.2, y: 0.72 },
      lib: { x: 0.5, y: 0.78 },
    },
  },
  2: {
    receive: {
      ...baseReceivePositions,
      lev: { x: 0.6, y: 0.22 },
      op: { x: 0.5, y: 0.14 },
      c1: { x: 0.14, y: 0.18 },
    },
    attack: {
      lev: SETTER_RECEIVE_TARGET,
      op: attackSlotPositions[3],
      p1: receiveLinePositions.p1,
      p2: attackSlotPositions[2],
      c1: attackSlotPositions[4],
      lib: receiveLinePositions.lib,
    },
  },
  3: {
    receive: {
      ...baseReceivePositions,
      lev: { x: 0.56, y: 0.24 },
      op: { x: 0.84, y: 0.16 },
      p1: { x: 0.18, y: 0.58 },
      c1: { x: 0.5, y: 0.14 },
    },
    attack: {
      lev: SETTER_RECEIVE_TARGET,
      op: attackSlotPositions[2],
      p1: attackSlotPositions[4],
      p2: { x: 0.76, y: 0.58 },
      c1: attackSlotPositions[3],
      lib: receiveLinePositions.lib,
    },
  },
  4: {
    receive: {
      ...baseReceivePositions,
      lev: { x: 0.42, y: 0.22 },
      op: { x: 0.78, y: 0.58 },
      p1: { x: 0.5, y: 0.13 },
      c1: { x: 0.84, y: 0.16 },
    },
    attack: {
      lev: SETTER_RECEIVE_TARGET,
      op: { x: 0.78, y: 0.58 },
      p1: attackSlotPositions[3],
      p2: receiveLinePositions.p2,
      c1: attackSlotPositions[2],
      lib: receiveLinePositions.lib,
    },
  },
  5: {
    receive: {
      ...baseReceivePositions,
      lev: { x: 0.54, y: 0.2 },
      op: { x: 0.5, y: 0.58 },
      p1: { x: 0.84, y: 0.16 },
      c2: { x: 0.15, y: 0.16 },
    },
    attack: {
      lev: SETTER_RECEIVE_TARGET,
      op: { x: 0.5, y: 0.56 },
      p1: attackSlotPositions[2],
      p2: receiveLinePositions.p2,
      c2: attackSlotPositions[4],
      lib: receiveLinePositions.lib,
    },
  },
  6: {
    receive: {
      ...baseReceivePositions,
      lev: { x: 0.72, y: 0.18 },
      op: { x: 0.16, y: 0.58 },
      p2: { x: 0.18, y: 0.6 },
      c2: { x: 0.5, y: 0.13 },
    },
    attack: {
      lev: SETTER_RECEIVE_TARGET,
      op: { x: 0.16, y: 0.58 },
      p1: receiveLinePositions.p1,
      p2: attackSlotPositions[4],
      c2: attackSlotPositions[3],
      lib: receiveLinePositions.lib,
    },
  },
};

const RECEIVE_3_BEFORE_SERVE_BY_SETTER_POSITION: Record<
  Brazilian5x1SetterPosition,
  Receive3BeforeServeTemplate
> = {
  P1: {
    passers: ["p2", "lib", "p1"],
    positions: {
      op: { x: 0.17, y: 0.18 },
      c2: { x: 0.5, y: 0.18 },
      p1: { x: 0.78, y: 0.7 },
      p2: { x: 0.22, y: 0.7 },
      lib: { x: 0.5, y: 0.74 },
      lev: { x: 0.88, y: 0.82 },
    },
  },
  P6: {
    passers: ["p2", "lib", "p1"],
    positions: {
      p2: { x: 0.22, y: 0.7 },
      op: { x: 0.8193, y: 0.1132 },
      c2: { x: 0.92, y: 0.4634 },
      lib: { x: 0.5, y: 0.74 },
      lev: { x: 0.6456, y: 0.2742 },
      p1: { x: 0.78, y: 0.7 },
    },
  },
  P5: {
    passers: ["p2", "p1", "lib"],
    positions: {
      c1: { x: 0.143, y: 0.1569 },
      p2: { x: 0.1721, y: 0.7185 },
      op: { x: 0.9496, y: 0.4161 },
      lev: { x: 0.3343, y: 0.5236 },
      p1: { x: 0.4922, y: 0.7663 },
      lib: { x: 0.8138, y: 0.7261 },
    },
  },
  P4: {
    passers: ["p1", "lib", "p2"],
    positions: {
      lev: { x: 0.0643, y: 0.1151 },
      c1: { x: 0.1389, y: 0.4159 },
      p2: { x: 0.78, y: 0.7 },
      p1: { x: 0.22, y: 0.6745 },
      lib: { x: 0.5, y: 0.74 },
      op: { x: 0.9109, y: 0.9334 },
    },
  },
  P3: {
    passers: ["p1", "lib", "p2"],
    positions: {
      p1: { x: 0.1613, y: 0.6375 },
      lev: { x: 0.5556, y: 0.1739 },
      c1: { x: 0.9095, y: 0.3884 },
      lib: { x: 0.4414, y: 0.74 },
      op: { x: 0.6389, y: 0.9211 },
      p2: { x: 0.78, y: 0.7 },
    },
  },
  P2: {
    passers: ["p1", "p2", "lib"],
    positions: {
      c2: { x: 0.0349, y: 0.4392 },
      p1: { x: 0.1814, y: 0.6768 },
      lev: { x: 0.553, y: 0.1707 },
      op: { x: 0.3406, y: 0.9334 },
      p2: { x: 0.5107, y: 0.7477 },
      lib: { x: 0.8293, y: 0.6798 },
    },
  },
};

const pickVisiblePositions = (
  templatePositions: Record<string, CourtPoint>,
  fallbackPositions: Record<string, CourtPoint>,
  visibleActorIds: string[]
) =>
  visibleActorIds.reduce<Record<string, CourtPoint>>((positions, actorId) => {
    positions[actorId] = templatePositions[actorId] ?? fallbackPositions[actorId];
    return positions;
  }, {});

const getActorIdAtZone = (
  zones: Record<TacticalActorKey, CourtZone>,
  zone: CourtZone
) => {
  const item = (Object.entries(zones) as [TacticalActorKey, CourtZone][]).find(
    ([, actorZone]) => actorZone === zone
  );
  return item ? tacticalActorIdByKey[item[0]] : "lev";
};

const getPasserIds = (
  setterPositionLabel: Brazilian5x1SetterPosition,
  visibleActorIds: string[]
) =>
  RECEIVE_3_BEFORE_SERVE_BY_SETTER_POSITION[setterPositionLabel].passers.filter(
    (actorId) => visibleActorIds.includes(actorId)
  );

type DefenseBase6BackTemplate = Record<string, CourtPoint>;

const DEFENSE_BASE_6_BACK_BY_SETTER_POSITION: Record<
  Brazilian5x1SetterPosition,
  DefenseBase6BackTemplate
> = {
  P1: {
    lev: { x: 0.8328, y: 0.737 },
    op: { x: 0.1367, y: 0.21 },
    p1: { x: 0.7933, y: 0.21 },
    p2: { x: 0.5159, y: 0.7341 },
    c2: { x: 0.5, y: 0.21 },
    lib: { x: 0.166, y: 0.7355 },
  },
  P6: {
    lev: { x: 0.822, y: 0.8 },
    op: { x: 0.8116, y: 0.2386 },
    p1: { x: 0.4975, y: 0.7958 },
    p2: { x: 0.1762, y: 0.2702 },
    c2: { x: 0.5069, y: 0.2702 },
    lib: { x: 0.182, y: 0.7986 },
  },
  P5: {
    lev: { x: 0.8666, y: 0.7585 },
    op: { x: 0.8338, y: 0.2386 },
    p1: { x: 0.5058, y: 0.7714 },
    p2: { x: 0.1812, y: 0.2443 },
    c1: { x: 0.5064, y: 0.2358 },
    lib: { x: 0.1577, y: 0.7527 },
  },
  P4: {
    lev: { x: 0.8475, y: 0.2529 },
    op: { x: 0.8491, y: 0.7342 },
    p1: { x: 0.5102, y: 0.7442 },
    p2: { x: 0.1652, y: 0.2385 },
    c1: { x: 0.5, y: 0.2329 },
    lib: { x: 0.1489, y: 0.7413 },
  },
  P3: {
    lev: { x: 0.8373, y: 0.2558 },
    op: { x: 0.8479, y: 0.78 },
    p1: { x: 0.163, y: 0.2616 },
    p2: { x: 0.5107, y: 0.7757 },
    c1: { x: 0.5203, y: 0.2386 },
    lib: { x: 0.1572, y: 0.7713 },
  },
  P2: {
    lev: { x: 0.8499, y: 0.2673 },
    op: { x: 0.8581, y: 0.78 },
    p1: { x: 0.1756, y: 0.2671 },
    p2: { x: 0.498, y: 0.7857 },
    c2: { x: 0.5102, y: 0.2673 },
    lib: { x: 0.1386, y: 0.7642 },
  },
};

const getAttackZoneIds = (
  zones: Record<TacticalActorKey, CourtZone>,
  visibleActorIds: string[]
) => {
  const frontRowAttackers = (Object.entries(zones) as [TacticalActorKey, CourtZone][])
    .filter(([key, zone]) => key !== "LEV" && !backRowZones.includes(zone))
    .sort(([, zoneA], [, zoneB]) => (
      frontRowZones.indexOf(zoneA) - frontRowZones.indexOf(zoneB)
    ))
    .map(([key]) => tacticalActorIdByKey[key])
    .filter((actorId) => visibleActorIds.includes(actorId));

  if (frontRowAttackers.length >= 3) return frontRowAttackers;

  const backRowOption = ["p1", "p2", "op"].find(
    (actorId) => visibleActorIds.includes(actorId) && !frontRowAttackers.includes(actorId)
  );
  return backRowOption ? [...frontRowAttackers, backRowOption] : frontRowAttackers;
};

const buildReceive3RotationSteps = (
  rotationNumber: number,
  setterZone: CourtZone
): CourtVisualStep[] => {
  const zones = build5x1RotationZones(setterZone);
  const legal = buildOfficialPositions(zones);
  const receive = buildOfficialPositions(zones, { libero: true });
  const template = receive3RotationTemplates[rotationNumber as CourtVisualRotationIndex];
  const setterPositionLabel = getSetterPositionLabel(
    rotationNumber as CourtVisualRotationIndex
  );
  const receiveBeforeServe =
    RECEIVE_3_BEFORE_SERVE_BY_SETTER_POSITION[setterPositionLabel];
  const receivePositions = pickVisiblePositions(
    receiveBeforeServe.positions,
    receive.positions,
    receive.visibleActorIds
  );
  const releaseBasePositions = pickVisiblePositions(
    template.receive,
    receive.positions,
    receive.visibleActorIds
  );
  const setterTarget = SETTER_RECEIVE_TARGET;
  const releasePositions: Record<string, CourtPoint> = {
    ...releaseBasePositions,
    lev: setterTarget,
  };
  const passers = getPasserIds(setterPositionLabel, receive.visibleActorIds);
  const prefix = `r${rotationNumber}`;
  const releaseTrajectories: CourtVisualTrajectory[] = receive.visibleActorIds
    .map<CourtVisualTrajectory | null>((actorId) => {
      const from = receivePositions[actorId] ?? legal.positions[actorId];
      const to = releasePositions[actorId] ?? from;
      if (!from || getPointDistance(from, to) <= 0.015) return null;
      return {
        id: `${prefix}-release-${actorId}`,
        actorId,
        points: [from, to],
        color: getActorBaseColor(actorId),
      };
    })
    .filter((item): item is CourtVisualTrajectory => item !== null);
  const passerHighlights = passers.map((actorId, index) => ({
    id: `${prefix}-passer-${actorId}`,
    zone: resolveCourtZone(releaseBasePositions[actorId] ?? receive.positions[actorId]),
    label: index === 0 ? "Passe" : undefined,
    color: "rgba(20,184,166,0.14)",
  }));

  return [
    {
      id: `${prefix}_receive_legal`,
      label: `${setterPositionLabel} - antes do saque`,
      durationMs: 2200,
      note: "Formação legal antes do saque adversário.",
      actorPositions: receivePositions,
      baselineActorPositions: receivePositions,
      legalPositions: legal.positions,
      tacticalPositions: receivePositions,
      rotationIndex: rotationNumber as CourtVisualRotationIndex,
      phase: "receive_legal",
      formationKind: "5x1_receive_3",
      visibleActorIds: receive.visibleActorIds,
      passers,
      setterTarget,
      visibleLayerIds: ["zones", "actors"],
    },
    {
      id: `${prefix}_receive_release`,
      label: `${setterPositionLabel} - após o saque`,
      durationMs: 2200,
      note: "Passe para o alvo e infiltração do levantador.",
      actorPositions: releasePositions,
      legalPositions: legal.positions,
      tacticalPositions: releasePositions,
      transitions: releaseTrajectories,
      trajectories: releaseTrajectories,
      rotationIndex: rotationNumber as CourtVisualRotationIndex,
      phase: "receive_release",
      formationKind: "5x1_receive_3",
      visibleActorIds: receive.visibleActorIds,
      markerIds: ["receive-target"],
      passers,
      setterTarget,
      highlights: [
        ...passerHighlights,
        { id: `${prefix}-setter-target`, zone: 2, color: "rgba(61,220,132,0.1)" },
      ],
      visibleLayerIds: ["zones", "actors", "markers", "trajectories", "highlights"],
    },
  ];
};

export const build5x1Receive3Preset = (): CourtVisualPayload => {
  const rotationSteps = SETTER_ROTATION_ZONES_5X1.flatMap((setterZone, index) =>
    buildReceive3RotationSteps(index + 1, setterZone)
  );

  return normalizeCourtPayload({
    version: 1,
    sport: "volleyball_indoor",
    court: {
      orientation: "vertical",
      showZones: true,
      layoutMode: "official_volleyball_zones",
      labelMode: "official_zones",
      courtView: "team_half",
      renderStyle: "coach_board",
    },
    actors: tacticalActors,
    markers: [
      {
        id: "serve-ball",
        type: "ball",
        label: "Bola",
        position: offsetPoint(getOfficialZoneCenter(1), { x: 0.08, y: 0.14 }),
        color: "#F2A03D",
      },
      {
        id: "receive-target",
        type: "target",
        position: SETTER_RECEIVE_TARGET,
        color: "#3DDC84",
      },
    ],
    layers: defaultCourtVisualLayers,
    timeline: {
      steps: rotationSteps,
    },
  });
};

const rolePointByAttackOrigin: Record<
  CourtVisualAttackOrigin,
  Record<CourtVisualDefenseKind, CourtPoint>
> = {
  left: {
    parallel: { x: 0.18, y: 0.66 },
    diagonal: { x: 0.82, y: 0.7 },
    deep: { x: 0.5, y: 0.88 },
    short_tip: { x: 0.5, y: 0.36 },
  },
  middle: {
    parallel: { x: 0.2, y: 0.7 },
    diagonal: { x: 0.8, y: 0.7 },
    deep: { x: 0.5, y: 0.9 },
    short_tip: { x: 0.5, y: 0.33 },
  },
  right: {
    parallel: { x: 0.82, y: 0.66 },
    diagonal: { x: 0.18, y: 0.7 },
    deep: { x: 0.5, y: 0.88 },
    short_tip: { x: 0.5, y: 0.36 },
  },
};

const defenseKindOffset: Record<CourtVisualDefenseKind, Partial<Record<CourtVisualDefenseKind, CourtPoint>>> = {
  parallel: {
    parallel: { x: 0, y: -0.04 },
    diagonal: { x: 0, y: 0.03 },
  },
  diagonal: {
    diagonal: { x: 0, y: -0.04 },
    deep: { x: 0, y: 0.02 },
  },
  deep: {
    deep: { x: 0, y: 0.05 },
  },
  short_tip: {
    short_tip: { x: 0, y: -0.07 },
    deep: { x: 0, y: 0.02 },
  },
};

const getActorIdAtLegalZone = (
  positions: Record<string, CourtPoint>,
  visibleActorIds: string[],
  zone: CourtZone
) =>
  visibleActorIds.find((actorId) => resolveCourtZone(positions[actorId]) === zone);

const pickFirstDefined = (...values: (string | undefined)[]) =>
  values.find((value): value is string => Boolean(value));

const buildDefensiveRoles = (
  legalPositions: Record<string, CourtPoint>,
  visibleActorIds: string[],
  attackOrigin: CourtVisualAttackOrigin
): Record<string, CourtVisualDefensiveRole> => {
  const byZone = (zone: CourtZone) =>
    getActorIdAtLegalZone(legalPositions, visibleActorIds, zone);
  const parallelActor =
    attackOrigin === "right" ? byZone(1) : pickFirstDefined(byZone(5), byZone(4));
  const diagonalActor =
    attackOrigin === "right" ? byZone(5) : pickFirstDefined(byZone(1), byZone(2));
  const deepActor = pickFirstDefined(byZone(6), visibleActorIds.includes("lib") ? "lib" : undefined);
  const shortTipActor = pickFirstDefined(
    byZone(3),
    attackOrigin === "left" ? byZone(4) : attackOrigin === "right" ? byZone(2) : undefined,
    visibleActorIds.find((actorId) => ![parallelActor, diagonalActor, deepActor].includes(actorId))
  );
  const roles: Record<string, CourtVisualDefensiveRole> = {};
  if (parallelActor) roles[parallelActor] = "parallel";
  if (diagonalActor) roles[diagonalActor] = "diagonal";
  if (deepActor) roles[deepActor] = "deep";
  if (shortTipActor) roles[shortTipActor] = "short_tip";
  visibleActorIds.forEach((actorId) => {
    roles[actorId] ??= "deep";
  });
  return roles;
};

const buildDefensePositions = (
  legalPositions: Record<string, CourtPoint>,
  visibleActorIds: string[],
  setterPositionLabel: Brazilian5x1SetterPosition
) => {
  return pickVisiblePositions(
    DEFENSE_BASE_6_BACK_BY_SETTER_POSITION[setterPositionLabel],
    legalPositions,
    visibleActorIds
  );
};

const buildDefenseBaseSteps = (
  rotationNumber: number,
  setterZone: CourtZone
): CourtVisualStep[] => {
  const zones = build5x1RotationZones(setterZone);
  const legal = buildOfficialPositions(zones, { libero: true, kind: "serve" });
  const prefix = `d${rotationNumber}`;
  const setterPositionLabel = getSetterPositionLabel(
    rotationNumber as CourtVisualRotationIndex
  );

  return DEFENSE_ATTACK_ORIGIN_ORDER.flatMap((attackOrigin) =>
    DEFENSE_KIND_ORDER.map((defenseKind) => {
      const defensiveRoles = buildDefensiveRoles(
        legal.positions,
        legal.visibleActorIds,
        attackOrigin
      );
      const actorPositions = buildDefensePositions(
        legal.positions,
        legal.visibleActorIds,
        setterPositionLabel
      );

      return {
        id: `${prefix}_${attackOrigin}_${defenseKind}`,
        label: `${setterPositionLabel} - defesa`,
        durationMs: 2400,
        note: "Preset aproximado. Ajuste conforme o modelo defensivo da sua equipe.",
        actorPositions,
        baselineActorPositions: actorPositions,
        legalPositions: legal.positions,
        tacticalPositions: actorPositions,
        rotationIndex: rotationNumber as CourtVisualRotationIndex,
        phase: "defense_shape" as const,
        formationKind: "defense_base_6_back" as const,
        visibleActorIds: legal.visibleActorIds,
        attackOrigin,
        defenseKind,
        defensiveRoles,
        sourceOfTruth: "coach_adjusted" as const,
        initialLayout: "base_perimeter_6_back" as const,
        highlights: [
          {
            id: `${prefix}-${attackOrigin}-${defenseKind}-origin`,
            zone: attackOrigin === "left" ? 4 : attackOrigin === "right" ? 2 : 3,
            label: DEFENSE_ATTACK_ORIGIN_LABELS[attackOrigin],
            color: "rgba(242,160,61,0.14)",
          },
          {
            id: `${prefix}-${attackOrigin}-${defenseKind}-kind`,
            zone: defenseKind === "deep" ? 6 : defenseKind === "parallel" ? 5 : defenseKind === "diagonal" ? 1 : 3,
            label: DEFENSE_KIND_LABELS[defenseKind],
            color: "rgba(96,165,250,0.12)",
          },
        ],
        visibleLayerIds: ["zones", "actors", "highlights"],
      };
    })
  );
};

export const buildDefenseBase6BackPreset = (): CourtVisualPayload => {
  const defenseSteps = SETTER_ROTATION_ZONES_5X1.flatMap((setterZone, index) =>
    buildDefenseBaseSteps(index + 1, setterZone)
  );

  return normalizeCourtPayload({
    version: 1,
    sport: "volleyball_indoor",
    court: {
      orientation: "vertical",
      showZones: true,
      layoutMode: "official_volleyball_zones",
      labelMode: "official_zones",
      courtView: "team_half",
      renderStyle: "coach_board",
    },
    actors: tacticalActors,
    markers: [],
    layers: defaultCourtVisualLayers,
    timeline: {
      steps: defenseSteps,
    },
  });
};

const SERVING_LIBERO_OFF_COURT_POSITION: CourtPoint = { x: -0.16, y: 0.82 };

const SERVING_BASE_BY_SETTER_POSITION: Record<
  Brazilian5x1SetterPosition,
  Record<string, CourtPoint>
> = {
  P1: {
    lev: { x: 0.8385, y: 0.9804 },
    op: { x: 0.8371, y: 0.2214 },
    p1: { x: 0.1502, y: 0.2301 },
    p2: { x: 0.5197, y: 0.7584 },
    c1: { x: 0.1488, y: 0.7514 },
    c2: { x: 0.5115, y: 0.2243 },
  },
  P6: {
    lev: { x: 0.8372, y: 0.7457 },
    op: { x: 0.8327, y: 0.2413 },
    p1: { x: 0.8411, y: 0.9746 },
    p2: { x: 0.1609, y: 0.2358 },
    c1: { x: 0.1648, y: 0.7557 },
    c2: { x: 0.5127, y: 0.2301 },
  },
  P5: {
    lev: { x: 0.8265, y: 0.7013 },
    op: { x: 0.8033, y: 0.21 },
    p1: { x: 0.5096, y: 0.7013 },
    p2: { x: 0.1621, y: 0.2388 },
    c1: { x: 0.5045, y: 0.2301 },
    c2: { x: 0.8276, y: 0.9617 },
    lib: SERVING_LIBERO_OFF_COURT_POSITION,
  },
  P4: {
    lev: { x: 0.8418, y: 0.2329 },
    op: { x: 0.8529, y: 0.9804 },
    p1: { x: 0.4988, y: 0.7514 },
    p2: { x: 0.1577, y: 0.2358 },
    c1: { x: 0.5076, y: 0.2273 },
    c2: { x: 0.1679, y: 0.7542 },
  },
  P3: {
    lev: { x: 0.8354, y: 0.2328 },
    op: { x: 0.8326, y: 0.727 },
    p1: { x: 0.1706, y: 0.2529 },
    p2: { x: 0.8504, y: 0.9846 },
    c1: { x: 0.5051, y: 0.2358 },
    c2: { x: 0.1667, y: 0.7299 },
  },
  P2: {
    lev: { x: 0.8557, y: 0.2816 },
    op: { x: 0.8352, y: 0.7185 },
    p1: { x: 0.1547, y: 0.2616 },
    p2: { x: 0.477, y: 0.7213 },
    c1: { x: 0.8467, y: 0.9961 },
    c2: { x: 0.5178, y: 0.2844 },
    lib: SERVING_LIBERO_OFF_COURT_POSITION,
  },
};

const buildServingRotationSteps = (
  rotationNumber: number,
  setterZone: CourtZone
): CourtVisualStep[] => {
  const zones = build5x1RotationZones(setterZone);
  const legal = buildOfficialPositions(zones);
  const setterPositionLabel = getSetterPositionLabel(
    rotationNumber as CourtVisualRotationIndex
  );
  const serveBase = SERVING_BASE_BY_SETTER_POSITION[setterPositionLabel];
  const visibleActorIds = Object.keys(serveBase);
  const serverActorId =
    getActorIdAtLegalZone(serveBase, visibleActorIds, 1) ?? getActorIdAtZone(zones, 1);
  const afterServe: Record<string, CourtPoint> = {
    ...serveBase,
    [serverActorId]: offsetPoint(serveBase[serverActorId], { x: -0.04, y: -0.08 }),
  };
  const prefix = `s${rotationNumber}`;
  return [
    {
      id: `${prefix}_serve_base`,
      label: `${setterPositionLabel} - saque`,
      durationMs: 1800,
      note: "Equipe sacando: o sacador é destacado; demais jogadores já podem estar em base.",
      actorPositions: serveBase,
      baselineActorPositions: serveBase,
      legalPositions: legal.positions,
      tacticalPositions: serveBase,
      rotationIndex: rotationNumber as CourtVisualRotationIndex,
      phase: "serve_base",
      formationKind: "5x1_serving",
      visibleActorIds,
      setterTarget: serveBase.lev,
      highlights: [{ id: `${prefix}-server`, zone: 1, label: "Sacador" }],
    },
    {
      id: `${prefix}_serve_after_hit`,
      label: `${setterPositionLabel} - após o saque`,
      durationMs: 2200,
      note: "Após o saque, a equipe organiza cobertura e defesa sem cruzar a leitura da quadra.",
      actorPositions: afterServe,
      baselineActorPositions: afterServe,
      legalPositions: legal.positions,
      tacticalPositions: afterServe,
      transitions: [
        {
          id: `${prefix}-server-return`,
          actorId: serverActorId,
          points: [serveBase[serverActorId], afterServe[serverActorId]],
          color: "#F2A03D",
        },
      ],
      trajectories: [
        {
          id: `${prefix}-server-return`,
          actorId: serverActorId,
          points: [serveBase[serverActorId], afterServe[serverActorId]],
          color: "#F2A03D",
        },
      ],
      rotationIndex: rotationNumber as CourtVisualRotationIndex,
      phase: "serve_after_hit",
      formationKind: "5x1_serving",
      visibleActorIds,
      highlights: [{ id: `${prefix}-defense`, zone: 6, label: "Base" }],
    },
  ];
};

export const build5x1ServingPreset = (): CourtVisualPayload => {
  const rotationSteps = SETTER_ROTATION_ZONES_5X1.flatMap((setterZone, index) =>
    buildServingRotationSteps(index + 1, setterZone)
  );

  return normalizeCourtPayload({
    version: 1,
    sport: "volleyball_indoor",
    court: {
      orientation: "vertical",
      showZones: true,
      layoutMode: "official_volleyball_zones",
      labelMode: "official_zones",
      courtView: "team_half",
      renderStyle: "coach_board",
    },
    actors: tacticalActors,
    markers: [],
    layers: defaultCourtVisualLayers,
    timeline: {
      steps: rotationSteps,
    },
  });
};

export const buildRotation5x1Preset = build5x1Receive3Preset;

export const getVisibleLayerIdsForStep = (
  payload: CourtVisualPayload,
  step: CourtVisualStep
) =>
  step.visibleLayerIds ??
  payload.layers
    .filter((layer) => layer.visibleByDefault)
    .map((layer) => layer.id);

export const shouldDisplayCourtMovementLines = ({
  animationProgress,
  forceShowMovementLines,
  movementLineCount,
}: {
  animationProgress?: number;
  forceShowMovementLines?: boolean;
  movementLineCount: number;
}) =>
  Boolean(forceShowMovementLines) ||
  (typeof animationProgress === "number" && movementLineCount > 0);

export const getStepAtIndex = (
  payload: CourtVisualPayload,
  index: number
) => {
  const steps = payload.timeline.steps;
  if (!steps.length) {
    throw new Error("Timeline visual sem passos.");
  }
  const safeIndex = Math.min(steps.length - 1, Math.max(0, index));
  return steps[safeIndex];
};

const MANUAL_MOVE_TRAJECTORY_PREFIX = "manual-move";
const MANUAL_MOVE_TRAJECTORY_FALLBACK_COLOR = "#243447";

const getPointDistance = (from: CourtPoint, to: CourtPoint) =>
  Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

const addVisibleLayer = (
  visibleLayerIds: CourtVisualStep["visibleLayerIds"],
  layerId: CourtVisualLayer["id"]
) => {
  if (!visibleLayerIds) return visibleLayerIds;
  return visibleLayerIds.includes(layerId)
    ? visibleLayerIds
    : [...visibleLayerIds, layerId];
};

const removeVisibleLayer = (
  visibleLayerIds: CourtVisualStep["visibleLayerIds"],
  layerId: CourtVisualLayer["id"]
) => visibleLayerIds?.filter((item) => item !== layerId);

const removeManualMoveTrajectories = (
  step: CourtVisualStep,
  actorIds: string[]
) => {
  const actorIdSet = new Set(actorIds);
  const nextTrajectories = step.trajectories?.filter(
    (trajectory) =>
      !(
        trajectory.id.startsWith(`${MANUAL_MOVE_TRAJECTORY_PREFIX}-`) &&
        trajectory.actorId &&
        actorIdSet.has(trajectory.actorId)
      )
  );
  const hasTrajectories = Boolean(nextTrajectories?.length);

  return {
    trajectories: hasTrajectories ? nextTrajectories : undefined,
    visibleLayerIds: hasTrajectories
      ? step.visibleLayerIds
      : removeVisibleLayer(step.visibleLayerIds, "trajectories"),
  };
};

const getManualMoveOriginPositions = (step: CourtVisualStep) =>
  (step.trajectories ?? step.transitions ?? []).reduce<Record<string, CourtPoint>>(
    (positions, trajectory) => {
      if (
        trajectory.id.startsWith(`${MANUAL_MOVE_TRAJECTORY_PREFIX}-`) &&
        trajectory.actorId &&
        trajectory.points[0]
      ) {
        positions[trajectory.actorId] = normalizeExtendedCourtPoint(trajectory.points[0]);
      }
      return positions;
    },
    {}
  );

const getMovementOriginPositions = (step: CourtVisualStep) =>
  (step.trajectories ?? step.transitions ?? []).reduce<Record<string, CourtPoint>>(
    (positions, trajectory) => {
      if (trajectory.actorId && trajectory.points[0]) {
        positions[trajectory.actorId] = normalizeExtendedCourtPoint(trajectory.points[0]);
      }
      return positions;
    },
    {}
  );

const getActorInitialPositions = (payload: CourtVisualPayload) =>
  Object.fromEntries(
    payload.actors.map((actor) => [
      actor.id,
      normalizeExtendedCourtPoint(actor.initialPosition),
    ])
  ) as Record<string, CourtPoint>;

const getDefaultReceiveBaselinePositions = (step: CourtVisualStep) => {
  if (step.formationKind !== "5x1_receive_3" || step.phase !== "receive_legal") {
    return {};
  }
  const setterPositionLabel = step.rotationIndex
    ? getSetterPositionLabel(step.rotationIndex)
    : undefined;
  return setterPositionLabel
    ? RECEIVE_3_BEFORE_SERVE_BY_SETTER_POSITION[setterPositionLabel]?.positions ?? {}
    : {};
};

const getDefaultDefenseBaselinePositions = (step: CourtVisualStep) => {
  if (step.formationKind !== "defense_base_6_back" || !step.rotationIndex) {
    return {};
  }
  return DEFENSE_BASE_6_BACK_BY_SETTER_POSITION[
    getSetterPositionLabel(step.rotationIndex)
  ] ?? {};
};

const getDefenseBaseGroupKey = (step: CourtVisualStep) =>
  step.formationKind === "defense_base_6_back" && step.rotationIndex
    ? `${step.rotationIndex}`
    : "";

const getDefenseBaseCanonicalPositions = (step: CourtVisualStep) => {
  const fallback = getDefaultDefenseBaselinePositions(step);
  const sourcePositions = step.baselineActorPositions ?? step.actorPositions;
  const actorIds = step.visibleActorIds ?? Object.keys(sourcePositions);
  return actorIds.reduce<Record<string, CourtPoint>>((positions, actorId) => {
    const point =
      sourcePositions[actorId] ??
      fallback[actorId] ??
      step.actorPositions[actorId];
    if (point) positions[actorId] = normalizeExtendedCourtPoint(point);
    return positions;
  }, {});
};

export const normalizeDefenseBase6BackPayload = (
  payload: CourtVisualPayload
): CourtVisualPayload => {
  const canonicalByGroup = new Map<
    string,
    { positions: Record<string, CourtPoint>; score: number }
  >();

  payload.timeline.steps.forEach((step) => {
    const groupKey = getDefenseBaseGroupKey(step);
    if (!groupKey) return;
    const current = canonicalByGroup.get(groupKey);
    const canonicalPositions = getDefenseBaseCanonicalPositions(step);
    const score =
      step.attackOrigin === "left" && step.defenseKind === "parallel"
        ? 1000
        : step.attackOrigin === "left"
          ? 500
          : step.defenseKind === "parallel"
            ? 100
            : 0;
    if (current && current.score >= score) return;
    canonicalByGroup.set(groupKey, { positions: canonicalPositions, score });
  });

  if (!canonicalByGroup.size) return normalizeCourtPayload(payload);

  return normalizeCourtPayload({
    ...payload,
    timeline: {
      steps: payload.timeline.steps.map((step) => {
        const groupKey = getDefenseBaseGroupKey(step);
        const canonicalPositions = groupKey
          ? canonicalByGroup.get(groupKey)?.positions
          : undefined;
        if (!canonicalPositions) return step;

        const actorIds = step.visibleActorIds ?? Object.keys(canonicalPositions);
        const actorPositions = { ...step.actorPositions };
        actorIds.forEach((actorId) => {
          const point = canonicalPositions[actorId];
          if (point) actorPositions[actorId] = point;
        });

        return {
          ...step,
          actorPositions,
          baselineActorPositions: {
            ...(step.baselineActorPositions ?? {}),
            ...Object.fromEntries(
              actorIds
                .filter((actorId) => canonicalPositions[actorId])
                .map((actorId) => [actorId, canonicalPositions[actorId]])
            ),
          },
          tacticalPositions: {
            ...(step.tacticalPositions ?? {}),
            ...Object.fromEntries(
              actorIds
                .filter((actorId) => canonicalPositions[actorId])
                .map((actorId) => [actorId, canonicalPositions[actorId]])
            ),
          },
          transitions: undefined,
          trajectories: undefined,
          visibleLayerIds: removeVisibleLayer(step.visibleLayerIds, "trajectories"),
        };
      }),
    },
  });
};

const getStepSavedBaselineActorPositions = (step: CourtVisualStep) => ({
  ...getDefaultReceiveBaselinePositions(step),
  ...getDefaultDefenseBaselinePositions(step),
  ...step.actorPositions,
  ...getManualMoveOriginPositions(step),
  ...(step.baselineActorPositions ?? {}),
});

export const getCourtVisualStepAlignmentPositions = (
  payload: CourtVisualPayload,
  step: CourtVisualStep
) => ({
  ...getActorInitialPositions(payload),
  ...step.actorPositions,
  ...(step.legalPositions ?? {}),
  ...getMovementOriginPositions(step),
  ...getDefaultReceiveBaselinePositions(step),
  ...getDefaultDefenseBaselinePositions(step),
  ...getManualMoveOriginPositions(step),
  ...(step.baselineActorPositions ?? {}),
});

export const ensureCourtVisualPayloadBaselines = (
  payload: CourtVisualPayload
): CourtVisualPayload =>
  normalizeCourtPayload({
    ...payload,
    timeline: {
      steps: payload.timeline.steps.map((step) => {
        if (step.baselineActorPositions) return step;
        const defaultBaseline =
          step.formationKind === "5x1_receive_3" && step.phase === "receive_legal"
            ? getDefaultReceiveBaselinePositions(step)
            : getDefaultDefenseBaselinePositions(step);
        const resetActorIds = step.visibleActorIds ?? Object.keys(defaultBaseline);
        const baselineActorPositions = resetActorIds.reduce<Record<string, CourtPoint>>(
          (positions, actorId) => {
            const point = defaultBaseline[actorId];
            if (point) positions[actorId] = point;
            return positions;
          },
          {}
        );
        if (!Object.keys(baselineActorPositions).length) {
          return step;
        }
        return {
          ...step,
          actorPositions: {
            ...step.actorPositions,
            ...baselineActorPositions,
          },
          tacticalPositions: step.tacticalPositions
            ? {
                ...step.tacticalPositions,
                ...baselineActorPositions,
              }
            : step.tacticalPositions,
          baselineActorPositions,
          transitions:
            step.formationKind === "defense_base_6_back" ? undefined : step.transitions,
          trajectories:
            step.formationKind === "defense_base_6_back" ? undefined : step.trajectories,
          visibleLayerIds:
            step.formationKind === "defense_base_6_back"
              ? removeVisibleLayer(step.visibleLayerIds, "trajectories")
              : step.visibleLayerIds,
        };
      }),
    },
  });

const isPairedMovementOrigin = (
  originStep: CourtVisualStep,
  targetStep: CourtVisualStep
) =>
  originStep.rotationIndex === targetStep.rotationIndex &&
  originStep.formationKind === targetStep.formationKind &&
  ((originStep.phase === "receive_legal" && targetStep.phase === "receive_release") ||
    (originStep.phase === "serve_base" && targetStep.phase === "serve_after_hit"));

const rebuildPairedMovementStep = (
  payload: CourtVisualPayload,
  originStep: CourtVisualStep,
  targetStep: CourtVisualStep
): CourtVisualStep => {
  const actorIds =
    targetStep.visibleActorIds ??
    originStep.visibleActorIds ??
    payload.actors.map((actor) => actor.id);
  const trajectories = actorIds
    .map<CourtVisualTrajectory | null>((actorId) => {
      const actor = payload.actors.find((item) => item.id === actorId);
      const from =
        originStep.actorPositions[actorId] ??
        originStep.legalPositions?.[actorId] ??
        actor?.initialPosition;
      const to =
        targetStep.actorPositions[actorId] ??
        targetStep.tacticalPositions?.[actorId] ??
        targetStep.legalPositions?.[actorId] ??
        actor?.initialPosition;
      if (!from || !to || getPointDistance(from, to) <= 0.015) return null;
      return {
        id: `${targetStep.id}-movement-${actorId}`,
        actorId,
        points: [normalizeExtendedCourtPoint(from), normalizeExtendedCourtPoint(to)],
        color: actor?.baseColor ?? actor?.color ?? getActorBaseColor(actorId),
      };
    })
    .filter((trajectory): trajectory is CourtVisualTrajectory => trajectory !== null);

  return {
    ...targetStep,
    transitions: trajectories.length ? trajectories : undefined,
    trajectories: trajectories.length ? trajectories : undefined,
    visibleLayerIds: trajectories.length
      ? addVisibleLayer(targetStep.visibleLayerIds, "trajectories")
      : targetStep.visibleLayerIds,
  };
};

export const syncCourtVisualPairedTrajectories = (
  payload: CourtVisualPayload,
  changedStepIndex?: number
): CourtVisualPayload => {
  const nextSteps = payload.timeline.steps.map((step, index, steps) => {
    const originIndex = steps.findIndex((candidate) =>
      isPairedMovementOrigin(candidate, step)
    );
    if (originIndex < 0) return step;
    if (
      typeof changedStepIndex === "number" &&
      changedStepIndex !== index &&
      changedStepIndex !== originIndex
    ) {
      return step;
    }
    return rebuildPairedMovementStep(payload, steps[originIndex], step);
  });

  return {
    ...payload,
    timeline: {
      steps: nextSteps,
    },
  };
};

const legendActorIdPrefixByLabel: Record<CourtVisualLegendActorLabel, string> = {
  Lv: "lev_extra",
  Op: "op_extra",
  P: "p_extra",
  C: "c_extra",
  Lb: "lib_extra",
};

const getVisibleActorIdsForStep = (
  step: CourtVisualStep,
  existingActorIds: string[]
) => {
  if (step.visibleActorIds) return step.visibleActorIds;
  const actorPositionIds = Object.keys(step.actorPositions);
  return actorPositionIds.length ? actorPositionIds : existingActorIds;
};

const omitActorFromRecord = <T,>(
  record: Record<string, T> | undefined,
  actorId: string
) => {
  if (!record || !(actorId in record)) return record;
  const next = { ...record };
  delete next[actorId];
  return Object.keys(next).length ? next : undefined;
};

const removeActorMovementItems = (
  items: CourtVisualTrajectory[] | undefined,
  actorId: string
) => {
  const next = items?.filter((item) => item.actorId !== actorId);
  return next?.length ? next : undefined;
};

const getNextExtraActorId = (
  payload: CourtVisualPayload,
  label: string,
  fallbackPrefix: string
) => {
  const prefix =
    label in legendActorIdPrefixByLabel
      ? legendActorIdPrefixByLabel[label as CourtVisualLegendActorLabel]
      : `${fallbackPrefix}_extra`;
  const existingIds = new Set(payload.actors.map((actor) => actor.id));
  let suffix = 1;
  while (existingIds.has(`${prefix}_${suffix}`)) suffix += 1;
  return `${prefix}_${suffix}`;
};

const getNextLegendActorPosition = (
  step: CourtVisualStep,
  existingActorIds: string[]
) => {
  const visibleActorIds = getVisibleActorIdsForStep(step, existingActorIds);
  const extraActorCount = visibleActorIds.filter((actorId) =>
    actorId.includes("_extra_")
  ).length;
  const offsets = [
    { x: 0, y: 0 },
    { x: -0.08, y: -0.06 },
    { x: 0.08, y: -0.06 },
    { x: -0.08, y: 0.06 },
    { x: 0.08, y: 0.06 },
    { x: 0, y: 0.1 },
  ];
  const offset = offsets[extraActorCount % offsets.length];
  return normalizeExtendedCourtPoint({
    x: 0.5 + offset.x,
    y: 0.5 + offset.y,
  });
};

export const addCourtVisualActorFromLegend = (
  payload: CourtVisualPayload,
  stepIndex: number,
  label: CourtVisualLegendActorLabel
): CourtVisualPayload => {
  const step = payload.timeline.steps[stepIndex];
  const template = tacticalActorTemplateByLegendLabel[label];
  if (!step || !template) return payload;

  const actorId = getNextExtraActorId(payload, label, label.toLowerCase());
  const existingActorIds = payload.actors.map((actor) => actor.id);
  const position = getNextLegendActorPosition(step, existingActorIds);
  const nextActor: CourtVisualActor = {
    id: actorId,
    ...template,
    initialPosition: position,
  };

  return normalizeCourtPayload({
    ...payload,
    actors: [...payload.actors, nextActor],
    timeline: {
      steps: payload.timeline.steps.map((item, index) => {
        const visibleActorIds = getVisibleActorIdsForStep(item, existingActorIds);
        if (index !== stepIndex) {
          return item.visibleActorIds ? item : { ...item, visibleActorIds };
        }
        return {
          ...item,
          actorPositions: {
            ...item.actorPositions,
            [actorId]: position,
          },
          baselineActorPositions: {
            ...(item.baselineActorPositions ?? {}),
            [actorId]: position,
          },
          tacticalPositions: item.tacticalPositions
            ? {
                ...item.tacticalPositions,
                [actorId]: position,
              }
            : item.tacticalPositions,
          visibleActorIds: visibleActorIds.includes(actorId)
            ? visibleActorIds
            : [...visibleActorIds, actorId],
        };
      }),
    },
  });
};

export const duplicateCourtVisualStepActor = (
  payload: CourtVisualPayload,
  stepIndex: number,
  actorId: string
): CourtVisualPayload => {
  const step = payload.timeline.steps[stepIndex];
  const actor = payload.actors.find((item) => item.id === actorId);
  if (!step || !actor) return payload;

  const existingActorIds = payload.actors.map((item) => item.id);
  const visibleActorIds = getVisibleActorIdsForStep(step, existingActorIds);
  if (!visibleActorIds.includes(actorId)) return payload;

  const sourcePosition = step.actorPositions[actorId] ?? actor.initialPosition;
  const position = normalizeExtendedCourtPoint({
    x: sourcePosition.x + 0.06,
    y: sourcePosition.y + 0.04,
  });
  const nextActorId = getNextExtraActorId(payload, actor.label, actor.id);
  const nextActor: CourtVisualActor = {
    ...actor,
    id: nextActorId,
    number: undefined,
    currentZone: undefined,
    rotationOrder: undefined,
    isBackRow: undefined,
    isFrontRow: undefined,
    initialPosition: position,
  };

  return normalizeCourtPayload({
    ...payload,
    actors: [...payload.actors, nextActor],
    timeline: {
      steps: payload.timeline.steps.map((item, index) => {
        const itemVisibleActorIds = getVisibleActorIdsForStep(item, existingActorIds);
        if (index !== stepIndex) {
          return item.visibleActorIds ? item : { ...item, visibleActorIds: itemVisibleActorIds };
        }
        return {
          ...item,
          actorPositions: {
            ...item.actorPositions,
            [nextActorId]: position,
          },
          baselineActorPositions: {
            ...(item.baselineActorPositions ?? {}),
            [nextActorId]: position,
          },
          tacticalPositions: item.tacticalPositions
            ? {
                ...item.tacticalPositions,
                [nextActorId]: position,
              }
            : item.tacticalPositions,
          visibleActorIds: itemVisibleActorIds.includes(nextActorId)
            ? itemVisibleActorIds
            : [...itemVisibleActorIds, nextActorId],
        };
      }),
    },
  });
};

const getReferencedActorIds = (steps: CourtVisualStep[]) => {
  const referenced = new Set<string>();
  steps.forEach((step) => {
    step.visibleActorIds?.forEach((actorId) => referenced.add(actorId));
    Object.keys(step.actorPositions).forEach((actorId) => referenced.add(actorId));
    Object.keys(step.baselineActorPositions ?? {}).forEach((actorId) =>
      referenced.add(actorId)
    );
    Object.keys(step.legalPositions ?? {}).forEach((actorId) => referenced.add(actorId));
    Object.keys(step.tacticalPositions ?? {}).forEach((actorId) =>
      referenced.add(actorId)
    );
    [...(step.transitions ?? []), ...(step.trajectories ?? [])].forEach(
      (trajectory) => {
        if (trajectory.actorId) referenced.add(trajectory.actorId);
      }
    );
  });
  return referenced;
};

export const deleteCourtVisualStepActor = (
  payload: CourtVisualPayload,
  stepIndex: number,
  actorId: string
): CourtVisualPayload => {
  const step = payload.timeline.steps[stepIndex];
  const actorExists = payload.actors.some((actor) => actor.id === actorId);
  if (!step || !actorExists) return payload;

  const existingActorIds = payload.actors.map((actor) => actor.id);
  const visibleActorIds = getVisibleActorIdsForStep(step, existingActorIds);
  if (!visibleActorIds.includes(actorId)) return payload;

  const nextSteps = payload.timeline.steps.map((item, index) => {
    if (index !== stepIndex) return item;
    return {
      ...item,
      actorPositions: omitActorFromRecord(item.actorPositions, actorId) ?? {},
      baselineActorPositions: omitActorFromRecord(
        item.baselineActorPositions,
        actorId
      ),
      tacticalPositions: omitActorFromRecord(item.tacticalPositions, actorId),
      visibleActorIds: visibleActorIds.filter((itemActorId) => itemActorId !== actorId),
      passers: item.passers?.filter((itemActorId) => itemActorId !== actorId),
      attackOptions: item.attackOptions?.filter((itemActorId) => itemActorId !== actorId),
      defensiveRoles: omitActorFromRecord(item.defensiveRoles, actorId),
      transitions: removeActorMovementItems(item.transitions, actorId),
      trajectories: removeActorMovementItems(item.trajectories, actorId),
    };
  });
  const referencedActorIds = getReferencedActorIds(nextSteps);

  return normalizeCourtPayload({
    ...payload,
    actors: payload.actors.filter(
      (actor) => actor.id !== actorId || referencedActorIds.has(actor.id)
    ),
    timeline: {
      steps: nextSteps,
    },
  });
};

export const updateCourtVisualStepActorPosition = (
  payload: CourtVisualPayload,
  stepIndex: number,
  actorId: string,
  point: CourtPoint
): CourtVisualPayload => {
  const normalizedPoint = normalizeExtendedCourtPoint(point);
  const actor = payload.actors.find((item) => item.id === actorId);

  const nextPayload = {
    ...payload,
    timeline: {
      steps: payload.timeline.steps.map((step, index) => {
        if (index !== stepIndex) return step;

        const trajectoryId = `${MANUAL_MOVE_TRAJECTORY_PREFIX}-${actorId}`;
        const existingTrajectories = step.trajectories ?? step.transitions ?? [];
        const existingManualTrajectory = existingTrajectories.find(
          (trajectory) => trajectory.id === trajectoryId
        );
        const origin =
          existingManualTrajectory?.points[0] ??
          step.baselineActorPositions?.[actorId] ??
          step.actorPositions[actorId] ??
          step.legalPositions?.[actorId] ??
          actor?.initialPosition ??
          normalizedPoint;
        const nonManualTrajectories = existingTrajectories.filter(
          (trajectory) => trajectory.id !== trajectoryId
        );
        const nextManualTrajectory: CourtVisualTrajectory | null =
          getPointDistance(origin, normalizedPoint) > 0.015
            ? {
                id: trajectoryId,
                actorId,
                points: [normalizeExtendedCourtPoint(origin), normalizedPoint],
                color: actor?.baseColor ?? actor?.color ?? MANUAL_MOVE_TRAJECTORY_FALLBACK_COLOR,
              }
            : null;
        const nextTrajectories = nextManualTrajectory
          ? [...nonManualTrajectories, nextManualTrajectory]
          : nonManualTrajectories;

        return {
          ...step,
          baselineActorPositions: step.baselineActorPositions ?? step.actorPositions,
          actorPositions: {
            ...step.actorPositions,
            [actorId]: normalizedPoint,
          },
          trajectories: nextTrajectories.length ? nextTrajectories : undefined,
          visibleLayerIds: nextManualTrajectory
            ? addVisibleLayer(step.visibleLayerIds, "trajectories")
            : step.visibleLayerIds,
        };
      }),
    },
  };

  return syncCourtVisualPairedTrajectories(nextPayload, stepIndex);
};

export const updateCourtVisualStepActorStaticPosition = (
  payload: CourtVisualPayload,
  stepIndex: number,
  actorId: string,
  point: CourtPoint
): CourtVisualPayload => {
  const normalizedPoint = normalizeExtendedCourtPoint(point);
  const nextPayload = {
    ...payload,
    timeline: {
      steps: payload.timeline.steps.map((step, index) => {
        if (index !== stepIndex) return step;

        return {
          ...step,
          baselineActorPositions: {
            ...(step.baselineActorPositions ?? step.actorPositions),
            [actorId]: normalizedPoint,
          },
          actorPositions: {
            ...step.actorPositions,
            [actorId]: normalizedPoint,
          },
          ...removeManualMoveTrajectories(step, [actorId]),
        };
      }),
    },
  };

  return syncCourtVisualPairedTrajectories(nextPayload, stepIndex);
};

export const resetCourtVisualStepAnimations = (
  payload: CourtVisualPayload,
  stepIndex: number
): CourtVisualPayload => ({
  ...payload,
  timeline: {
    steps: payload.timeline.steps.map((step, index) =>
      index === stepIndex
        ? {
            ...step,
            transitions: undefined,
            trajectories: undefined,
            visibleLayerIds: removeVisibleLayer(
              step.visibleLayerIds ??
                payload.layers
                  .filter((layer) => layer.visibleByDefault)
                  .map((layer) => layer.id),
              "trajectories"
            ),
          }
        : step
    ),
  },
});

export const alignCourtVisualStepPassers = (
  payload: CourtVisualPayload,
  stepIndex: number
): CourtVisualPayload => {
  const step = payload.timeline.steps[stepIndex];
  if (!step) return payload;

  const baselinePositions = getCourtVisualStepAlignmentPositions(payload, step);
  const resetActorIds = step.visibleActorIds ?? Object.keys(baselinePositions);
  const nextActorPositions = { ...step.actorPositions };
  resetActorIds.forEach((actorId) => {
    const point = baselinePositions[actorId];
    if (!point) return;
    nextActorPositions[actorId] = normalizeExtendedCourtPoint(point);
  });

  const nextPayload = {
    ...payload,
    timeline: {
      steps: payload.timeline.steps.map((item, index) =>
        index === stepIndex
          ? {
              ...item,
              actorPositions: nextActorPositions,
              baselineActorPositions: {
                ...(item.baselineActorPositions ?? baselinePositions),
                ...Object.fromEntries(
                  resetActorIds
                    .filter((actorId) => baselinePositions[actorId])
                    .map((actorId) => [
                      actorId,
                      normalizeExtendedCourtPoint(baselinePositions[actorId]),
                    ])
                ),
              },
              transitions: undefined,
              trajectories: undefined,
              visibleLayerIds: removeVisibleLayer(
                item.visibleLayerIds ??
                  payload.layers
                    .filter((layer) => layer.visibleByDefault)
                    .map((layer) => layer.id),
                "trajectories"
              ),
            }
          : item
      ),
    },
  };

  return syncCourtVisualPairedTrajectories(nextPayload, stepIndex);
};

export const getNextStepIndex = (
  payload: CourtVisualPayload,
  currentIndex: number
) => {
  const total = payload.timeline.steps.length;
  if (total <= 1) return 0;
  return (currentIndex + 1) % total;
};

export const getPreviousStepIndex = (
  payload: CourtVisualPayload,
  currentIndex: number
) => {
  const total = payload.timeline.steps.length;
  if (total <= 1) return 0;
  return (currentIndex - 1 + total) % total;
};
