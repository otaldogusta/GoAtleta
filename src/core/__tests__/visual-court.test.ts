import {
  addCourtVisualActorFromLegend,
  BRAZILIAN_5X1_LINEUP_BY_SETTER_POSITION,
  DEFENSE_ATTACK_ORIGIN_ORDER,
  DEFENSE_KIND_ORDER,
  buildDefenseBase6BackPreset,
  build5x1RotationZones,
  build5x1ServingPreset,
  deleteCourtVisualStepActor,
  duplicateCourtVisualStepActor,
  buildDidacticRotationGridPreset,
  buildRotation5x1Preset,
  ensureCourtVisualPayloadBaselines,
  getNextOfficialRotationZone,
  alignCourtVisualStepPassers,
  getDidacticSlotCenter,
  getNextStepIndex,
  getOfficialZoneCenter,
  getPreviousStepIndex,
  getSetterPositionLabel,
  getStepAtIndex,
  isDidacticRotation5x1Preset,
  isOfficialRotation5x1Preset,
  SETTER_ROTATION_ZONES_5X1,
  getZoneBounds,
  isDefenseBase6BackPreset,
  normalizeCourtPoint,
  parseCourtVisualPayload,
  resetCourtVisualStepAnimations,
  resolveCourtZone,
  serializeCourtVisualPayload,
  updateCourtVisualStepActorPosition,
  updateCourtVisualStepActorStaticPosition,
} from "../visual-court";

const expectedBrazilian5x1Lineup = {
  P1: { 4: "op", 3: "c2", 2: "p1", 5: "p2", 6: "c1", 1: "lev" },
  P6: { 4: "p2", 3: "op", 2: "c2", 5: "c1", 6: "lev", 1: "p1" },
  P5: { 4: "c1", 3: "p2", 2: "op", 5: "lev", 6: "p1", 1: "c2" },
  P4: { 4: "lev", 3: "c1", 2: "p2", 5: "p1", 6: "c2", 1: "op" },
  P3: { 4: "p1", 3: "lev", 2: "c1", 5: "c2", 6: "op", 1: "p2" },
  P2: { 4: "c2", 3: "p1", 2: "lev", 5: "op", 6: "p2", 1: "c1" },
} as const;

const expectedServingBasePositions = {
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
    lib: { x: -0.16, y: 0.82 },
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
    lib: { x: -0.16, y: 0.82 },
  },
} as const;

const actorIdByZone = (positions: Record<string, { x: number; y: number }>) =>
  Object.fromEntries(
    Object.entries(positions).map(([actorId, position]) => [
      resolveCourtZone(position),
      actorId,
    ])
  );

const expectedReceive3BeforeServe = {
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
} as const;

describe("visual-court", () => {
  it("normalizes coordinates to the court unit range", () => {
    expect(normalizeCourtPoint({ x: -0.4, y: 1.8 })).toEqual({ x: 0, y: 1 });
    expect(normalizeCourtPoint({ x: 0.333333, y: 0.666666 })).toEqual({
      x: 0.3333,
      y: 0.6667,
    });
  });

  it("maps normalized points to official volleyball zones", () => {
    expect(resolveCourtZone({ x: 0.9, y: 0.8 })).toBe(1);
    expect(resolveCourtZone({ x: 0.5, y: 0.8 })).toBe(6);
    expect(resolveCourtZone({ x: 0.1, y: 0.8 })).toBe(5);
    expect(resolveCourtZone({ x: 0.9, y: 0.2 })).toBe(2);
    expect(resolveCourtZone({ x: 0.5, y: 0.2 })).toBe(3);
    expect(resolveCourtZone({ x: 0.1, y: 0.2 })).toBe(4);
  });

  it("returns zone bounds at normalized scale", () => {
    expect(getZoneBounds(4)).toEqual({ x: 0, y: 0, width: 1 / 3, height: 1 / 2 });
    expect(getZoneBounds(1)).toEqual({ x: 2 / 3, y: 1 / 2, width: 1 / 3, height: 1 / 2 });
  });

  it("separates didactic slots from official volleyball zones", () => {
    expect(getDidacticSlotCenter(1)).toEqual({ x: 0.1667, y: 0.25 });
    expect(getDidacticSlotCenter(6)).toEqual({ x: 0.8333, y: 0.75 });
    expect(getOfficialZoneCenter(4)).toEqual({ x: 0.1667, y: 0.25 });
    expect(getOfficialZoneCenter(1)).toEqual({ x: 0.8333, y: 0.75 });
  });

  it("builds the didactic grid preset separately from official zones", () => {
    const preset = buildDidacticRotationGridPreset();

    expect(preset.version).toBe(1);
    expect(preset.sport).toBe("volleyball_indoor");
    expect(preset.court.layoutMode).toBe("didactic_slots");
    expect(preset.court.labelMode).toBe("slots");
    expect(preset.actors).toHaveLength(6);
    expect(preset.actors.map((actor) => actor.initialPosition)).toEqual([
      getDidacticSlotCenter(1),
      getDidacticSlotCenter(2),
      getDidacticSlotCenter(3),
      getDidacticSlotCenter(4),
      getDidacticSlotCenter(5),
      getDidacticSlotCenter(6),
    ]);
    expect(preset.layers.map((layer) => layer.id)).toContain("trajectories");
    expect(preset.timeline.steps.map((step) => step.id)).toEqual([
      "initial",
      "serve",
      "reception-w",
      "setter-entry",
      "attack-cover",
      "next-rotation",
    ]);
    expect(
      preset.timeline.steps.flatMap((step) => step.highlights ?? []).every((highlight) => !highlight.zone && highlight.slot)
    ).toBe(true);
    expect(isDidacticRotation5x1Preset(preset)).toBe(true);
  });

  it("builds the official 5x1 preset with FIVB zone order and tactical roles", () => {
    const preset = buildRotation5x1Preset();

    expect(preset.court.layoutMode).toBe("official_volleyball_zones");
    expect(preset.court.labelMode).toBe("official_zones");
    expect(preset.court.courtView).toBe("team_half");
    expect(preset.court.renderStyle).toBe("coach_board");
    expect(preset.actors.map((actor) => actor.label)).toEqual([
      "Lv",
      "Op",
      "P",
      "P",
      "C",
      "C",
      "Lb",
    ]);
    expect(Object.fromEntries(preset.actors.map((actor) => [actor.id, actor.baseColor]))).toMatchObject({
      lev: "#3DDC84",
      op: "#22C55E",
      p1: "#60A5FA",
      p2: "#60A5FA",
      c1: "#8B5CF6",
      c2: "#8B5CF6",
      lib: "#A78BFA",
    });
    expect(preset.timeline.steps).toHaveLength(12);
    expect(isOfficialRotation5x1Preset(preset)).toBe(true);
  });

  it("maps internal rotation indexes to Brazilian setter-position labels", () => {
    expect(([1, 2, 3, 4, 5, 6] as const).map(getSetterPositionLabel)).toEqual([
      "P1",
      "P6",
      "P5",
      "P4",
      "P3",
      "P2",
    ]);
  });

  it("uses the fixed Brazilian 5x1 legal lineup matrix", () => {
    expect(BRAZILIAN_5X1_LINEUP_BY_SETTER_POSITION).toEqual(
      expectedBrazilian5x1Lineup
    );

    const setterZones = {
      P1: 1,
      P6: 6,
      P5: 5,
      P4: 4,
      P3: 3,
      P2: 2,
    } as const;

    Object.entries(setterZones).forEach(([setterPosition, setterZone]) => {
      const zones = build5x1RotationZones(setterZone);
      const expected = expectedBrazilian5x1Lineup[
        setterPosition as keyof typeof expectedBrazilian5x1Lineup
      ];
      expect(zones.LEV).toBe(setterZone);
      expect(zones.OP).toBe(
        Number(Object.entries(expected).find(([, actorId]) => actorId === "op")?.[0])
      );
      expect(zones.P1).toBe(
        Number(Object.entries(expected).find(([, actorId]) => actorId === "p1")?.[0])
      );
      expect(zones.P2).toBe(
        Number(Object.entries(expected).find(([, actorId]) => actorId === "p2")?.[0])
      );
      expect(zones.C1).toBe(
        Number(Object.entries(expected).find(([, actorId]) => actorId === "c1")?.[0])
      );
      expect(zones.C2).toBe(
        Number(Object.entries(expected).find(([, actorId]) => actorId === "c2")?.[0])
      );
    });
  });

  it("builds the serving preset separately from receive", () => {
    const preset = build5x1ServingPreset();

    expect(preset.court.courtView).toBe("team_half");
    expect(preset.court.renderStyle).toBe("coach_board");
    expect(preset.timeline.steps).toHaveLength(12);
    expect(new Set(preset.timeline.steps.map((step) => step.formationKind))).toEqual(
      new Set(["5x1_serving"])
    );
    expect(new Set(preset.timeline.steps.map((step) => step.phase))).toEqual(
      new Set(["serve_base", "serve_after_hit"])
    );
    expect(preset.markers.some((marker) => marker.id === "serve-ball")).toBe(false);
    preset.timeline.steps
      .filter((step) => step.phase === "serve_base")
      .forEach((step) => {
        expect(step.markerIds).toBeUndefined();
        expect(step.arrows).toBeUndefined();
      });
  });

  it("builds the defense base 6 back preset as a separate coach-adjusted system", () => {
    const preset = buildDefenseBase6BackPreset();
    const steps = preset.timeline.steps;

    expect(preset.court.courtView).toBe("team_half");
    expect(preset.court.renderStyle).toBe("coach_board");
    expect(steps).toHaveLength(72);
    expect(isDefenseBase6BackPreset(preset)).toBe(true);
    expect(new Set(steps.map((step) => step.formationKind))).toEqual(
      new Set(["defense_base_6_back"])
    );
    expect(new Set(steps.map((step) => step.phase))).toEqual(
      new Set(["defense_shape"])
    );
    expect(new Set(steps.map((step) => step.sourceOfTruth))).toEqual(
      new Set(["coach_adjusted"])
    );
    expect(new Set(steps.map((step) => step.initialLayout))).toEqual(
      new Set(["base_perimeter_6_back"])
    );
    expect(new Set(steps.map((step) => step.attackOrigin))).toEqual(
      new Set(DEFENSE_ATTACK_ORIGIN_ORDER)
    );
    expect(new Set(steps.map((step) => step.defenseKind))).toEqual(
      new Set(DEFENSE_KIND_ORDER)
    );
    expect(steps[0].attackOrigin).toBe("left");
    expect(steps[4].attackOrigin).toBe("middle");
    expect(steps[8].attackOrigin).toBe("right");

    SETTER_ROTATION_ZONES_5X1.forEach((_, index) => {
      const rotationSteps = steps.filter((step) => step.rotationIndex === index + 1);
      expect(rotationSteps).toHaveLength(
        DEFENSE_ATTACK_ORIGIN_ORDER.length * DEFENSE_KIND_ORDER.length
      );
      expect(rotationSteps[0].label).toBe(
        `${getSetterPositionLabel((index + 1) as 1 | 2 | 3 | 4 | 5 | 6)} - defesa`
      );
      rotationSteps.forEach((step) => {
        expect(step.visibleActorIds).toHaveLength(6);
        expect(step.trajectories).toBeUndefined();
        expect(step.transitions).toBeUndefined();
        expect(step.baselineActorPositions).toEqual(step.actorPositions);
        expect(step.defensiveRoles).toBeDefined();
        expect(Object.values(step.defensiveRoles ?? {})).toEqual(
          expect.arrayContaining(["parallel", "diagonal", "deep", "short_tip"])
        );
      });
    });

    const p1Base = steps.find(
      (step) =>
        step.rotationIndex === 1 &&
        step.attackOrigin === "middle" &&
        step.defenseKind === "parallel"
    );
    const p6Base = steps.find(
      (step) =>
        step.rotationIndex === 2 &&
        step.attackOrigin === "middle" &&
        step.defenseKind === "parallel"
    );
    expect(resolveCourtZone(p1Base!.actorPositions.lib)).toBe(5);
    expect(resolveCourtZone(p6Base!.actorPositions.lev)).toBe(1);
    expect(resolveCourtZone(p6Base!.actorPositions.p1)).toBe(6);
    expect(resolveCourtZone(p6Base!.actorPositions.op)).toBe(2);
    expect(resolveCourtZone(p6Base!.actorPositions.c2)).toBe(3);
  });

  it("uses the actor in Z1 as the server for every Brazilian setter position", () => {
    const preset = build5x1ServingPreset();
    const expectedServerByPosition = {
      P1: "lev",
      P6: "p1",
      P5: "c2",
      P4: "op",
      P3: "p2",
      P2: "c1",
    } as const;

    preset.timeline.steps
      .filter((step) => step.phase === "serve_base")
      .forEach((step) => {
        const setterPosition = getSetterPositionLabel(
          step.rotationIndex!
        ) as keyof typeof expectedServerByPosition;
        const expectedServer = expectedServerByPosition[setterPosition];
        expect(resolveCourtZone(step.actorPositions[expectedServer])).toBe(1);
        expect(actorIdByZone(step.legalPositions ?? {})[1]).toBe(expectedServer);
      });
  });

  it("uses the coach-adjusted serving bases and keeps libero off court on middle serves", () => {
    const preset = build5x1ServingPreset();
    const serveBaseSteps = preset.timeline.steps.filter(
      (step) => step.phase === "serve_base"
    );

    serveBaseSteps.forEach((step) => {
      const setterPosition = getSetterPositionLabel(
        step.rotationIndex!
      ) as keyof typeof expectedServingBasePositions;
      const expectedPositions = expectedServingBasePositions[setterPosition];
      const visibleActorIds = step.visibleActorIds ?? [];
      const isMiddleServer = setterPosition === "P5" || setterPosition === "P2";

      expect(step.actorPositions).toMatchObject(expectedPositions);
      expect(step.baselineActorPositions).toMatchObject(expectedPositions);
      expect(visibleActorIds.filter((actorId) => actorId !== "lib")).toHaveLength(6);
      expect(visibleActorIds.includes("lib")).toBe(isMiddleServer);
      expect(step.legalPositions?.lib).toBeUndefined();

      if (isMiddleServer) {
        expect(step.actorPositions.lib).toEqual({ x: -0.16, y: 0.82 });
      } else {
        expect(step.actorPositions.lib).toBeUndefined();
      }
    });
  });

  it("keeps receive frames to six visible athletes and shows six on-court athletes when serving", () => {
    const receivePreset = buildRotation5x1Preset();
    const servingPreset = build5x1ServingPreset();

    receivePreset.timeline.steps.forEach((step) => {
      expect(step.visibleActorIds).toHaveLength(6);
    });

    servingPreset.timeline.steps.forEach((step) => {
      const visibleActorIds = step.visibleActorIds ?? [];
      expect(visibleActorIds.filter((actorId) => actorId !== "lib")).toHaveLength(6);
      if (visibleActorIds.includes("lib")) {
        expect(step.actorPositions.lib.x).toBeLessThan(0);
      }
    });

    receivePreset.timeline.steps.forEach((step) => {
      expect(step.visibleActorIds).toContain("lib");
      const visible = new Set(step.visibleActorIds);
      const replacedMiddle = (["c1", "c2"] as const).find((actorId) =>
        [5, 6, 1].includes(resolveCourtZone(step.legalPositions?.[actorId] ?? { x: 0, y: 0 }))
      );
      expect(replacedMiddle).toBeDefined();
      expect(visible.has(replacedMiddle!)).toBe(false);
    });
  });

  it("follows the official clockwise rotation path", () => {
    expect(getNextOfficialRotationZone(2)).toBe(1);
    expect(getNextOfficialRotationZone(1)).toBe(6);
    expect(getNextOfficialRotationZone(6)).toBe(5);
    expect(getNextOfficialRotationZone(5)).toBe(4);
    expect(getNextOfficialRotationZone(4)).toBe(3);
    expect(getNextOfficialRotationZone(3)).toBe(2);
  });

  it("keeps 5x1 opposite pairs and moves LEV through six official rotations", () => {
    expect(SETTER_ROTATION_ZONES_5X1).toEqual([1, 6, 5, 4, 3, 2]);
    SETTER_ROTATION_ZONES_5X1.forEach((setterZone) => {
      const zones = build5x1RotationZones(setterZone);
      expect(zones.OP).toBe(getNextOfficialRotationZone(getNextOfficialRotationZone(getNextOfficialRotationZone(setterZone))));
      expect(zones.P2).toBe(getNextOfficialRotationZone(getNextOfficialRotationZone(getNextOfficialRotationZone(zones.P1))));
      expect(zones.C2).toBe(getNextOfficialRotationZone(getNextOfficialRotationZone(getNextOfficialRotationZone(zones.C1))));
    });
  });

  it("creates the required tactical situations for each official rotation", () => {
    const preset = buildRotation5x1Preset();
    const situationIds = ["receive_legal", "receive_release"];

    SETTER_ROTATION_ZONES_5X1.forEach((setterZone, index) => {
      const prefix = `r${index + 1}`;
      const steps = preset.timeline.steps.filter((step) => step.id.startsWith(`${prefix}_`));
      const setterPosition = getSetterPositionLabel(
        (index + 1) as 1 | 2 | 3 | 4 | 5 | 6
      ) as keyof typeof expectedBrazilian5x1Lineup;
      const legalByZone = actorIdByZone(steps[0].legalPositions ?? {});
      expect(steps.map((step) => step.id.replace(`${prefix}_`, ""))).toEqual(situationIds);
      expect(steps[0].label).toBe(`${setterPosition} - antes do saque`);
      expect(legalByZone).toEqual(expectedBrazilian5x1Lineup[setterPosition]);
      expect(resolveCourtZone(steps[0].legalPositions?.lev ?? { x: 0, y: 0 })).toBe(setterZone);
      if (setterPosition === "P1") {
        expect(resolveCourtZone(steps[0].legalPositions?.lev ?? { x: 0, y: 0 })).toBe(1);
        expect(resolveCourtZone(steps[0].legalPositions?.op ?? { x: 0, y: 0 })).toBe(4);
        expect(steps[0].visibleActorIds).toEqual(["lev", "op", "p1", "p2", "c2", "lib"]);
        expect(steps[0].markerIds).toBeUndefined();
        expect(steps[0].visibleLayerIds).not.toContain("markers");
        expect(steps[0].actorPositions.lev).not.toEqual(steps[0].legalPositions?.lev);
      }
      if (setterPosition === "P4") {
        expect(resolveCourtZone(steps[0].legalPositions?.lev ?? { x: 0, y: 0 })).toBe(4);
        expect(resolveCourtZone(steps[0].legalPositions?.op ?? { x: 0, y: 0 })).toBe(1);
      }
      const expectedReceive = expectedReceive3BeforeServe[setterPosition];
      expect(steps[0].passers).toEqual(expectedReceive.passers);
      expect(steps[0].passers?.length).toBe(3);
      expect(steps[0].passers).not.toContain("lev");
      expect(steps[0].passers).not.toContain("op");
      expect(steps[0].passers?.some((actorId) => actorId === "c1" || actorId === "c2")).toBe(false);
      expect(steps[0].visibleActorIds).toHaveLength(6);
      expect(steps[0].visibleActorIds).toContain("lib");
      const passerPositions = steps[0].passers!.map((actorId) => steps[0].actorPositions[actorId]);
      expect(Math.min(...passerPositions.map((point) => point.y))).toBeGreaterThanOrEqual(0.63);
      expect(
        Math.max(...passerPositions.map((point) => point.y)) -
          Math.min(...passerPositions.map((point) => point.y))
      ).toBeLessThanOrEqual(0.12);
      expect(
        Math.max(...passerPositions.map((point) => point.x)) -
          Math.min(...passerPositions.map((point) => point.x))
      ).toBeGreaterThanOrEqual(0.5);
      Object.entries(expectedReceive.positions).forEach(([actorId, point]) => {
        expect(steps[0].actorPositions[actorId]).toEqual(point);
      });
      expect(steps[0].markerIds).toBeUndefined();
      expect(steps[0].trajectories).toBeUndefined();
      expect(steps[0].transitions).toBeUndefined();
      expect(steps[0].arrows).toBeUndefined();
      expect(steps[0].highlights).toBeUndefined();
      expect(steps[0].visibleLayerIds).not.toContain("arrows");
      expect(steps[0].visibleLayerIds).not.toContain("markers");
      expect(steps[0].visibleLayerIds).not.toContain("trajectories");
      expect(steps[0].legalPositions?.lev).not.toEqual(steps[0].actorPositions.lev);
      expect(steps[1].legalPositions?.lev).not.toEqual(steps[1].tacticalPositions?.lev);
      expect(steps[1].transitions?.some((transition) => transition.actorId === "lev")).toBe(true);
      expect(steps[1].transitions?.length).toBeGreaterThanOrEqual(4);
      expect(steps[1].arrows?.length ?? 0).toBeLessThanOrEqual(1);
      expect(steps[1].setterTarget).toEqual({ x: 0.64, y: 0.18 });
      steps[1].visibleActorIds?.forEach((actorId) => {
        const from = steps[0].actorPositions[actorId];
        const to = steps[1].actorPositions[actorId];
        const distance = from && to ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
        if (from && to && distance > 0.015) {
          expect(
            steps[1].transitions?.some((transition) => transition.actorId === actorId)
          ).toBe(true);
        }
      });
    });
  });

  it("serializes and parses payloads without losing timeline data", () => {
    const preset = buildRotation5x1Preset();
    const parsed = parseCourtVisualPayload(serializeCourtVisualPayload(preset));

    expect(parsed.timeline.steps).toHaveLength(preset.timeline.steps.length);
    expect(parsed.timeline.steps[0].id).toBe("r1_receive_legal");
    expect(resolveCourtZone(parsed.timeline.steps[0].actorPositions.lev)).toBe(1);
  });

  it("updates a single actor position only in the selected timeline step", () => {
    const preset = buildRotation5x1Preset();
    const next = updateCourtVisualStepActorPosition(preset, 0, "p1", {
      x: 1.4,
      y: -0.2,
    });

    expect(next).not.toBe(preset);
    expect(next.timeline.steps[0].actorPositions.p1).toEqual({ x: 1.3, y: -0.2 });
    expect(next.timeline.steps[1].actorPositions.p1).toEqual(
      preset.timeline.steps[1].actorPositions.p1
    );
    expect(next.timeline.steps[0].actorPositions.p2).toEqual(
      preset.timeline.steps[0].actorPositions.p2
    );
    expect(next.timeline.steps[0].trajectories).toContainEqual({
      id: "manual-move-p1",
      actorId: "p1",
      points: [preset.timeline.steps[0].actorPositions.p1, { x: 1.3, y: -0.2 }],
      color: "#60A5FA",
    });
    expect(next.timeline.steps[0].visibleLayerIds).toContain("trajectories");
    expect(next.timeline.steps[1].actorPositions.p1).toEqual(
      preset.timeline.steps[1].actorPositions.p1
    );
    expect(
      next.timeline.steps[1].trajectories?.find((trajectory) => trajectory.actorId === "p1")
    ).toMatchObject({
      actorId: "p1",
      points: [{ x: 1.3, y: -0.2 }, preset.timeline.steps[1].actorPositions.p1],
    });
  });

  it("keeps the original manual tracking origin while dragging the same actor", () => {
    const preset = buildRotation5x1Preset();
    const firstMove = updateCourtVisualStepActorPosition(preset, 0, "p1", {
      x: 0.7,
      y: 0.62,
    });
    const secondMove = updateCourtVisualStepActorPosition(firstMove, 0, "p1", {
      x: 0.64,
      y: 0.58,
    });

    expect(secondMove.timeline.steps[0].trajectories).toContainEqual({
      id: "manual-move-p1",
      actorId: "p1",
      points: [preset.timeline.steps[0].actorPositions.p1, { x: 0.64, y: 0.58 }],
      color: "#60A5FA",
    });
  });

  it("uses the saved baseline as the animation origin", () => {
    const withBaseline = updateCourtVisualStepActorStaticPosition(
      buildRotation5x1Preset(),
      0,
      "p1",
      { x: 0.34, y: 0.82 }
    );
    const next = updateCourtVisualStepActorPosition(withBaseline, 0, "p1", {
      x: 0.7,
      y: 0.62,
    });

    expect(next.timeline.steps[0].trajectories).toContainEqual({
      id: "manual-move-p1",
      actorId: "p1",
      points: [{ x: 0.34, y: 0.82 }, { x: 0.7, y: 0.62 }],
      color: "#60A5FA",
    });
    expect(next.timeline.steps[0].baselineActorPositions?.p1).toEqual({
      x: 0.34,
      y: 0.82,
    });
  });

  it("updates a single actor position without adding manual tracking in static edit mode", () => {
    const preset = buildRotation5x1Preset();
    const moved = updateCourtVisualStepActorPosition(preset, 0, "p1", {
      x: 0.7,
      y: 0.62,
    });
    const next = updateCourtVisualStepActorStaticPosition(moved, 0, "p1", {
      x: 1.4,
      y: -0.2,
    });

    expect(next.timeline.steps[0].actorPositions.p1).toEqual({ x: 1.3, y: -0.2 });
    expect(next.timeline.steps[0].baselineActorPositions?.p1).toEqual({
      x: 1.3,
      y: -0.2,
    });
    expect(next.timeline.steps[0].trajectories?.some(
      (trajectory) => trajectory.id === "manual-move-p1"
    )).not.toBe(true);
    expect(next.timeline.steps[0].actorPositions.p2).toEqual(
      preset.timeline.steps[0].actorPositions.p2
    );
    expect(next.timeline.steps[1].actorPositions.p1).toEqual(
      preset.timeline.steps[1].actorPositions.p1
    );
    expect(
      next.timeline.steps[1].trajectories?.find((trajectory) => trajectory.actorId === "p1")
    ).toMatchObject({
      actorId: "p1",
      points: [{ x: 1.3, y: -0.2 }, preset.timeline.steps[1].actorPositions.p1],
    });
  });

  it("upgrades older generated receive baselines to the current default alignment", () => {
    const preset = buildRotation5x1Preset();
    const oldPayload = {
      ...preset,
      timeline: {
        steps: preset.timeline.steps.map((step, index) =>
          index === 0
            ? {
                ...step,
                baselineActorPositions: undefined,
                actorPositions: {
                  ...step.actorPositions,
                  p1: { x: 0.34, y: 0.82 },
                },
              }
            : step
        ),
      },
    };

    const next = ensureCourtVisualPayloadBaselines(oldPayload);

    expect(next.timeline.steps[0].baselineActorPositions?.p1).toEqual({
      x: 0.78,
      y: 0.7,
    });
    expect(next.timeline.steps[0].actorPositions.p1).toEqual({ x: 0.78, y: 0.7 });
  });

  it("preserves explicit saved actor baselines when loading payloads", () => {
    const preset = buildRotation5x1Preset();
    const savedPayload = {
      ...preset,
      timeline: {
        steps: preset.timeline.steps.map((step, index) =>
          index === 0
            ? {
                ...step,
                baselineActorPositions: {
                  ...step.baselineActorPositions,
                  p1: { x: 0.34, y: 0.82 },
                },
                actorPositions: {
                  ...step.actorPositions,
                  p1: { x: 0.34, y: 0.82 },
                },
              }
            : step
        ),
      },
    };

    const next = ensureCourtVisualPayloadBaselines(savedPayload);

    expect(next.timeline.steps[0].baselineActorPositions?.p1).toEqual({
      x: 0.34,
      y: 0.82,
    });
    expect(next.timeline.steps[0].actorPositions.p1).toEqual({ x: 0.34, y: 0.82 });
  });

  it("restores the saved receive baseline when aligning passers", () => {
    const customBaselineByActor = {
      p2: { x: -0.18, y: 0.66 },
      lib: { x: 0.12, y: 0.7 },
      p1: { x: 0.44, y: 0.68 },
      lev: { x: 0.82, y: 0.34 },
      op: { x: 1.08, y: 0.46 },
      c2: { x: 0.5, y: 0.16 },
    };
    const withSavedBaseline = Object.entries(customBaselineByActor).reduce(
      (current, [actorId, point]) =>
        updateCourtVisualStepActorStaticPosition(current, 0, actorId, point),
      buildRotation5x1Preset()
    );
    const moved = Object.keys(customBaselineByActor).reduce(
      (current, actorId, index) =>
        updateCourtVisualStepActorPosition(current, 0, actorId, {
          x: 0.1 + index * 0.18,
          y: index % 2 === 0 ? 0.24 : 0.52,
        }),
      withSavedBaseline
    );
    const next = alignCourtVisualStepPassers(moved, 0);
    const after = next.timeline.steps[0];

    expect(after.actorPositions.p2).toEqual(customBaselineByActor.p2);
    expect(after.actorPositions.lib).toEqual(customBaselineByActor.lib);
    expect(after.actorPositions.p1).toEqual(customBaselineByActor.p1);
    expect(after.actorPositions.lev).toEqual(customBaselineByActor.lev);
    expect(after.actorPositions.op).toEqual(customBaselineByActor.op);
    expect(after.actorPositions.c2).toEqual(customBaselineByActor.c2);
    expect(after.baselineActorPositions?.p1).toEqual(customBaselineByActor.p1);
    expect(after.visibleLayerIds).not.toContain("trajectories");
    expect(after.trajectories).toBeUndefined();
    expect(after.transitions).toBeUndefined();
    expect(next.timeline.steps[1].actorPositions).toEqual(
      moved.timeline.steps[1].actorPositions
    );
    expect(
      next.timeline.steps[1].trajectories?.find((trajectory) => trajectory.actorId === "p2")
    ).toMatchObject({
      actorId: "p2",
      points: [customBaselineByActor.p2, moved.timeline.steps[1].actorPositions.p2],
    });
  });

  it("resets animations for one frame without moving actors", () => {
    const preset = buildDefenseBase6BackPreset();
    const moved = updateCourtVisualStepActorPosition(preset, 0, "p1", {
      x: 0.42,
      y: 0.52,
    });

    expect(moved.timeline.steps[0].trajectories?.length).toBeGreaterThan(0);
    expect(moved.timeline.steps[0].visibleLayerIds).toContain("trajectories");

    const next = resetCourtVisualStepAnimations(moved, 0);

    expect(next.timeline.steps[0].actorPositions.p1).toEqual({ x: 0.42, y: 0.52 });
    expect(next.timeline.steps[0].trajectories).toBeUndefined();
    expect(next.timeline.steps[0].transitions).toBeUndefined();
    expect(next.timeline.steps[0].visibleLayerIds).not.toContain("trajectories");
    expect(next.timeline.steps[1]).toBe(moved.timeline.steps[1]);
  });

  it("adds an extra actor from the legend only to the current frame", () => {
    const preset = buildRotation5x1Preset();
    const next = addCourtVisualActorFromLegend(preset, 0, "P");
    const addedActor = next.actors.find((actor) => actor.id === "p_extra_1");

    expect(addedActor).toMatchObject({
      id: "p_extra_1",
      label: "P",
      role: "outside",
      baseColor: "#60A5FA",
    });
    expect(next.timeline.steps[0].visibleActorIds).toContain("p_extra_1");
    expect(next.timeline.steps[0].actorPositions.p_extra_1).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(next.timeline.steps[0].baselineActorPositions?.p_extra_1).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(next.timeline.steps[1].visibleActorIds).not.toContain("p_extra_1");
    expect(next.timeline.steps[1].actorPositions.p_extra_1).toBeUndefined();
  });

  it("duplicates the selected actor only in the current frame", () => {
    const preset = buildRotation5x1Preset();
    const next = duplicateCourtVisualStepActor(preset, 0, "p1");
    const duplicatedActor = next.actors.find((actor) => actor.id === "p_extra_1");

    expect(duplicatedActor).toMatchObject({
      id: "p_extra_1",
      label: "P",
      role: "outside",
      baseColor: "#60A5FA",
    });
    expect(next.timeline.steps[0].visibleActorIds).toContain("p_extra_1");
    expect(next.timeline.steps[0].actorPositions.p_extra_1).toEqual({
      x: 0.84,
      y: 0.74,
    });
    expect(next.timeline.steps[1].visibleActorIds).not.toContain("p_extra_1");
    expect(next.timeline.steps[1].actorPositions.p_extra_1).toBeUndefined();
  });

  it("deletes the selected actor from the current frame without removing other frames", () => {
    const preset = addCourtVisualActorFromLegend(buildRotation5x1Preset(), 0, "C");
    const next = deleteCourtVisualStepActor(preset, 0, "c_extra_1");

    expect(next.actors.some((actor) => actor.id === "c_extra_1")).toBe(false);
    expect(next.timeline.steps[0].visibleActorIds).not.toContain("c_extra_1");
    expect(next.timeline.steps[0].actorPositions.c_extra_1).toBeUndefined();
    expect(next.timeline.steps[1].visibleActorIds).not.toContain("c_extra_1");
    expect(next.timeline.steps[1].actorPositions).toEqual(
      preset.timeline.steps[1].actorPositions
    );
  });

  it("can hide an original actor from one frame while keeping it available elsewhere", () => {
    const preset = buildRotation5x1Preset();
    const next = deleteCourtVisualStepActor(preset, 0, "p1");

    expect(next.actors.some((actor) => actor.id === "p1")).toBe(true);
    expect(next.timeline.steps[0].visibleActorIds).not.toContain("p1");
    expect(next.timeline.steps[0].actorPositions.p1).toBeUndefined();
    expect(next.timeline.steps[1].visibleActorIds).toContain("p1");
    expect(next.timeline.steps[1].actorPositions.p1).toEqual(
      preset.timeline.steps[1].actorPositions.p1
    );
  });

  it("wraps timeline indexes", () => {
    const preset = buildRotation5x1Preset();

    expect(getStepAtIndex(preset, 999).id).toBe("r6_receive_release");
    expect(getNextStepIndex(preset, preset.timeline.steps.length - 1)).toBe(0);
    expect(getPreviousStepIndex(preset, 0)).toBe(preset.timeline.steps.length - 1);
  });
});
