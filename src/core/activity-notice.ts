import AsyncStorage from "@react-native-async-storage/async-storage";

// Personal, organization-scoped UI preference; no attendance or student data.
const shown = new Map<string,string>();
export async function claimActivityNotice(userId: string, organizationId: string, day: string) {
  if (!userId || !organizationId) return false;
  const key = `activity-notice:v1:${encodeURIComponent(userId)}:${encodeURIComponent(organizationId)}`;
  if (shown.get(key) === day) return false;
  try {
    const stored = await AsyncStorage.getItem(key);
    if (stored === day || shown.get(key) === day) return false;
    shown.set(key,day);
    await AsyncStorage.setItem(key,day);
    return true;
  } catch { return false; } // Keep the inbox entry available if storage fails.
}
