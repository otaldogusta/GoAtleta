import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { AssistantPending } from "./AssistantPending";
import { ASSISTANT_PROGRESS_LABELS, type AssistantProgressCode } from "../progress";

export function AssistantProgress({ steps }: { steps: AssistantProgressCode[] }) {
  const { colors } = useAppTheme();
  if (!steps.length) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityLabel={ASSISTANT_PROGRESS_LABELS[steps[steps.length - 1]]}
      style={styles.root}
    >
      {steps.map((step, index) => {
        const active = index === steps.length - 1;
        return (
          <View key={step} style={styles.row}>
            {active ? (
              <AssistantPending label={ASSISTANT_PROGRESS_LABELS[step]} compact />
            ) : (
              <View style={styles.iconSlot}>
                <GoAtletaIcon name="checkmark" size={14} color={colors.successText} />
              </View>
            )}
            <Text style={[styles.label, { color: active ? colors.text : colors.muted }]}>
              {ASSISTANT_PROGRESS_LABELS[step]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: "flex-start", gap: 3, paddingVertical: 4 },
  row: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 8 },
  iconSlot: { width: 28, height: 20, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
});
