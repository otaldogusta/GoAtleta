import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_PREFIX = "student_duplicate_reviews_v1";

const storageKey = (organizationId: string, classId: string) =>
  `${STORAGE_PREFIX}:${organizationId}:${classId}`;

const parseSignatures = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
  } catch {
    return [];
  }
};

export async function loadReviewedDuplicateSignatures(params: {
  organizationId: string;
  classId: string;
}): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(storageKey(params.organizationId, params.classId));
  return new Set(parseSignatures(raw));
}

export async function saveReviewedDuplicateSignature(params: {
  organizationId: string;
  classId: string;
  signature: string;
}): Promise<void> {
  const key = storageKey(params.organizationId, params.classId);
  const current = new Set(parseSignatures(await AsyncStorage.getItem(key)));
  current.add(params.signature);
  await AsyncStorage.setItem(key, JSON.stringify(Array.from(current).sort()));
}
