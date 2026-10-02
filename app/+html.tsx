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
#goatleta-initial-loading {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: linear-gradient(180deg, #0A1322, #0E1729, #162033);
  color: var(--goatleta-boot-text);
  font: 600 14px system-ui, sans-serif;
}
:root[data-goatleta-theme="light"] #goatleta-initial-loading {
  background: var(--goatleta-boot-background);
}
#goatleta-initial-loading .boot-spinner {
  width: 36px;
  height: 36px;
  box-sizing: border-box;
  border: 4px solid color-mix(in srgb, currentColor 20%, transparent);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: goatleta-boot-spin 800ms linear infinite;
}
:root[data-goatleta-react-mounted] #goatleta-initial-loading { display: none; }
@keyframes goatleta-boot-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  #goatleta-initial-loading .boot-spinner { animation: none; }
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
        <title>Go Atleta</title>
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
      <body>
        <div id="goatleta-initial-loading" role="status" aria-live="polite">
          <span className="boot-spinner" aria-hidden="true" />
          <span>Carregando...</span>
        </div>
        {children}
      </body>
    </html>
  );
}
