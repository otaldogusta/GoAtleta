import type { Href } from "expo-router";

type ResolveBottomTabPressInput = {
  focused: boolean;
  href: Href;
  isWeb: boolean;
  routeName: string;
};

export type BottomTabPressAction =
  | { type: "none" }
  | { type: "navigate"; routeName: string }
  | { type: "push"; href: Href };

export function resolveBottomTabPress({
  focused,
  href,
  isWeb,
  routeName,
}: ResolveBottomTabPressInput): BottomTabPressAction {
  if (!isWeb) {
    return { type: "navigate", routeName };
  }

  if (focused) {
    return { type: "none" };
  }

  return { type: "push", href };
}
