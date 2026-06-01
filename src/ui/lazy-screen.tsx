import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
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

  function LazyRoute(props: P) {
    return (
      <Suspense fallback={fallback}>
        <LazyScreen {...props} />
      </Suspense>
    );
  }

  return LazyRoute;
}
