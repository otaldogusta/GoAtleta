type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export const resolveWebLocalStorage = (
  platform: string,
  candidate: unknown,
): WebStorage | null => {
  if (platform !== "web" || !candidate || typeof candidate !== "object") {
    return null;
  }
  const storage = candidate as Partial<WebStorage>;
  return typeof storage.getItem === "function" && typeof storage.setItem === "function"
    ? (storage as WebStorage)
    : null;
};
