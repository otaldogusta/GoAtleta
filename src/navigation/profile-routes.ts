const normalizePath = (value: string) => {
  if (!value) return "/";
  const trimmed = value.trim();
  if (!trimmed) return "/";
  if (trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
};

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
  if (path.startsWith("/prof")) return "/prof/assistant";
  if (path.startsWith("/coord")) return "/coord/assistant";
  return "/assistant";
};

export const getScopedPlanningPath = (currentPath: string) => {
  const path = normalizePath(currentPath);
  if (path.startsWith("/prof") || path.startsWith("/coord")) return "/prof/planning";
  return "/training";
};
