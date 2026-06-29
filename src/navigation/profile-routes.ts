const normalizePath = (value: string) => {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed) return "/";
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
};

const isScopedPath = (path: string, scope: string) =>
  path === scope || path.startsWith(`${scope}/`);

export const isAssistantRoutePath = (value: string) => {
  const path = normalizePath(value);
  return (
    path === "/assistant" ||
    path.startsWith("/assistant/") ||
    path === "/prof/assistant" ||
    path.startsWith("/prof/assistant/") ||
    path === "/coord/assistant" ||
    path.startsWith("/coord/assistant/")
  );
};

export const getScopedAssistantPath = (currentPath: string) => {
  const path = normalizePath(currentPath);
  if (isScopedPath(path, "/prof")) return "/prof/assistant";
  if (isScopedPath(path, "/coord") || path === "/coordination") return "/coord/assistant";
  return "/assistant";
};

export const getScopedPlanningPath = (currentPath: string) => {
  const path = normalizePath(currentPath);
  if (isScopedPath(path, "/prof") || isScopedPath(path, "/coord") || path === "/coordination") {
    return "/prof/planning";
  }
  return "/training";
};

export const getScopedProfilePath = (currentPath: string) => {
  const path = normalizePath(currentPath);
  if (isScopedPath(path, "/student")) return "/student/profile";
  if (isScopedPath(path, "/prof")) return "/prof/profile";
  if (isScopedPath(path, "/coord") || path === "/coordination") return "/coord/profile";
  return "/profile";
};
