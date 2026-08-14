import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProfessorRoute(route: string) {
  return readFileSync(
    resolve(__dirname, `../../../app/prof/${route}.tsx`),
    "utf8"
  );
}

describe("professor permission route boundaries", () => {
  it.each([["periodization", "periodization"]])(
    "blocks %s before rendering when its permission is disabled",
    (route, permissionKey) => {
    const source = readProfessorRoute(route);

    expect(source).toContain(
      `<MemberPermissionBoundary permissionKey="${permissionKey}" redirectTo="/prof/home">`
    );
    }
  );

  it("redirects the retired professor reports route to classes", () => {
    expect(readProfessorRoute("reports")).toContain(
      '<Redirect href="/prof/classes" />'
    );
  });
});
