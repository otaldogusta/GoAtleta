import { responsiveBreakpoints } from "../ui/responsive-layout";

const publicRoutes = new Set([
  "/welcome",
  "/login",
  "/signup",
  "/verify-email",
  "/reset-password",
  "/pending",
  "/auth-callback",
  "/staff-invite",
  "/scouting/enviar-video",
]);

const invitePrefixes = ["/invite", "/family-invite", "/staff-invite"];

export function isCopilotPublicRoute(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return publicRoutes.has(path) || invitePrefixes.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function usesCalendarAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && ["/calendar", "/prof/calendar", "/coord/calendar"].includes(pathname.replace(/\/+$/, ""));
}

export function usesLibraryAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && ["/exercises", "/prof/exercises"].includes(pathname.replace(/\/+$/, ""));
}

export function usesConsultationAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && ["/consultation", "/prof/consultation", "/coord/consultation"].includes(pathname.replace(/\/+$/, ""));
}

export function usesPeriodizationAssistantButton(pathname: string, _viewportWidth: number): boolean {
  const path = pathname.replace(/\/+$/, "");
  return (
    ["/periodization", "/prof/periodization", "/coord/periodization"].includes(path) ||
    /^\/class\/[^/]+\/periodization$/.test(path)
  );
}

export function usesManagementAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && ["/coordination", "/coord/management"].includes(pathname.replace(/\/+$/, ""));
}

export function usesFinanceAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.desktop && ["/coord/finance", "/coord/finance/manage"].includes(pathname.replace(/\/+$/, ""));
}

export function usesEvidenceAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && pathname.replace(/\/+$/, "") === "/evidence";
}

export function usesClassLogAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && /^\/class\/[^/]+\/log$/.test(pathname.replace(/\/+$/, ""));
}

export function usesProfileAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && [
    "/profile", "/profile/settings",
    "/prof/profile", "/prof/profile/settings",
    "/coord/profile", "/coord/profile/settings",
    "/student/profile", "/student/profile/settings",
  ].includes(pathname.replace(/\/+$/, ""));
}

export function usesRegulationsAssistantButton(pathname: string, viewportWidth: number): boolean {
  return viewportWidth < responsiveBreakpoints.workspace && ["/regulation-history", "/regulation-sources", "/prof/regulation-history", "/coord/regulation-history"].includes(pathname.replace(/\/+$/, ""));
}
