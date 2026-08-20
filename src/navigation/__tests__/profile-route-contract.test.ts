import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");

const read = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

describe("professor and coordination route contract", () => {
  it("keeps primary tabs in their own shells", () => {
    const config = read("src/components/navigation/tab-config.ts");
    expect(config).toContain('href: "/prof/classes"');
    expect(config).toContain('href: "/coord/classes"');
    expect(config).not.toContain('href: "/prof/reports"');
    expect(config).not.toContain('href: "/coord/reports"');
    expect(read("app/prof/reports.tsx")).toContain(
      '<Redirect href="/prof/classes" />'
    );
    expect(config).not.toContain('role === "coord" ? "/prof/classes"');
    expect(read("app/coord/reports.tsx")).toContain(
      '<Redirect href="/coord/management" />'
    );
    expect(read("app/reports/index.tsx")).toContain(
      '<Redirect href="/coord/management" />'
    );
  });

  it("provides coordination wrappers for shared planning and NFC screens", () => {
    expect(read("app/coord/planning.tsx")).toContain('"../training"');
    expect(read("app/coord/nfc-attendance.tsx")).toContain('"../nfc-attendance"');
  });

  it("keeps member management in one coordination center", () => {
    const config = read("src/components/navigation/tab-config.ts");
    const sidebar = read("src/ui/WebSidebar.tsx");
    expect(config).toContain('href: "/coord/management"');
    expect(config).not.toContain('href: "/coord/org-members"');
    expect(sidebar).not.toContain('key: "members"');
    expect(sidebar).not.toContain('href: "/coord/org-members"');
    expect(read("app/coord/org-members.tsx")).toContain(
      '<Redirect href="/coord/management" />'
    );
    expect(read("app/org-members.tsx")).toContain(
      '<Redirect href="/coord/management" />'
    );
  });

  it("does not send coordination shortcuts into the professor shell", () => {
    const sidebar = read("src/ui/WebSidebar.tsx");
    const home = read("src/screens/home/HomeProfessorBelowFold.tsx");
    const professorItems = sidebar.slice(
      sidebar.indexOf("prof: ["),
      sidebar.indexOf("coord: [")
    );
    const coordinationItems = sidebar.slice(
      sidebar.indexOf("coord: ["),
      sidebar.indexOf("student: [")
    );
    expect(professorItems).toContain('href: "/prof/nfc-attendance"');
    expect(professorItems).not.toContain('href: "/coord/nfc-attendance"');
    expect(coordinationItems).toContain('href: "/coord/nfc-attendance"');
    expect(coordinationItems).not.toContain('href: "/prof/nfc-attendance"');
    expect(home).toContain('route: "/coord/nfc-attendance"');
  });

  it("keeps every professor sidebar destination available from Home shortcuts", () => {
    const home = read("src/screens/home/HomeProfessorBelowFold.tsx");
    const professorShortcutRoutes = [
      "/prof/planning",
      "/prof/consultation",
      "/prof/classes",
      "/prof/students",
      "/prof/calendar",
      "/prof/absence-notices",
      "/prof/nfc-attendance",
      "/prof/exercises",
      "/prof/periodization",
      "/prof/regulation-history",
      "/prof/assistant",
    ];

    professorShortcutRoutes.forEach((route) => {
      expect(home).toContain(`navigateToShortcut("${route}")`);
    });
  });

  it("makes shared class and student screens use scoped routes", () => {
    expect(read("app/classes/index.tsx")).toContain("useTrainerRouteScope");
    expect(read("app/students/index.tsx")).toContain("useTrainerRouteScope");
    expect(read("app/class/[id].tsx")).toContain("scopedRoutes.classes");
  });

  it("keeps shared event and session actions inside the active trainer shell", () => {
    const eventDetails = read("app/events/[id].tsx");
    const session = read("app/class/[id]/session.tsx");
    expect(eventDetails).toContain("scopedRoutes.events");
    expect(eventDetails).not.toContain('router.replace("/events")');
    expect(session).toContain("pathname: scopedRoutes.planning");
    expect(session).not.toContain('pathname: "/prof/planning"');
  });
});
