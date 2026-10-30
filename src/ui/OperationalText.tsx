import { createContext, forwardRef, useContext } from "react";
import { StyleSheet, Text as NativeText, type TextProps } from "react-native";

import { compactUiMetrics } from "../theme/compact-ui-metrics";

const TextAncestor = createContext(false);

// Keep the native instance type for callers using Text refs or type annotations.
export type OperationalText = NativeText;

/** Operational body default, with native typography, inheritance and props intact. */
// The paired type and value preserve React Native Text imports in both namespaces.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const OperationalText = forwardRef<NativeText, TextProps>(function OperationalText({ style, ...props }, ref) {
  const nested = useContext(TextAncestor);
  const text = <NativeText {...props} ref={ref} style={[nested ? null : styles.body, style]} />;
  return nested ? text : <TextAncestor.Provider value>{text}</TextAncestor.Provider>;
});

const styles = StyleSheet.create({ body: { fontSize: compactUiMetrics.bodyFontSize } });
