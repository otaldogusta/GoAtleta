const mockSupabaseGet = jest.fn();
const mockReadCache = jest.fn();
const mockIsNetworkError = jest.fn();
const mockIsAuthError = jest.fn();
let mockIdentity = {userId:"teacher-a",generation:1};
let mockGeneration=1;
let mockOrganizationId:string|null="org-1";

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock("../client", () => ({
  CACHE_KEYS: {
    attendanceRecords: "attendance",
    students: "students",
  },
  getActiveOrganizationId: jest.fn(() => Promise.resolve(mockOrganizationId)),
  getReadCacheGeneration:()=>mockGeneration,
  getScopedOrganizationId: jest.fn((value: string | null | undefined) =>
    Promise.resolve(value ?? mockOrganizationId),
  ),
  isAuthError: (...args: unknown[]) => mockIsAuthError(...args),
  isMissingColumnInSchemaCache: jest.fn(() => false),
  isMissingRelation: jest.fn(() => false),
  isNetworkError: (...args: unknown[]) => mockIsNetworkError(...args),
  readCache: (...args: unknown[]) => mockReadCache(...args),
  supabaseDelete: jest.fn(),
  supabaseGet: (...args: unknown[]) => mockSupabaseGet(...args),
  supabasePatch: jest.fn(),
  supabasePost: jest.fn(),
  writeCache: jest.fn(),
}));

jest.mock("../classes", () => ({
  getClassById: jest.fn(),
  getClasses: jest.fn(),
}));

jest.mock("../../api/class-responsibles", () => ({
  listClassHeadsByClassIds: jest.fn(),
}));

jest.mock("../../api/notifications", () => ({
  createNotification: jest.fn(),
}));

jest.mock("../../auth/session", () => ({
  getSessionUserId: jest.fn(),
  getSessionIdentity:()=>({...mockIdentity}),
  assertSessionIdentity:(value:typeof mockIdentity)=>{if(value.userId!==mockIdentity.userId||value.generation!==mockIdentity.generation)throw new Error("Session changed");},
  SessionIdentityChangedError:class extends Error{},
}));

jest.mock("../pending-write-queue", () => ({
  enqueueWrite: jest.fn(),
}));

jest.mock("../training-sessions", () => ({
  resolveTrainingPlanForDate: jest.fn(),
  syncTrainingSessionFromAttendance: jest.fn(),
}));

jest.mock("../training", () => ({
  getTrainingPlans: jest.fn(),
}));

// eslint-disable-next-line import/first -- load the module only after its Jest dependencies are mocked
import {
  getAttendanceByDate,
  getAttendanceExportRecords,
  getAttendanceExportStudents,
} from "../students";

describe("attendance export queries", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadCache.mockResolvedValue(null);
    mockIsNetworkError.mockReturnValue(false);
    mockIsAuthError.mockReturnValue(false);
    mockIdentity={userId:"teacher-a",generation:1};mockGeneration=1;mockOrganizationId="org-1";
  });

  test("keeps fetching athlete pages until an empty page even when the backend caps below the requested limit", async () => {
    mockSupabaseGet
      .mockResolvedValueOnce([
        { id: "student-1", name: "Ana", membership_status: "active" },
        { id: "student-2", name: "Bia", membership_status: "inactive" },
      ])
      .mockResolvedValueOnce([]);

    await expect(
      getAttendanceExportStudents({ organizationId: "org-1" }),
    ).resolves.toEqual([
      { id: "student-1", name: "Ana", membershipStatus: "active" },
      { id: "student-2", name: "Bia", membershipStatus: "inactive" },
    ]);

    expect(mockSupabaseGet).toHaveBeenCalledTimes(2);
    expect(mockSupabaseGet.mock.calls[0]?.[0]).toContain(
      "select=id,name,membership_status",
    );
    expect(mockSupabaseGet.mock.calls[1]?.[0]).toContain("offset=2");
  });

  test("paginates attendance with a minimal projection and stable scope filters", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `attendance-${index}`,
      classid: "class-1",
      studentid: `student-${index}`,
      date: "2026-08-01",
      status: index % 2 === 0 ? "presente" : "faltou",
    }));
    mockSupabaseGet
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([
        {
          id: "attendance-500",
          classid: "class-1",
          studentid: "student-500",
          date: "2026-08-02",
          status: "presente",
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getAttendanceExportRecords({
      organizationId: "org-1",
      startIso: "2026-08-01",
      endIso: "2026-09-01",
      classIds: ["class-1"],
      studentId: "student-filter",
    });

    expect(result).toHaveLength(501);
    expect(mockSupabaseGet).toHaveBeenCalledTimes(3);
    const firstPath = String(mockSupabaseGet.mock.calls[0]?.[0]);
    expect(firstPath).toContain("select=id,classid,studentid,date,status");
    expect(firstPath).toContain("organization_id=eq.org-1");
    expect(firstPath).toContain("classid=in.(class-1)");
    expect(firstPath).toContain("studentid=eq.student-filter");
    expect(firstPath).not.toContain("note");
    expect(firstPath).not.toContain("pain_score");
    expect(mockSupabaseGet.mock.calls[1]?.[0]).toContain("offset=500");
    expect(mockSupabaseGet.mock.calls[2]?.[0]).toContain("offset=501");
  });

  test("class highlights retain SQL name/id order, inactive athletes and only the primary class filter",async()=>{
    mockSupabaseGet.mockResolvedValueOnce([
      {id:"student-z",name:"Ágata",membership_status:"inactive"},
      {id:"student-a",name:"Zeca",membership_status:"active"},
    ]).mockResolvedValueOnce([]);
    const rows=await getAttendanceExportStudents({organizationId:"org-1",classId:"class-a",orderByName:true});
    expect(rows).toEqual([{id:"student-z",name:"Ágata",membershipStatus:"inactive"},{id:"student-a",name:"Zeca",membershipStatus:"active"}]);
    const paths=mockSupabaseGet.mock.calls.map(([path])=>String(path));
    expect(paths.every(path=>path.includes("select=id,name,membership_status")&&path.includes("classid=eq.class-a")&&path.includes("order=name.asc,id.asc")&&!path.includes("offset=")&&!path.includes("select=*")&&!path.includes("enrollment")&&!path.includes("financial"))).toBe(true);
    expect(new URL(paths[1],"https://fixture.invalid").searchParams.get("or")).toContain('id.gt."student-a"');
  });

  test.each(["user","session","organization","generation","roundtrip"])("minimal names reject %s changes between pages without returning a partial list",async kind=>{
    mockSupabaseGet.mockImplementationOnce(async()=>{
      if(kind==="user")mockIdentity.userId="teacher-b";
      if(kind==="session")mockIdentity.generation++;
      if(kind==="organization")mockOrganizationId="org-2";
      if(kind==="generation"||kind==="roundtrip")mockGeneration++;
      return [{id:"student-a",name:"Ana",membership_status:"active"}];
    });
    await expect(getAttendanceExportStudents({organizationId:"org-1"})).rejects.toThrow();
    expect(mockSupabaseGet).toHaveBeenCalledTimes(1);expect(mockReadCache).not.toHaveBeenCalled();
  });

  test("an explicit authorized organization is preserved while the initial workspace stays unchanged",async()=>{
    mockSupabaseGet.mockResolvedValueOnce([{id:"student-b",name:"Bia",membership_status:"active"}]).mockResolvedValueOnce([]);
    expect(await getAttendanceExportStudents({organizationId:"org-2"})).toEqual([{id:"student-b",name:"Bia",membershipStatus:"active"}]);
    expect(mockSupabaseGet.mock.calls[0][0]).toContain("organization_id=eq.org-2");
  });

  test("reads all 5,000 minimal names past a capped server without health or financial hydration",async()=>{
    const rows=Array.from({length:5000},(_,index)=>({id:`student-${index}`,name:`Nome ${index}`,membership_status:"active"}));
    mockSupabaseGet.mockImplementation(async(path:string)=>{
      const query=new URL(path,"https://fixture.invalid").searchParams;
      const offset=Number(query.get("offset"));return rows.slice(offset,offset+137);
    });
    expect(await getAttendanceExportStudents({organizationId:"org-1"})).toHaveLength(5000);
    expect(mockSupabaseGet).toHaveBeenCalledTimes(38);
    expect(mockSupabaseGet.mock.calls.every(([path])=>String(path).startsWith("/students?select=id,name,membership_status&organization_id=eq.org-1&order=id.asc&"))).toBe(true);
  });

  test("fails explicitly when pagination repeats a record instead of returning a truncated export", async () => {
    const repeatedRow = {
      id: "attendance-1",
      classid: "class-1",
      studentid: "student-1",
      date: "2026-08-01",
      status: "presente",
    };
    mockSupabaseGet
      .mockResolvedValueOnce([repeatedRow])
      .mockResolvedValueOnce([repeatedRow]);

    await expect(
      getAttendanceExportRecords({
        organizationId: "org-1",
        startIso: "2026-08-01",
        endIso: "2026-09-01",
      }),
    ).rejects.toThrow("retornou registros repetidos");
  });

  test("propagates a network failure when a selected date has no cached attendance", async () => {
    const networkError = new Error("Network request failed");
    mockSupabaseGet.mockRejectedValue(networkError);
    mockIsNetworkError.mockImplementation((error) => error === networkError);

    await expect(
      getAttendanceByDate("class-1", "2026-08-01", {
        organizationId: "org-1",
      }),
    ).rejects.toBe(networkError);
  });

  test("retains the offline cache fallback for a selected date when records exist", async () => {
    const networkError = new Error("Network request failed");
    const cachedRecord = {
      id: "attendance-cached",
      classId: "class-1",
      studentId: "student-1",
      date: "2026-08-01",
      status: "presente" as const,
      note: "",
      painScore: 0,
      createdAt: "2026-08-01T10:00:00.000Z",
    };
    mockSupabaseGet.mockRejectedValue(networkError);
    mockIsNetworkError.mockImplementation((error) => error === networkError);
    mockReadCache.mockResolvedValue({
      "org-1": {
        "class-1": {
          "2026-08-01": [cachedRecord],
        },
      },
    });

    await expect(
      getAttendanceByDate("class-1", "2026-08-01", {
        organizationId: "org-1",
      }),
    ).resolves.toEqual([cachedRecord]);
  });

  test("distinguishes a cached empty date from the absence of any cache", async () => {
    const networkError = new Error("Network request failed");
    mockSupabaseGet.mockRejectedValue(networkError);
    mockIsNetworkError.mockImplementation((error) => error === networkError);
    mockReadCache.mockResolvedValue({
      "org-1": {
        "class-1": {
          "2026-08-01": [],
        },
      },
    });

    await expect(
      getAttendanceByDate("class-1", "2026-08-01", {
        organizationId: "org-1",
      }),
    ).resolves.toEqual([]);
  });
});
