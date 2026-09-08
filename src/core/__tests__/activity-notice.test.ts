import AsyncStorage from "@react-native-async-storage/async-storage";
import { claimActivityNotice } from "../activity-notice";
test("shows once per day, across visits, with separate user and organization scopes", async () => {
  expect(await claimActivityNotice("u1","o1","2026-09-07")).toBe(true);
  expect(await claimActivityNotice("u1","o1","2026-09-07")).toBe(false);
  expect(await claimActivityNotice("u2","o1","2026-09-07")).toBe(true);
  expect(await claimActivityNotice("u1","o2","2026-09-07")).toBe(true);
  expect(await claimActivityNotice("u1","o1","2026-09-08")).toBe(true);
  await AsyncStorage.setItem("activity-notice:v1:reload:org","2026-09-07");
  expect(await claimActivityNotice("reload","org","2026-09-07")).toBe(false);
});
test("concurrent mounts do not show the same notice twice", async () => {
  const results = await Promise.all([claimActivityNotice("parallel","org","2026-09-07"),claimActivityNotice("parallel","org","2026-09-07")]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect(await claimActivityNotice("","org","2026-09-07")).toBe(false);
});
