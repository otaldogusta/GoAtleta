import AsyncStorage from "@react-native-async-storage/async-storage";

export type OnboardingProfile = {
  role: "trainer" | "student";
  focus: "performance" | "attendance" | "planning";
  frequency: "1-2" | "3-4" | "5+";
};

const ONBOARDING_SEEN_KEY = "onboarding_seen_v1";
const ONBOARDING_PROFILE_KEY = "onboarding_profile_v1";

export const hasSeenOnboarding = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
  return value === "1";
};

export const markOnboardingSeen = async () => {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1");
};

export const saveOnboardingProfile = async (profile: OnboardingProfile) => {
  await AsyncStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(profile));
};

export const loadOnboardingProfile = async (): Promise<OnboardingProfile | null> => {
  const raw = await AsyncStorage.getItem(ONBOARDING_PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OnboardingProfile;
    if (!parsed || typeof parsed !== "object") return null;
    if (!["trainer", "student"].includes(parsed.role)) return null;
    if (!["performance", "attendance", "planning"].includes(parsed.focus)) return null;
    if (!["1-2", "3-4", "5+"].includes(parsed.frequency)) return null;
    return parsed;
  } catch {
    return null;
  }
};
