import type { AppRole } from "../components/navigation/tab-config";

type SidebarItemWithKey = {
  key: string;
};

export function shouldUseHardWebSidebarNavigation(pathname: string): boolean {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return /^\/class\/[^/]+\/periodization$/.test(normalizedPathname);
}

const PROFESSOR_NAVIGATION_ORDER = [
  "home",
  "planning",
  "classes",
  "students",
  "calendar",
  "nfc",
  "absence",
  "exercises",
  "periodization",
  "reports",
  "consultation",
  "assistant",
  "regulation-history",
] as const;

export function orderWebSidebarItems<T extends SidebarItemWithKey>(
  role: AppRole,
  items: readonly T[]
): T[] {
  if (role !== "prof") return [...items];

  const positionByKey = new Map<string, number>(
    PROFESSOR_NAVIGATION_ORDER.map((key, index) => [key, index])
  );

  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftPosition = positionByKey.get(left.item.key) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = positionByKey.get(right.item.key) ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || left.index - right.index;
    })
    .map(({ item }) => item);
}
