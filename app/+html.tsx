import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// perf-check: ignore-render -- document shell, not a routed screen
// perf-check: ignore-measure -- no asynchronous screen data is loaded here

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR" translate="no">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="google" content="notranslate" />
        <meta httpEquiv="content-language" content="pt-BR" />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
