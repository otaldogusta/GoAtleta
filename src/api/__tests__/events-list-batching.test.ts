import { getEventById, listEvents } from "../events";

let mockIdentity = { userId: "teacher-a", generation: 1 };
let mockOrganization: string | null = "org-active";
let mockGeneration = 1;
const mockGetToken = jest.fn(async () => "fixture-token");
jest.mock("../../auth/session", () => ({
  getSessionIdentity: () => ({ ...mockIdentity }),
  assertSessionIdentity: (identity: typeof mockIdentity) => {
    if (identity.userId !== mockIdentity.userId || identity.generation !== mockIdentity.generation) throw new Error("Session changed");
  },
  SessionIdentityChangedError: class extends Error {},
  getValidAccessToken: () => mockGetToken(),
  forceRefreshAccessToken: jest.fn(),
}));
jest.mock("../../db/client", () => ({
  getActiveOrganizationId: async () => mockOrganization,
  getReadCacheGeneration: () => mockGeneration,
}));
jest.mock("../config", () => ({ SUPABASE_URL: "https://fixture.test", SUPABASE_ANON_KEY: "fixture-anon" }));

const organizationId = "org-requested";
const params = { organizationId, userId: "teacher-a", fromIso: "2026-10-26T03:00:00Z", toIso: "2026-12-07T02:59:59Z" };
const event = (index: number) => ({
  id: `60000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  organization_id: organizationId, rule_set_id: null, title: `Evento ${index}`, description: "Body", event_type: "treino", sport: "volei_quadra",
  starts_at: `2026-11-${String(index % 28 + 1).padStart(2, "0")}T12:00:00Z`, ends_at: "2026-11-30T13:00:00Z", all_day: false,
  unit_id: null, location_label: "Quadra", created_by: "teacher-a", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z",
});
type FixtureEvent = ReturnType<typeof event>;
type Link = { event_id: string; class_id: string; organization_id: string };
type Handler = (url: URL) => unknown | Promise<unknown>;
let fetchMock: jest.SpyInstance;
let urls: URL[];

function installTransport(events: FixtureEvent[], links: Link[], options: { cap?: number; before?: Handler } = {}) {
  const cap = options.cap ?? 500;
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    urls.push(url);
    // Models the request-line limit behind the observed browser status-0 failure.
    if (url.href.length > 8000) throw new TypeError("Request URL too long");
    const override = await options.before?.(url);
    if (override !== undefined) return new Response(JSON.stringify(override), { status: 200 });
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 1000), cap);
    let rows: unknown[];
    if (url.pathname.endsWith("/events")) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${organizationId}`);
      const id = url.searchParams.get("id");
      rows = id ? events.filter(row => id === `eq.${row.id}`) : events;
    } else if (url.pathname.endsWith("/event_classes")) {
      expect(url.searchParams.get("organization_id")).toBe(`eq.${organizationId}`);
      expect(url.searchParams.get("order")).toBe("event_id.asc,class_id.asc");
      const ids = url.searchParams.get("event_id")!.slice(4, -1).split(",");
      rows = links.filter(link => ids.includes(link.event_id));
    } else if (url.pathname.endsWith("/class_staff")) rows = [{ class_id: "class-1204" }];
    else throw new Error(`Unexpected path ${url.pathname}`);
    return new Response(JSON.stringify(rows.slice(offset, offset + limit)), { status: 200 });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIdentity = { userId: "teacher-a", generation: 1 };
  mockOrganization = "org-active";
  mockGeneration = 1;
  mockGetToken.mockResolvedValue("fixture-token");
  urls = [];
  fetchMock = jest.spyOn(global, "fetch");
});
afterEach(() => jest.restoreAllMocks());

test("more than 300 UUIDs use short bounded URLs and preserve all event fields/order and paginated links", async () => {
  const events = Array.from({ length: 337 }, (_, index) => event(index));
  const links = events.map(row => ({ event_id: row.id, class_id: `class-for-${row.id}`, organization_id: organizationId }));
  links.push(...Array.from({ length: 1205 }, (_, index) => ({ event_id: events[0].id, class_id: `class-${String(index).padStart(4, "0")}`, organization_id: organizationId })));
  installTransport(events, links, { cap: 137 });
  const result = await listEvents({ ...params, sport: "volei_quadra", eventType: "treino" });
  expect(result.map(row => row.id)).toEqual(events.map(row => row.id));
  expect(result[0]).toEqual({
    id: events[0].id, organizationId, ruleSetId: null, title: events[0].title, description: "Body", eventType: "treino", sport: "volei_quadra",
    startsAt: events[0].starts_at, endsAt: events[0].ends_at, allDay: false, unitId: null, locationLabel: "Quadra", createdBy: "teacher-a", createdAt: events[0].created_at, updatedAt: events[0].updated_at,
    classIds: links.filter(link => link.event_id === events[0].id).map(link => link.class_id), hasMyClass: true,
  });
  expect(result[1].hasMyClass).toBe(false);
  const linkUrls = urls.filter(url => url.pathname.endsWith("/event_classes"));
  expect(Math.max(...linkUrls.map(url => url.href.length))).toBeLessThan(2400);
  expect(linkUrls.every(url => url.searchParams.get("event_id")!.slice(4, -1).split(",").length <= 50)).toBe(true);
  const eventUrls = urls.filter(url => url.pathname.endsWith("/events"));
  expect(eventUrls.map(url => url.searchParams.get("offset"))).toEqual(["0", "137", "274", "337"]);
  expect(eventUrls.every(url => url.searchParams.get("sport") === "eq.volei_quadra" && url.searchParams.get("event_type") === "eq.treino" && url.searchParams.get("order") === "starts_at.asc,id.asc")).toBe(true);
});

test("event lists beyond the REST cap remain complete", async () => {
  const events = Array.from({ length: 1205 }, (_, index) => event(index));
  installTransport(events, []);
  const result = await listEvents(params);
  expect(result.map(row => row.id)).toEqual(events.map(row => row.id));
  expect(urls.filter(url => url.pathname.endsWith("/events")).map(url => url.searchParams.get("offset"))).toEqual(["0", "500", "1000", "1205"]);
});

test("a later link batch failure rejects the whole result and starts no following batch", async () => {
  const events = Array.from({ length: 151 }, (_, index) => event(index));
  const links = events.slice(0, 50).map(row => ({ event_id: row.id, class_id: "class-a", organization_id: organizationId }));
  let batches = 0;
  installTransport(events, links, { before: url => {
    if (url.pathname.endsWith("/event_classes")) {
      batches += 1;
      if (url.searchParams.get("event_id")!.includes(events[50].id)) throw new Error("link request failed");
    }
  } });
  await expect(listEvents(params)).rejects.toThrow("link request failed");
  expect(batches).toBe(3);
});

test("a context switch during token acquisition stops before the transport", async () => {
  let release!: (token: string) => void;
  let started!: () => void;
  const pending = new Promise<string>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  mockGetToken.mockImplementationOnce(() => { started(); return pending; });
  installTransport([event(0)], []);
  const reading = listEvents(params);
  const rejected = expect(reading).rejects.toThrow();
  await entered;
  mockIdentity.generation += 1;
  release("fixture-token");
  await rejected;
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(["identity", "session", "organization", "generation", "round trip"])("a stale %s between batches rejects without requesting another batch", async kind => {
  const events = Array.from({ length: 151 }, (_, index) => event(index));
  let linkReads = 0;
  installTransport(events, [], { before: url => {
    if (!url.pathname.endsWith("/event_classes")) return;
    linkReads += 1;
    if (kind === "identity") mockIdentity.userId = "teacher-b";
    if (kind === "session") mockIdentity.generation += 1;
    if (kind === "organization") mockOrganization = "org-b";
    if (kind === "generation") mockGeneration += 1;
    if (kind === "round trip") { mockOrganization = "org-active"; mockGeneration += 2; }
  } });
  await expect(listEvents(params)).rejects.toThrow();
  expect(linkReads).toBe(1);
});

test("duplicate pages fail instead of returning partial or repeated events", async () => {
  const rows = [event(0)];
  installTransport(rows, [], { before: url => url.pathname.endsWith("/events") ? rows : undefined });
  await expect(listEvents(params)).rejects.toThrow("Página de eventos repetida");
  expect(urls).toHaveLength(2);
});

test("empty authorized lists do not request links or staff, while REST errors remain failures", async () => {
  installTransport([], []);
  expect(await listEvents(params)).toEqual([]);
  expect(urls).toHaveLength(1);
  fetchMock.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
  await expect(listEvents(params)).rejects.toThrow("forbidden");
});

test("detail reads reuse the bounded link pagination without changing the full event result", async () => {
  const row = event(0);
  const links = Array.from({ length: 1205 }, (_, index) => ({ event_id: row.id, class_id: `class-${String(index).padStart(4, "0")}`, organization_id: organizationId }));
  installTransport([row], links);
  const result = await getEventById({ id: row.id, organizationId, userId: "teacher-a" });
  expect(result?.id).toBe(row.id);
  expect(result?.classIds).toEqual(links.map(link => link.class_id));
  expect(result?.hasMyClass).toBe(true);
});


test("calendar overlap includes events starting before the visible month without relaxing organization scope", async () => {
 installTransport([event(0)], []);
 await listEvents({ ...params, overlap: true });
 const request = urls.find(url => url.pathname.endsWith("/events"))!;
 expect(request.searchParams.get("ends_at")).toBe(`gt.${params.fromIso}`);
 expect(request.searchParams.getAll("starts_at")).toEqual([`lte.${params.toIso}`]);
 expect(request.searchParams.get("organization_id")).toBe(`eq.${organizationId}`);
});
