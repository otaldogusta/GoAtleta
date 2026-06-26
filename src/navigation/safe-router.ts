import { Platform } from "react-native";

type RouterLike = {
  back: () => void;
  canGoBack?: () => boolean;
  replace: (href: any) => void;
};

type SafeBackOptions = {
  router: RouterLike;
  fallback: any;
};

export function navigateBackOrReplace({ router, fallback }: SafeBackOptions) {
  if (Platform.OS === "web") {
    router.replace(fallback);
    return;
  }

  try {
    if (router.canGoBack?.()) {
      router.back();
      return;
    }
  } catch {
    // Fall through to the explicit fallback route.
  }

  router.replace(fallback);
}
