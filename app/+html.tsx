import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// perf-check: ignore-render -- document shell, not a routed screen
// perf-check: ignore-measure -- no asynchronous screen data is loaded here

const initialThemeCss = `
:root {
  color-scheme: light;
  --goatleta-boot-background: #F5F0E8;
  --goatleta-boot-card: #FFFDF8;
  --goatleta-boot-input: #FFFFFF;
  --goatleta-boot-text: #0E1729;
}
@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --goatleta-boot-background: #0E1729;
    --goatleta-boot-card: #162033;
    --goatleta-boot-input: #1B263A;
    --goatleta-boot-text: #F1F4F9;
  }
}
:root[data-goatleta-theme="light"] {
  color-scheme: light;
  --goatleta-boot-background: #F5F0E8;
  --goatleta-boot-card: #FFFDF8;
  --goatleta-boot-input: #FFFFFF;
  --goatleta-boot-text: #0E1729;
}
:root[data-goatleta-theme="dark"] {
  color-scheme: dark;
  --goatleta-boot-background: #0E1729;
  --goatleta-boot-card: #162033;
  --goatleta-boot-input: #1B263A;
  --goatleta-boot-text: #F1F4F9;
}
html,
body {
  background: var(--goatleta-boot-background);
}
`;

const initialThemeScript = `
(() => {
  try {
    const storedTheme = window.localStorage.getItem("theme_override_v1");
    const parsedTheme = storedTheme ? JSON.parse(storedTheme) : null;
    const theme = parsedTheme === "dark" || parsedTheme === "light"
      ? parsedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    document.documentElement.dataset.goatletaTheme = theme;
  } catch {
    // The CSS media query remains the fallback when storage is unavailable.
  }
})();
`;

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" translate="no" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="google" content="notranslate" />
        <meta httpEquiv="content-language" content="pt-BR" />
        <style dangerouslySetInnerHTML={{ __html: initialThemeCss }} />
        <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
