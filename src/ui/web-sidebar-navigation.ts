import type { AppRole } from "../components/navigation/tab-config";

type SidebarItemWithKey = {
  key: string;
};

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
  "consultation",
  "assistant",
  "regulation-history",
] as const;

const COORDINATION_NAVIGATION_ORDER = [
  "dashboard",
  "classes",
  "students",
  "management",
  "events",
  "members",
  "nfc",
  "communications",
  "periodization",
  "regulation-history",
  "assistant",
] as const;

export function orderWebSidebarItems<T extends SidebarItemWithKey>(
  role: AppRole,
  items: readonly T[]
): T[] {
  if (role === "student") return [...items];

  const navigationOrder =
    role === "prof" ? PROFESSOR_NAVIGATION_ORDER : COORDINATION_NAVIGATION_ORDER;

  const positionByKey = new Map<string, number>(
    navigationOrder.map((key, index) => [key, index])
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
