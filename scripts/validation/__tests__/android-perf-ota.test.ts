import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("GoAtleta Perf OTA configuration", () => {
  const projectRoot = join(__dirname, "..", "..", "..");
  const readProjectFile = (path: string) => readFileSync(join(projectRoot, path), "utf8");

  it("enables updates and pins the isolated perf channel", () => {
    const manifest = readProjectFile("scripts/validation/android-perf/AndroidManifest.xml");

    expect(manifest).toContain('expo.modules.updates.ENABLED" android:value="true"');
    expect(manifest).toContain("expo-channel-name&quot;:&quot;perf");
  });

  it("keeps the checked-in Android runtime aligned with the app version", () => {
    const config = readProjectFile("app.config.js");
    const gradle = readProjectFile("scripts/validation/android-perf.init.gradle");
    const version = config.match(/\bversion:\s*"([^"]+)"/)?.[1];

    expect(version).toBeTruthy();
    expect(gradle).toContain("android.defaultConfig.versionName = appVersion");
    expect(gradle).toContain("resValue 'string', 'expo_runtime_version', appVersion");
  });
});
