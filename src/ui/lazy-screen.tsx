import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { ScreenLoadingState } from "../components/ui/ScreenLoadingState";
import { ptBR } from "../constants/copy/pt-br";

type RouteScreenFallbackProps = {
  title?: string;
  subtitle?: string;
};

export function RouteScreenFallback({
  title = ptBR.loading.generic,
  subtitle = ptBR.loading.preparingScreen,
}: RouteScreenFallbackProps) {
  void title;
  void subtitle;
  return <ScreenLoadingState />;
}

export function createLoadingFallback(subtitle: string) {
  return <RouteScreenFallback title={ptBR.loading.title} subtitle={subtitle} />;
}

export function createLazyRoute<P extends object = Record<string, never>>(
  loader: () => Promise<{ default: ComponentType<unknown> }>,
  fallback: ReactNode
) {
  const LazyScreen = lazy(loader as () => Promise<{ default: ComponentType<P> }>);

  function WebLazyRoute(props: P) {
    return (
      <Suspense fallback={fallback}>
        <LazyScreen {...props} />
      </Suspense>
    );
  }

  let resolvedScreen: ComponentType<P> | null = null;
  let pendingLoad: Promise<ComponentType<P>> | null = null;

  const loadNativeScreen = () => {
    if (resolvedScreen) return Promise.resolve(resolvedScreen);
    if (!pendingLoad) {
      pendingLoad = (loader as () => Promise<{ default: ComponentType<P> }>)()
        .then((module) => {
          resolvedScreen = module.default;
          return module.default;
        })
        .finally(() => {
          pendingLoad = null;
        });
    }
    return pendingLoad;
  };

  function NativeLazyRoute(props: P) {
    const [Screen, setScreen] = useState<ComponentType<P> | null>(() => resolvedScreen);
    const [loadError, setLoadError] = useState<unknown>(null);

    useEffect(() => {
      let mounted = true;

      void loadNativeScreen()
        .then((LoadedScreen) => {
          if (mounted) setScreen(() => LoadedScreen);
        })
        .catch((error: unknown) => {
          if (mounted) setLoadError(error);
        });

      return () => {
        mounted = false;
      };
    }, []);

    if (loadError) throw loadError;
    if (!Screen) return <>{fallback}</>;
    return <Screen {...props} />;
  }

  // Expo Router already splits route modules. React.lazy adds a second Suspense
  // boundary that can remain pending on Hermes after a route chunk is bundled.
  // Resolve that boundary explicitly on native while preserving web Suspense.
  return Platform.OS === "web" ? WebLazyRoute : NativeLazyRoute;
}
