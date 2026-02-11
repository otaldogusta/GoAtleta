import { supabaseRestDelete, supabaseRestGet, supabaseRestPatch, supabaseRestPost } from "./rest";

export type EventType = "torneio" | "amistoso" | "treino" | "reuniao" | "outro";
export type EventSport = "geral" | "volei_quadra" | "volei_praia" | "futebol";

export type EventRecord = {
  id: string;
  organizationId: string;
  title: string;
  description: string;
  eventType: EventType;
  sport: EventSport;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  unitId: string | null;
  locationLabel: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type EventListItem = EventRecord & {
  classIds: string[];
  hasMyClass: boolean;
};

type EventRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  event_type: EventType;
  sport: EventSport;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  unit_id: string | null;
  location_label: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type EventClassRow = {
  event_id: string;
  organization_id: string;
  class_id: string;
};

type ClassStaffRow = {
  class_id: string;
};

const toRecord = (row: EventRow): EventRecord => ({
  id: row.id,
  organizationId: row.organization_id,
  title: row.title,
  description: row.description,
  eventType: row.event_type,
  sport: row.sport,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  allDay: row.all_day,
  unitId: row.unit_id,
  locationLabel: row.location_label,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const joinInFilter = (values: string[]) => `(${values.join(",")})`;

const makeWindowFilter = (fromIso: string, toIso: string) =>
  `starts_at=gte.${encodeURIComponent(fromIso)}&starts_at=lte.${encodeURIComponent(toIso)}`;

const listEventClassLinks = async (
  organizationId: string,
  eventIds: string[]
): Promise<EventClassRow[]> => {
  if (!eventIds.length) return [];
  const path =
    "/event_classes?select=event_id,class_id,organization_id" +
    `&organization_id=eq.${encodeURIComponent(organizationId)}` +
    `&event_id=in.${encodeURIComponent(joinInFilter(eventIds))}`;
  return supabaseRestGet<EventClassRow[]>(path);
};

const listMyClassIds = async (
  organizationId: string,
  userId: string
): Promise<Set<string>> => {
  if (!userId) return new Set<string>();
  const path =
    "/class_staff?select=class_id" +
    `&organization_id=eq.${encodeURIComponent(organizationId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}`;
  const rows = await supabaseRestGet<ClassStaffRow[]>(path);
  return new Set(rows.map((row) => row.class_id));
};

const composeEventItems = async (
  rows: EventRow[],
  organizationId: string,
  userId?: string
): Promise<EventListItem[]> => {
  const records = rows.map(toRecord);
  if (!records.length) return [];

  const eventIds = records.map((event) => event.id);
  const [links, myClassIds] = await Promise.all([
    listEventClassLinks(organizationId, eventIds),
    userId ? listMyClassIds(organizationId, userId) : Promise.resolve(new Set<string>()),
  ]);

  const classesByEvent = new Map<string, string[]>();
  links.forEach((link) => {
    const current = classesByEvent.get(link.event_id) ?? [];
    current.push(link.class_id);
    classesByEvent.set(link.event_id, current);
  });

  return records.map((event) => {
    const classIds = classesByEvent.get(event.id) ?? [];
    const hasMyClass = classIds.some((classId) => myClassIds.has(classId));
    return {
      ...event,
      classIds,
      hasMyClass,
    };
  });
};

export async function listEvents(params: {
  organizationId: string;
  fromIso: string;
  toIso: string;
  userId?: string;
  sport?: EventSport;
  eventType?: EventType;
}) {
  const filters = [
    `organization_id=eq.${encodeURIComponent(params.organizationId)}`,
    makeWindowFilter(params.fromIso, params.toIso),
  ];

  if (params.sport) {
    filters.push(`sport=eq.${encodeURIComponent(params.sport)}`);
  }
  if (params.eventType) {
    filters.push(`event_type=eq.${encodeURIComponent(params.eventType)}`);
  }

  const path = `/events?select=*&order=starts_at.asc&${filters.join("&")}`;
  const rows = await supabaseRestGet<EventRow[]>(path);
  return composeEventItems(rows, params.organizationId, params.userId);
}

export async function listUpcomingEvents(params: {
  organizationId: string;
  userId?: string;
  days?: number;
}) {
  const now = new Date();
  const limitDays = Math.max(1, params.days ?? 7);
  const until = new Date(now);
  until.setDate(until.getDate() + limitDays);

  return listEvents({
    organizationId: params.organizationId,
    fromIso: now.toISOString(),
    toIso: until.toISOString(),
    userId: params.userId,
  });
}

export async function getEventById(params: {
  id: string;
  organizationId: string;
  userId?: string;
}) {
  const path =
    "/events?select=*" +
    `&id=eq.${encodeURIComponent(params.id)}` +
    `&organization_id=eq.${encodeURIComponent(params.organizationId)}` +
    "&limit=1";
  const rows = await supabaseRestGet<EventRow[]>(path);
  if (!rows[0]) return null;
  const items = await composeEventItems(rows.slice(0, 1), params.organizationId, params.userId);
  return items[0] ?? null;
}

export async function createEvent(input: {
  organizationId: string;
  title: string;
  description?: string;
  eventType: EventType;
  sport: EventSport;
  startsAt: string;
  endsAt: string;
  allDay?: boolean;
  unitId?: string | null;
  locationLabel?: string;
  createdBy: string;
}) {
  const rows = await supabaseRestPost<EventRow[]>(
    "/events",
    [
      {
        organization_id: input.organizationId,
        title: input.title,
        description: input.description ?? "",
        event_type: input.eventType,
        sport: input.sport,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        all_day: input.allDay ?? false,
        unit_id: input.unitId ?? null,
        location_label: input.locationLabel ?? "",
        created_by: input.createdBy,
      },
    ]
  );
  if (!rows[0]) {
    throw new Error("Falha ao criar evento.");
  }
  return toRecord(rows[0]);
}

export async function updateEvent(
  id: string,
  patch: {
    organizationId: string;
    title?: string;
    description?: string;
    eventType?: EventType;
    sport?: EventSport;
    startsAt?: string;
    endsAt?: string;
    allDay?: boolean;
    unitId?: string | null;
    locationLabel?: string;
  }
) {
  const body: Record<string, unknown> = {};
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.eventType !== undefined) body.event_type = patch.eventType;
  if (patch.sport !== undefined) body.sport = patch.sport;
  if (patch.startsAt !== undefined) body.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) body.ends_at = patch.endsAt;
  if (patch.allDay !== undefined) body.all_day = patch.allDay;
  if (patch.unitId !== undefined) body.unit_id = patch.unitId;
  if (patch.locationLabel !== undefined) body.location_label = patch.locationLabel;

  const path =
    "/events?id=eq." +
    encodeURIComponent(id) +
    "&organization_id=eq." +
    encodeURIComponent(patch.organizationId);

  const rows = await supabaseRestPatch<EventRow[]>(path, body);
  if (!rows[0]) {
    throw new Error("Evento não encontrado para atualização.");
  }
  return toRecord(rows[0]);
}

export async function deleteEvent(id: string, organizationId: string) {
  const path =
    "/events?id=eq." +
    encodeURIComponent(id) +
    "&organization_id=eq." +
    encodeURIComponent(organizationId);
  await supabaseRestDelete<null>(path);
}

export async function setEventClasses(
  eventId: string,
  organizationId: string,
  classIds: string[]
) {
  const deletePath =
    "/event_classes?event_id=eq." +
    encodeURIComponent(eventId) +
    "&organization_id=eq." +
    encodeURIComponent(organizationId);

  await supabaseRestDelete<null>(deletePath);

  const deduped = Array.from(new Set(classIds.filter(Boolean)));
  if (!deduped.length) return;

  await supabaseRestPost<unknown>(
    "/event_classes",
    deduped.map((classId) => ({
      event_id: eventId,
      organization_id: organizationId,
      class_id: classId,
    })),
    "return=minimal"
  );
}
