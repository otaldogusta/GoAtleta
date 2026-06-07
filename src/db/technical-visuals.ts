import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  build5x1ServingPreset,
  buildDefenseBase6BackPreset,
  buildDidacticRotationGridPreset,
  buildRotation5x1Preset,
  parseCourtVisualPayload,
  serializeCourtVisualPayload,
  type CourtVisualDocument,
  type CourtVisualPayload,
  type CourtVisualSourceKind,
} from "../core/visual-court";
import {
  getActiveOrganizationId,
  isAuthError,
  isMissingRelation,
  isNetworkError,
  supabaseGet,
  supabasePatch,
  supabasePost,
} from "./client";
import type { TechnicalVisualRow } from "./row-types";

type SaveTechnicalVisualInput = {
  id?: string;
  organizationId?: string | null;
  classId: string;
  sourceKind: CourtVisualSourceKind;
  sourceId?: string | null;
  title: string;
  payload: CourtVisualPayload;
};

const DEFAULT_RECEIVE_TITLE = "5x1 - Recepção";
const DEFAULT_SERVING_TITLE = "5x1 base - equipe sacando";
const DEFAULT_DEFENSE_TITLE = "Defesa base — 6 fundo";
const DEFAULT_DIDACTIC_TITLE = "Grade didática";
const LOCAL_TECHNICAL_VISUALS_KEY_PREFIX = "goatleta:technical_visuals:v1";

const allowedSourceKinds: CourtVisualSourceKind[] = [
  "rotation",
  "lesson",
  "scouting",
  "free",
];

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "").trim();

const normalizeSourceKind = (
  value: string | null | undefined
): CourtVisualSourceKind => {
  const normalized = normalizeText(value) as CourtVisualSourceKind;
  return allowedSourceKinds.includes(normalized) ? normalized : "free";
};

export const buildTechnicalVisualId = (params: {
  organizationId: string;
  classId: string;
  sourceKind: CourtVisualSourceKind;
  title: string;
}) =>
  `tv_${hashString(
    [params.organizationId, params.classId, params.sourceKind, params.title].join("|")
  )}`;

const buildLocalTechnicalVisualId = (params: {
  organizationId?: string | null;
  classId: string;
  sourceKind: CourtVisualSourceKind;
  title: string;
}) =>
  `local_${hashString(
    [params.organizationId || "local", params.classId, params.sourceKind, params.title].join("|")
  )}`;

const localTechnicalVisualsKey = (
  classId: string,
  organizationId?: string | null
) =>
  `${LOCAL_TECHNICAL_VISUALS_KEY_PREFIX}:${organizationId || "local"}:${classId}`;

const getDefaultTitleForSourceId = (sourceId: string | null | undefined) => {
  switch (sourceId) {
    case "5x1_receive_3":
      return DEFAULT_RECEIVE_TITLE;
    case "5x1_serving":
      return DEFAULT_SERVING_TITLE;
    case "defense_base_6_back":
      return DEFAULT_DEFENSE_TITLE;
    case "didactic_grid":
      return DEFAULT_DIDACTIC_TITLE;
    default:
      return null;
  }
};

const normalizeVisualTitle = (
  title: string | null | undefined,
  sourceId: string | null | undefined
) => {
  const normalized = getDefaultTitleForSourceId(sourceId) ?? normalizeText(title);
  return normalized || "Quadra visual";
};

export const technicalVisualRowToModel = (
  row: TechnicalVisualRow
): CourtVisualDocument => ({
  id: row.id,
  organizationId: row.organization_id ?? "",
  classId: row.class_id,
  sourceKind: normalizeSourceKind(row.source_kind),
  sourceId: row.source_id ?? null,
  title: normalizeVisualTitle(row.title, row.source_id ?? null),
  payload: parseCourtVisualPayload(row.payload_json),
  createdAt: row.created_at,
  updatedAt: row.updated_at ?? row.created_at,
});

const visualIdentityKey = (document: Pick<CourtVisualDocument, "sourceKind" | "sourceId" | "title">) =>
  `${document.sourceKind}:${document.sourceId ?? ""}:${normalizeText(document.title)}`;

const visualSourceKey = (
  document: Pick<CourtVisualDocument, "sourceKind" | "sourceId">
) => `${document.sourceKind}:${document.sourceId ?? ""}`;

const sortTechnicalVisuals = (documents: CourtVisualDocument[]) =>
  [...documents].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );

const mergeTechnicalVisuals = (
  remoteDocuments: CourtVisualDocument[],
  localDocuments: CourtVisualDocument[]
) => {
  const merged = new Map<string, CourtVisualDocument>();
  const put = (document: CourtVisualDocument) => {
    const keys = [document.id, visualIdentityKey(document), visualSourceKey(document)];
    const existingKey = keys.find((key) => merged.has(key));
    if (!existingKey) {
      keys.forEach((key) => merged.set(key, document));
      return;
    }
    const existing = merged.get(existingKey);
    const next =
      existing && new Date(existing.updatedAt).getTime() > new Date(document.updatedAt).getTime()
        ? existing
        : document;
    keys.forEach((key) => merged.set(key, next));
    if (existing) {
      merged.set(existing.id, next);
      merged.set(visualIdentityKey(existing), next);
      merged.set(visualSourceKey(existing), next);
    }
  };

  remoteDocuments.forEach(put);
  localDocuments.forEach(put);
  return sortTechnicalVisuals(
    Array.from(new Set(merged.values()))
  );
};

const appendMissingTechnicalVisuals = (
  documents: CourtVisualDocument[],
  fallbacks: CourtVisualDocument[]
) => {
  const existingKeys = new Set(
    documents.flatMap((document) => [
      visualIdentityKey(document),
      visualSourceKey(document),
    ])
  );
  return sortTechnicalVisuals([
    ...documents,
    ...fallbacks.filter(
      (item) =>
        !existingKeys.has(visualIdentityKey(item)) &&
        !existingKeys.has(visualSourceKey(item))
    ),
  ]);
};

const readLocalTechnicalVisuals = async (
  classId: string,
  organizationId?: string | null
): Promise<CourtVisualDocument[]> => {
  try {
    const raw = await AsyncStorage.getItem(localTechnicalVisualsKey(classId, organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CourtVisualDocument[];
    if (!Array.isArray(parsed)) return [];
    return sortTechnicalVisuals(
      parsed
        .filter((item) => item && item.classId === classId)
        .map((item) => ({
          ...item,
          organizationId: item.organizationId ?? organizationId ?? "",
          sourceKind: normalizeSourceKind(item.sourceKind),
          sourceId: item.sourceId ?? null,
          title: normalizeVisualTitle(item.title, item.sourceId ?? null),
          payload: parseCourtVisualPayload(item.payload),
          createdAt: item.createdAt,
          updatedAt: item.updatedAt ?? item.createdAt,
        }))
    );
  } catch {
    return [];
  }
};

const writeLocalTechnicalVisuals = async (
  classId: string,
  organizationId: string | null | undefined,
  documents: CourtVisualDocument[]
) => {
  await AsyncStorage.setItem(
    localTechnicalVisualsKey(classId, organizationId),
    JSON.stringify(sortTechnicalVisuals(documents))
  );
};

const saveLocalTechnicalVisual = async (
  input: SaveTechnicalVisualInput,
  organizationId?: string | null
): Promise<CourtVisualDocument> => {
  const sourceKind = normalizeSourceKind(input.sourceKind);
  const title = normalizeText(input.title) || "Quadra visual";
  const current = await readLocalTechnicalVisuals(input.classId, organizationId);
  const existing = current.find(
    (item) =>
      (input.id && item.id === input.id) ||
      visualIdentityKey(item) ===
        visualIdentityKey({
          sourceKind,
          sourceId: normalizeText(input.sourceId) || null,
          title,
        })
  );
  const now = new Date().toISOString();
  const document: CourtVisualDocument = {
    id:
      normalizeText(input.id) ||
      existing?.id ||
      buildLocalTechnicalVisualId({
        organizationId,
        classId: input.classId,
        sourceKind,
        title,
      }),
    organizationId: organizationId ?? "",
    classId: input.classId,
    sourceKind,
    sourceId: normalizeText(input.sourceId) || null,
    title,
    payload: parseCourtVisualPayload(JSON.parse(serializeCourtVisualPayload(input.payload))),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [
    document,
    ...current.filter(
      (item) =>
        item.id !== document.id &&
        visualIdentityKey(item) !== visualIdentityKey(document)
    ),
  ];
  await writeLocalTechnicalVisuals(input.classId, organizationId, next);
  return document;
};

const buildPayload = (input: SaveTechnicalVisualInput, organizationId: string) => {
  const title = normalizeText(input.title) || "Quadra visual";
  const sourceKind = normalizeSourceKind(input.sourceKind);
  const id =
    normalizeText(input.id) ||
    buildTechnicalVisualId({
      organizationId,
      classId: input.classId,
      sourceKind,
      title,
    });
  const now = new Date().toISOString();
  return {
    id,
    organization_id: organizationId,
    class_id: input.classId,
    source_kind: sourceKind,
    source_id: normalizeText(input.sourceId) || null,
    title,
    payload_json: JSON.parse(serializeCourtVisualPayload(input.payload)),
    created_at: now,
    updated_at: now,
  };
};

export async function listTechnicalVisualsByClass(
  classId: string,
  options: { organizationId?: string | null; limit?: number } = {}
): Promise<CourtVisualDocument[]> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    if (!organizationId) return readLocalTechnicalVisuals(classId, null);
    const limit = typeof options.limit === "number" && options.limit > 0 ? options.limit : 20;
    const rows = await supabaseGet<TechnicalVisualRow[]>(
      `/technical_visuals?select=*&class_id=eq.${encodeURIComponent(classId)}` +
        `&organization_id=eq.${encodeURIComponent(organizationId)}` +
        `&order=updated_at.desc&limit=${Math.floor(limit)}`
    );
    const remoteDocuments = rows.map(technicalVisualRowToModel);
    const localDocuments = await readLocalTechnicalVisuals(classId, organizationId);
    return mergeTechnicalVisuals(remoteDocuments, localDocuments).slice(0, limit);
  } catch (error) {
    if (
      isMissingRelation(error, "technical_visuals") ||
      isAuthError(error) ||
      isNetworkError(error)
    ) {
      return readLocalTechnicalVisuals(classId, options.organizationId);
    }
    throw error;
  }
}

export async function getTechnicalVisualById(
  visualId: string,
  options: { organizationId?: string | null } = {}
): Promise<CourtVisualDocument | null> {
  try {
    const organizationId = options.organizationId ?? (await getActiveOrganizationId());
    if (!organizationId) return null;
    const rows = await supabaseGet<TechnicalVisualRow[]>(
      `/technical_visuals?select=*&id=eq.${encodeURIComponent(visualId)}` +
        `&organization_id=eq.${encodeURIComponent(organizationId)}` +
        "&limit=1"
    );
    return rows[0] ? technicalVisualRowToModel(rows[0]) : null;
  } catch (error) {
    if (isMissingRelation(error, "technical_visuals")) return null;
    if (isAuthError(error) || isNetworkError(error)) return null;
    throw error;
  }
}

export async function saveTechnicalVisual(
  input: SaveTechnicalVisualInput
): Promise<CourtVisualDocument | null> {
  const organizationId = input.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) {
    return saveLocalTechnicalVisual(input, null);
  }
  const payload = buildPayload(input, organizationId);
  try {
    const existing = input.id
      ? await getTechnicalVisualById(input.id, { organizationId })
      : null;
    if (existing) {
      await supabasePatch(
        `/technical_visuals?id=eq.${encodeURIComponent(input.id ?? payload.id)}` +
          `&organization_id=eq.${encodeURIComponent(organizationId)}`,
        {
          source_kind: payload.source_kind,
          source_id: payload.source_id,
          title: payload.title,
          payload_json: payload.payload_json,
          updated_at: payload.updated_at,
        }
      );
      return {
        ...existing,
        sourceKind: payload.source_kind,
        sourceId: payload.source_id,
        title: payload.title,
        payload: input.payload,
        updatedAt: payload.updated_at,
      };
    }
    await supabasePost("/technical_visuals?on_conflict=id", [payload], {
      Prefer: "resolution=merge-duplicates",
    });
    return technicalVisualRowToModel(payload);
  } catch (error) {
    if (
      isMissingRelation(error, "technical_visuals") ||
      isAuthError(error) ||
      isNetworkError(error)
    ) {
      return saveLocalTechnicalVisual(input, organizationId);
    }
    throw error;
  }
}

export async function ensureDefaultRotationVisual(params: {
  classId: string;
  organizationId?: string | null;
}) {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  const existing = await listTechnicalVisualsByClass(params.classId, {
    organizationId,
    limit: 10,
  });
  const rotation = existing.find((item) => item.sourceKind === "rotation");
  if (!organizationId) return null;
  if (rotation) {
    return rotation;
  }
  return saveTechnicalVisual({
    classId: params.classId,
    organizationId,
    sourceKind: "rotation",
    title: DEFAULT_RECEIVE_TITLE,
    payload: buildRotation5x1Preset(),
  });
}

export async function ensureDefaultVisualPresets(params: {
  classId: string;
  organizationId?: string | null;
}) {
  const organizationId = params.organizationId ?? (await getActiveOrganizationId());
  const existing = await listTechnicalVisualsByClass(params.classId, {
    organizationId,
    limit: 20,
  });
  const localFallbacks: CourtVisualDocument[] = [
    {
      id: "local_5x1_receive_3",
      organizationId: organizationId ?? "",
      classId: params.classId,
      sourceKind: "rotation",
      sourceId: "5x1_receive_3",
      title: DEFAULT_RECEIVE_TITLE,
      payload: buildRotation5x1Preset(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "local_5x1_serving",
      organizationId: organizationId ?? "",
      classId: params.classId,
      sourceKind: "rotation",
      sourceId: "5x1_serving",
      title: DEFAULT_SERVING_TITLE,
      payload: build5x1ServingPreset(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "local_defense_base_6_back",
      organizationId: organizationId ?? "",
      classId: params.classId,
      sourceKind: "rotation",
      sourceId: "defense_base_6_back",
      title: DEFAULT_DEFENSE_TITLE,
      payload: buildDefenseBase6BackPreset(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "local_didactic_grid",
      organizationId: organizationId ?? "",
      classId: params.classId,
      sourceKind: "free",
      sourceId: "didactic_grid",
      title: DEFAULT_DIDACTIC_TITLE,
      payload: buildDidacticRotationGridPreset(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  if (!organizationId) {
    return existing.length
      ? appendMissingTechnicalVisuals(existing, localFallbacks)
      : localFallbacks;
  }

  const ensureOne = async (
    title: string,
    sourceKind: CourtVisualSourceKind,
    sourceId: string,
    payload: CourtVisualPayload
  ) => {
    const existingPreset = existing.find(
      (item) => item.title === title || item.sourceId === sourceId
    );
    if (existingPreset) return existingPreset;
    return saveTechnicalVisual({
      classId: params.classId,
      organizationId,
      sourceKind,
      sourceId,
      title,
      payload,
    });
  };

  const ensured = await Promise.all([
    ensureOne(
      DEFAULT_RECEIVE_TITLE,
      "rotation",
      "5x1_receive_3",
      buildRotation5x1Preset()
    ),
    ensureOne(
      DEFAULT_SERVING_TITLE,
      "rotation",
      "5x1_serving",
      build5x1ServingPreset()
    ),
    ensureOne(
      DEFAULT_DEFENSE_TITLE,
      "rotation",
      "defense_base_6_back",
      buildDefenseBase6BackPreset()
    ),
    ensureOne(
      DEFAULT_DIDACTIC_TITLE,
      "free",
      "didactic_grid",
      buildDidacticRotationGridPreset()
    ),
  ]);

  const ensuredDocuments = ensured.filter(
    (item): item is CourtVisualDocument => Boolean(item)
  );
  return ensuredDocuments.length ? ensuredDocuments : localFallbacks;
}
