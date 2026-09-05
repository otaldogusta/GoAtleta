const mockExecSync = jest.fn();

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: () => ({
    execSync: (sql: string) => mockExecSync(sql),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
  }),
}));

describe("SQLite bootstrap migrations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates indexes only after additive columns can be migrated", () => {

    const { initDb } = jest.requireActual("../sqlite") as typeof import("../sqlite");

    initDb();

    const statements = mockExecSync.mock.calls.map(([sql]) => String(sql));
    const initialSchema = statements[0];
    expect(initialSchema).toContain("CREATE TABLE IF NOT EXISTS class_plans");
    expect(initialSchema).not.toContain("CREATE INDEX");

    const planningOrgMigration = statements.findIndex((sql) =>
      sql.includes("ALTER TABLE planning_cycles ADD COLUMN organizationId")
    );
    const planningOrgIndex = statements.findIndex((sql) =>
      sql.includes("idx_planning_cycles_org_class_status")
    );
    const classCycleMigration = statements.findIndex((sql) =>
      sql.includes("ALTER TABLE class_plans ADD COLUMN cycleId")
    );
    const classCycleIndex = statements.findIndex((sql) =>
      sql.includes("idx_class_plans_class_cycle_start")
    );

    expect(planningOrgMigration).toBeGreaterThan(0);
    expect(planningOrgIndex).toBeGreaterThan(planningOrgMigration);
    expect(classCycleMigration).toBeGreaterThan(0);
    expect(classCycleIndex).toBeGreaterThan(classCycleMigration);
  });
});
