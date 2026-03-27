import { lazy, Suspense, type ReactNode } from "react";
import { usePathname } from "expo-router";

const LazyCopilotProvider = lazy(async () => {
  const { CopilotProvider } = await import("./CopilotProvider");

  function CopilotProviderBridge({ children }: { children: ReactNode }) {
    return <CopilotProvider>{children}</CopilotProvider>;
  }

  return { default: CopilotProviderBridge };
});

const COPILOT_ROUTE_PREFIXES = [
  "/class",
  "/classes",
  "/coordination",
  "/events",
  "/nfc-attendance",
  "/periodization",
  "/prof/classes",
  "/prof/nfc-attendance",
  "/prof/periodization",
] as const;

const shouldEnableCopilot = (pathname: string) =>
  COPILOT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export function RouteScopedCopilotProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <Suspense fallback={children}>
      {shouldEnableCopilot(pathname) ? (
        <LazyCopilotProvider>{children}</LazyCopilotProvider>
      ) : (
        children
      )}
    </Suspense>
  );
}
