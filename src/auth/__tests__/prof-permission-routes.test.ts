import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProfessorRoute(route: string) {
  return readFileSync(
    resolve(__dirname, `../../../app/prof/${route}.tsx`),
    "utf8"
  );
}

describe("professor permission route boundaries", () => {
  it.each([
    ["reports", "reports"],
    ["periodization", "periodization"],
  ])("blocks %s before rendering when its permission is disabled", (route, permissionKey) => {
    const source = readProfessorRoute(route);

    expect(source).toContain(
      `<MemberPermissionBoundary permissionKey="${permissionKey}" redirectTo="/prof/home">`
    );
  });
});
