import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const homeScreen = readFileSync(resolve(__dirname, "../HomeProfessor.tsx"), "utf8");

describe("home platform parity", () => {
  it("keeps the current Home experience enabled independently of Platform.OS", () => {
    expect(homeScreen).toContain("const usesCurrentHomeExperience = true;");
    expect(homeScreen).toContain("{usesCurrentHomeExperience ? (");
    expect(homeScreen).not.toContain("const isUx2CWebHome = isWebHome;");
  });

  it("uses the responsive mobile composition on native phones", () => {
    expect(homeScreen).toContain(
      "const isUx2CMobile = usesCurrentHomeExperience && responsiveLayout.isMobile;"
    );
  });
});
