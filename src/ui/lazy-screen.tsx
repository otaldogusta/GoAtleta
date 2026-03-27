import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { ScreenLoadingState } from "../components/ui/ScreenLoadingState";

type RouteScreenFallbackProps = {
  title?: string;
  subtitle?: string;
};

export function RouteScreenFallback({
  title = "Carregando...",
  subtitle = "Preparando a tela.",
}: RouteScreenFallbackProps) {
  void title;
  void subtitle;
  return <ScreenLoadingState />;
}

export function createLazyRoute<P extends object = Record<string, never>>(
  loader: () => Promise<{ default: ComponentType<unknown> }>,
  fallback: ReactNode
) {
  const LazyScreen = lazy(loader as () => Promise<{ default: ComponentType<P> }>);

  function LazyRoute(props: P) {
    return (
      <Suspense fallback={fallback}>
        <LazyScreen {...props} />
      </Suspense>
    );
  }

  return LazyRoute;
}
