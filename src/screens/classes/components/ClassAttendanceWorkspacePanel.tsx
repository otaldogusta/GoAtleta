import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";

import type { Student } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useContainerResponsiveLayout } from "../../../ui/use-container-responsive-layout";
import type { EmbeddedAttendanceStatus } from "../../attendance/use-embedded-class-attendance";

const STACKED_ATTENDANCE_PANEL_WIDTH = 360;

export function resolveStackedAttendancePanel(width: number, mobile: boolean) {
  return mobile && width > 0 && width < STACKED_ATTENDANCE_PANEL_WIDTH;
}

type ClassAttendanceWorkspacePanelProps = {
  colors: ThemeColors;
  compact: boolean;
  mobile: boolean;
  dense: boolean;
  dateLabel: string;
  students: Student[];
  statusById: Record<string, EmbeddedAttendanceStatus>;
  markedCount: number;
  hasChanges: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onOpenCalendar: () => void;
  onOpenReport: () => void;
  onSetStatus: (studentId: string, status: "presente" | "faltou") => void;
  onSave: () => void;
};

function initials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";
}

function StudentAvatar({ student, colors, dense = false }: { student: Student; colors: ThemeColors; dense?: boolean }) {
  return (
    <View style={[styles.avatar, dense ? styles.avatarDense : null, { backgroundColor: colors.secondaryBg, borderColor: colors.border }]}>
      {student.photoUrl ? (
        <Image source={{ uri: student.photoUrl }} style={styles.avatarImage} resizeMode="cover" />
      ) : (
        <Text style={[styles.avatarLabel, { color: colors.text }]}>{initials(student.name)}</Text>
      )}
    </View>
  );
}

export function ClassAttendanceWorkspacePanel({
  colors,
  compact,
  mobile,
  dense,
  dateLabel,
  students,
  statusById,
  markedCount,
  hasChanges,
  isLoading,
  isSaving,
  error,
  onPrevious,
  onNext,
  onOpenCalendar,
  onOpenReport,
  onSetStatus,
  onSave,
}: ClassAttendanceWorkspacePanelProps) {
  const { containerRef, onLayout, width } = useContainerResponsiveLayout("content");
  const stacked = resolveStackedAttendancePanel(width, mobile);
  const compactPanel = compact || mobile;
  const compactDesktop = compactPanel && !mobile;
  const densePanel = dense || compactDesktop;

  return (
    <View ref={containerRef} onLayout={onLayout} style={[styles.panel, mobile ? styles.panelMobile : null, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.toolbar, mobile ? styles.toolbarMobile : compactDesktop ? styles.toolbarCompact : null, densePanel && !mobile ? styles.toolbarDense : null, { borderBottomColor: colors.border }]}>
        <View style={[styles.dateNavigator, mobile ? styles.dateNavigatorMobile : compactDesktop ? styles.dateNavigatorCompact : null, densePanel && !mobile ? styles.dateNavigatorDense : null, { borderColor: colors.border }]}>
          <Pressable
            onPress={onPrevious}
            hitSlop={mobile ? 2 : undefined}
            disabled={isLoading || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Aula anterior"
            style={({ pressed }) => [styles.circleButton, mobile ? styles.circleButtonMobile : densePanel ? styles.circleButtonDense : null, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
          >
            <GoAtletaIcon name="chevronBack" size={mobile || densePanel ? 16 : 18} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={onOpenCalendar}
            hitSlop={mobile ? 2 : undefined}
            disabled={isLoading || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Selecionar data da chamada"
            style={({ pressed }) => [styles.dateButton, mobile ? styles.dateButtonMobile : densePanel ? styles.dateButtonDense : null, { opacity: pressed ? 0.72 : 1 }]}
          >
            <GoAtletaIcon name="calendar" size={mobile || densePanel ? 16 : 18} color={colors.muted} />
            <Text style={[styles.dateLabel, mobile ? styles.dateLabelMobile : densePanel ? styles.dateLabelDense : null, { color: colors.text }]}>{dateLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onNext}
            hitSlop={mobile ? 2 : undefined}
            disabled={isLoading || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Próxima aula"
            style={({ pressed }) => [styles.circleButton, mobile ? styles.circleButtonMobile : densePanel ? styles.circleButtonDense : null, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
          >
            <GoAtletaIcon name="chevronRight" size={mobile || densePanel ? 16 : 18} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.toolbarActions, mobile ? styles.toolbarActionsMobile : compactDesktop ? styles.toolbarActionsCompact : null, densePanel && !mobile ? styles.toolbarActionsDense : null]}>
          <Text numberOfLines={1} style={[styles.markedLabel, mobile ? styles.markedLabelMobile : compactDesktop ? styles.markedLabelCompact : null, densePanel && !mobile ? styles.markedLabelDense : null, { color: colors.muted }]}>
            <Text style={{ color: markedCount ? colors.successText : colors.text, fontWeight: "800" }}>{markedCount}</Text>
            {` de ${students.length} marcados`}
          </Text>
          <Pressable
            onPress={onOpenReport}
            hitSlop={mobile ? 2 : undefined}
            accessibilityRole="button"
            accessibilityLabel="Abrir relatório"
            style={({ pressed }) => [styles.reportButton, mobile ? styles.reportButtonMobile : compactDesktop ? styles.reportButtonCompact : null, densePanel && !mobile ? styles.reportButtonDense : null, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
          >
            <GoAtletaIcon name="document" size={16} color={colors.text} />
            <Text style={[styles.reportButtonLabel, mobile || densePanel ? styles.reportButtonLabelDense : null, { color: colors.text }]}>Abrir relatório</Text>
          </Pressable>
          {!mobile ? (
            <Pressable
              onPress={onSave}
              disabled={!hasChanges || isSaving}
              accessibilityRole="button"
              accessibilityLabel="Salvar chamada"
              style={({ pressed }) => [
                styles.saveButton,
                densePanel ? styles.saveButtonDense : null,
                { backgroundColor: colors.primaryBg, opacity: !hasChanges || isSaving ? 0.55 : pressed ? 0.8 : 1 },
              ]}
            >
              {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : <GoAtletaIcon name="checkmark" size={16} color={colors.primaryText} />}
              <Text style={[styles.saveButtonLabel, densePanel ? styles.saveButtonLabelDense : null, { color: colors.primaryText }]}>Salvar chamada</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={[
          styles.studentList,
          mobile ? styles.studentListMobile : null,
          densePanel && !mobile ? styles.studentListDense : null,
        ]}
        nestedScrollEnabled
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder }]}>
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>{error}</Text>
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingState} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.primaryBg} />
            <Text style={{ color: colors.muted, fontWeight: "700" }}>Carregando chamada…</Text>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.loadingState}>
            <Text style={{ color: colors.muted, fontWeight: "700" }}>Nenhum aluno nesta turma.</Text>
          </View>
        ) : (
          students.map((student) => {
            const status = statusById[student.id];
            return (
              <View key={student.id} style={[styles.studentRow, mobile ? styles.studentRowMobile : null, stacked ? styles.studentRowStacked : null, densePanel && !mobile ? styles.studentRowDense : null, { borderBottomColor: colors.border }]}>
                <View style={[styles.studentIdentity, mobile ? styles.studentIdentityMobile : null, stacked ? styles.studentIdentityStacked : null]}>
                  <StudentAvatar student={student} colors={colors} dense={densePanel || mobile} />
                  <Text numberOfLines={mobile ? 2 : 1} style={[styles.studentName, mobile ? styles.studentNameMobile : null, densePanel && !mobile ? styles.studentNameDense : null, { color: colors.text }]}>{student.name}</Text>
                </View>
                <View style={[styles.rowActions, mobile ? styles.rowActionsMobile : null, stacked ? styles.rowActionsStacked : null, densePanel && !mobile ? styles.rowActionsDense : null]}>
                  <View style={[styles.segmentedControl, mobile ? styles.segmentedControlMobile : null, stacked ? styles.segmentedControlStacked : null, densePanel && !mobile ? styles.segmentedControlDense : null, { borderColor: colors.border }]}>
                    <Pressable
                      onPress={() => onSetStatus(student.id, "presente")}
                      hitSlop={mobile ? 3 : undefined}
                      disabled={isSaving}
                      accessibilityRole="button"
                      accessibilityState={{ selected: status === "presente" }}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        mobile ? styles.segmentButtonMobile : densePanel ? styles.segmentButtonDense : null,
                        status === "presente" ? { backgroundColor: colors.successBg } : null,
                        { opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <Text style={[styles.segmentLabel, mobile || densePanel ? styles.segmentLabelDense : null, { color: status === "presente" ? colors.successText : colors.text }]}>Presente</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onSetStatus(student.id, "faltou")}
                      hitSlop={mobile ? 3 : undefined}
                      disabled={isSaving}
                      accessibilityRole="button"
                      accessibilityState={{ selected: status === "faltou" }}
                      style={({ pressed }) => [
                        styles.segmentButton,
                        mobile ? styles.segmentButtonMobile : densePanel ? styles.segmentButtonDense : null,
                        styles.segmentDivider,
                        { borderLeftColor: colors.border },
                        status === "faltou" ? { backgroundColor: colors.dangerBg } : null,
                        { opacity: pressed ? 0.72 : 1 },
                      ]}
                    >
                      <Text style={[styles.segmentLabel, mobile || densePanel ? styles.segmentLabelDense : null, { color: status === "faltou" ? colors.dangerText : colors.text }]}>Faltou</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {mobile ? (
        <View style={[styles.mobileSaveBar, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={onSave}
            disabled={!hasChanges || isSaving}
            accessibilityRole="button"
            accessibilityLabel="Salvar chamada"
            style={({ pressed }) => [
              styles.saveButton,
              styles.mobileSaveButton,
              { backgroundColor: colors.primaryBg, opacity: !hasChanges || isSaving ? 0.55 : pressed ? 0.8 : 1 },
            ]}
          >
            {isSaving ? <ActivityIndicator size="small" color={colors.primaryText} /> : <GoAtletaIcon name="checkmark" size={16} color={colors.primaryText} />}
            <Text style={[styles.saveButtonLabel, { color: colors.primaryText }]}>Salvar chamada</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { width: "100%", borderWidth: 1, borderRadius: 18, overflow: "hidden" },
  panelMobile: { borderRadius: 14 },
  toolbar: { minHeight: 78, padding: 14, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  toolbarCompact: { padding: 12, gap: 10 },
  toolbarMobile: { minHeight: 0, flexDirection: "column", alignItems: "stretch", padding: 10, gap: 8 },
  toolbarDense: { minHeight: 62, padding: 10, gap: 8 },
  dateNavigator: { minWidth: 350, height: 54, borderWidth: 1, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  dateNavigatorCompact: { minWidth: 260, width: "auto", flexBasis: 320, flexGrow: 0, flexShrink: 1, height: 44 },
  dateNavigatorMobile: { minWidth: 0, width: "100%", height: 44, borderRadius: 12, paddingHorizontal: 4 },
  dateNavigatorDense: { minWidth: 270, height: 44, borderRadius: 12, paddingHorizontal: 5 },
  circleButton: { width: 42, height: 42, borderWidth: 1, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  circleButtonDense: { width: 34, height: 34, borderRadius: 17 },
  circleButtonMobile: { width: 40, height: 40, borderRadius: 20 },
  dateButton: { minWidth: 0, flex: 1, minHeight: 44, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  dateButtonDense: { minHeight: 36, paddingHorizontal: 6, gap: 6 },
  dateButtonMobile: { minHeight: 40, paddingHorizontal: 4, gap: 6 },
  dateLabel: { fontSize: 18, fontWeight: "900" },
  dateLabelDense: { fontSize: 15 },
  dateLabelMobile: { fontSize: 16, lineHeight: 20 },
  toolbarActions: { minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  toolbarActionsCompact: { minWidth: 0, width: undefined, alignSelf: "auto", flexGrow: 1, flexShrink: 1, flexBasis: 0, justifyContent: "flex-end", gap: 8 },
  toolbarActionsMobile: {
    width: "100%",
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    justifyContent: "space-between",
    gap: 8,
  },
  toolbarActionsDense: { gap: 8 },
  markedLabel: { fontSize: 13, fontWeight: "600" },
  markedLabelCompact: { minWidth: 0, flex: 1, fontSize: 12 },
  markedLabelDense: { fontSize: 12, flexShrink: 0 },
  markedLabelMobile: { minWidth: 0, flex: 1, fontSize: 12 },
  reportButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  reportButtonCompact: { flexShrink: 0, minHeight: 40, paddingHorizontal: 10, gap: 6 },
  reportButtonMobile: { flexShrink: 0, minHeight: 40, paddingHorizontal: 10, gap: 6 },
  reportButtonDense: { minHeight: 38, paddingHorizontal: 10, gap: 5 },
  reportButtonLabel: { fontSize: 13, fontWeight: "800" },
  reportButtonLabelDense: { fontSize: 12 },
  saveButton: { minHeight: 44, borderRadius: 12, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  saveButtonDense: { minHeight: 38, paddingHorizontal: 12, gap: 6 },
  saveButtonLabel: { fontSize: 14, fontWeight: "900" },
  saveButtonLabelDense: { fontSize: 13 },
  errorBanner: { margin: 12, marginBottom: 0, borderWidth: 1, borderRadius: 12, padding: 12 },
  loadingState: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
  studentList: { maxHeight: 560 },
  studentListDense: { maxHeight: 480 },
  studentListMobile: { maxHeight: 440 },
  studentRow: { minHeight: 78, borderBottomWidth: 1, paddingHorizontal: 16, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 14 },
  studentRowDense: { minHeight: 64, paddingHorizontal: 12, paddingVertical: 6, gap: 10 },
  studentRowMobile: { minHeight: 56, paddingHorizontal: 10, paddingVertical: 6, gap: 8, overflow: "hidden" },
  studentRowStacked: { minHeight: 0, alignItems: "stretch", flexDirection: "column", paddingVertical: 8, gap: 6 },
  studentIdentity: { minWidth: 0, flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  studentIdentityMobile: { minWidth: 0, flex: 1, gap: 8, overflow: "visible" },
  studentIdentityStacked: { width: "100%", minHeight: 36, flexGrow: 0, flexShrink: 0 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarDense: { width: 34, height: 34, borderRadius: 17 },
  avatarImage: { width: "100%", height: "100%" },
  avatarLabel: { fontSize: 14, fontWeight: "900" },
  studentName: { minWidth: 0, flex: 1, fontSize: 15, fontWeight: "800" },
  studentNameMobile: { fontSize: 13, lineHeight: 17 },
  studentNameDense: { fontSize: 14 },
  rowActions: { width: 250, flexDirection: "row", alignItems: "center", justifyContent: "flex-end" },
  rowActionsMobile: { width: 142, minWidth: 0, flexShrink: 0, justifyContent: "flex-end" },
  rowActionsStacked: { width: "100%", alignSelf: "stretch" },
  rowActionsDense: { width: 220 },
  segmentedControl: { minWidth: 250, height: 44, borderWidth: 1, borderRadius: 11, overflow: "hidden", flexDirection: "row" },
  segmentedControlMobile: { minWidth: 0, width: 142, flex: 1, height: 38, borderRadius: 9 },
  segmentedControlStacked: { width: undefined, flex: 1 },
  segmentedControlDense: { minWidth: 220, height: 40, borderRadius: 10 },
  segmentButton: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center" },
  segmentButtonDense: { minHeight: 38 },
  segmentButtonMobile: { minHeight: 36 },
  segmentDivider: { borderLeftWidth: 1 },
  segmentLabel: { fontSize: 13, fontWeight: "800" },
  segmentLabelDense: { fontSize: 12 },
  mobileSaveBar: { borderTopWidth: 1, padding: 10 },
  mobileSaveButton: { width: "100%" },
});
