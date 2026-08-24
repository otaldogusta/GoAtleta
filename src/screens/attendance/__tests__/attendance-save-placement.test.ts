import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const attendanceRoute = readFileSync(
  resolve(__dirname, "../../../../app/class/[id]/attendance.tsx"),
  "utf8"
);
const attendanceWebRoute = readFileSync(
  resolve(__dirname, "../../../../app/class/[id]/attendance.web.tsx"),
  "utf8"
);

describe("attendance save indicator placement", () => {
  it("redirects the legacy web route to the embedded class attendance", () => {
    expect(attendanceWebRoute).toContain("buildClassAttendanceWorkspaceHref(classId, selectedDate)");
    expect(attendanceWebRoute).toContain("<Redirect");
  });

  it("renders the synchronization indicator before the class name in the header", () => {
    const indicatorMatches = attendanceRoute.match(/\{saveIndicator \? \(/g) ?? [];
    const indicatorIndex = attendanceRoute.indexOf("{saveIndicator ? (");
    const classNameIndex = attendanceRoute.indexOf("{cls.name}", indicatorIndex);
    const studentListIndex = attendanceRoute.indexOf("<FlatList");

    expect(indicatorMatches).toHaveLength(1);
    expect(indicatorIndex).toBeGreaterThan(-1);
    expect(classNameIndex).toBeGreaterThan(indicatorIndex);
    expect(indicatorIndex).toBeLessThan(studentListIndex);
    expect(attendanceRoute).toContain("iconOnly");
  });
});
