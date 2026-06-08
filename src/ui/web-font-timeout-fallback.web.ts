type FontLoader = {
  loadAsync: (fontFamilyName: string, resource: unknown) => Promise<void>;
  __goAtletaTimeoutFallbackInstalled?: boolean;
};

const isFontTimeoutError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /timeout exceeded/i.test(message);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ExpoFontLoader = require("expo-font/build/ExpoFontLoader").default as FontLoader;
const loader = ExpoFontLoader;

if (!loader.__goAtletaTimeoutFallbackInstalled) {
  const originalLoadAsync = loader.loadAsync.bind(loader);
  loader.loadAsync = (fontFamilyName: string, resource: unknown) =>
    originalLoadAsync(fontFamilyName, resource).catch((error: unknown) => {
      if (!isFontTimeoutError(error)) {
        throw error;
      }
      console.warn(
        `[font] Continuing after web font timeout for ${fontFamilyName}.`
      );
    });
  loader.__goAtletaTimeoutFallbackInstalled = true;
}
