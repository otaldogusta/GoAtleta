import type { ReactNode } from "react";
import { Platform } from "react-native";

/** Keep React DOM initialization inside the web platform boundary. */
export function createWebPortal(children: ReactNode, container: Element) {
  if (Platform.OS !== "web") return children;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Native renderers must not initialize React DOM.
  const { createPortal } = require("react-dom") as typeof import("react-dom");
  return createPortal(children, container);
}
