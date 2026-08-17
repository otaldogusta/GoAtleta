import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("profile route shells", () => {
  const appRoot = join(process.cwd(), "app");
  const profileFolders = ["coord", "prof", "student"];

  const readProfileRouteShells = () =>
    profileFolders.flatMap((folder) => {
      const folderPath = join(appRoot, folder);

      return readdirSync(folderPath)
        .filter((fileName) => fileName.endsWith(".tsx"))
        .map((fileName) => ({
          route: `${folder}/${fileName}`,
          source: readFileSync(join(folderPath, fileName), "utf8"),
        }));
    });

  it("do not add a second lazy boundary around Expo Router routes", () => {
    const lazyRouteShells = readProfileRouteShells()
      .filter(({ source }) => source.includes("createLazyRoute"))
      .map(({ route }) => route);

    expect(lazyRouteShells).toEqual([]);
  });

  it("uses explicit default route components instead of default re-exports", () => {
    const defaultReExports = readProfileRouteShells()
      .filter(({ source }) => /export\s*\{\s*default\s*\}\s*from/.test(source))
      .map(({ route }) => route);

    expect(defaultReExports).toEqual([]);
  });
});
