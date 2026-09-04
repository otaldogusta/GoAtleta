import { StyleSheet, Text } from "react-native";
import type { Student } from "../../../core/models";
import { useAppTheme } from "../../../ui/app-theme";
import { getStudentLoginAccessLabel } from "../application/student-login-access";

export function StudentLoginAccessStatus({ student, compact = false }: { student: Student; compact?: boolean }) {
  const { colors } = useAppTheme();
  const label = getStudentLoginAccessLabel(student);
  return <Text accessibilityLabel={`Login do atleta: ${label}`} style={[styles.label, { color: colors.muted }]}>{getStudentLoginAccessLabel(student, compact)}</Text>;
}

const styles = StyleSheet.create({ label: { fontSize: 10, lineHeight: 14, marginTop: 4 } });
