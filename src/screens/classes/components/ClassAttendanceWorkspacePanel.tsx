import { useState } from "react";
import { ActivityIndicator, FlatList, Image, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { Student } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useContainerResponsiveLayout } from "../../../ui/use-container-responsive-layout";
import type { EmbeddedAttendanceDetails, EmbeddedAttendanceStatus } from "../../attendance/use-embedded-class-attendance";
import { StudentPhotoViewerModal } from "../../students/components/StudentPhotoViewerModal";
import { ClassLessonDateNavigator } from "./ClassLessonDateNavigator";

const STACKED_ATTENDANCE_PANEL_WIDTH = 360;

const PAIN_OPTIONS = [
  {
    score: 0,
    label: "Sem dor",
    brows: "M7 12 Q10 11 13 12 M19 12 Q22 11 25 12",
    eyes: "M8 16 Q10 14 12 16 M20 16 Q22 14 24 16",
    mouth: "M11 27 Q16 28 21 27",
  },
  {
    score: 1,
    label: "Leve",
    brows: "M7 12.5 Q10 11 13 11.5 M19 11.5 Q22 11 25 12.5",
    eyes: "M8 16 Q10 14.5 12 16 M20 16 Q22 14.5 24 16",
    mouth: "M11 27 Q16 26 21 27",
  },
  {
    score: 2,
    label: "Moderada",
    brows: "M7 14 Q10 11 13 10 M19 10 Q22 11 25 14",
    eyes: "M8 16.5 Q10 15.5 12 16.5 M20 16.5 Q22 15.5 24 16.5",
    mouth: "M11 28 Q16 24 21 28",
  },
  {
    score: 3,
    label: "Intensa",
    brows: "M7 15 Q10 11 13 8.5 M19 8.5 Q22 11 25 15",
    eyes: "M8 17 Q10 16.5 12 17 M20 17 Q22 16.5 24 17",
    mouth: "M10 29 Q16 22 22 29",
  },
] as const;

function PainFaceIcon({ option, color }: { option: (typeof PAIN_OPTIONS)[number]; color: string }) {
  return (
    <Svg width={28} height={32} viewBox="0 0 32 38">
      <Path d="M16 2 C8.5 2 4.5 8.5 4.5 18 C4.5 28 9 34.5 16 36 C23 34.5 27.5 28 27.5 18 C27.5 8.5 23.5 2 16 2 Z" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={option.brows} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={option.eyes} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      <Path d={option.mouth} fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

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
  detailsById: Record<string, EmbeddedAttendanceDetails>;
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
  onSetDetails: (studentId: string, details: EmbeddedAttendanceDetails) => void;
  onSave: () => void;
  onBindStudentNfc?: (student: Student) => void;
  nfcBindingStudentId?: string | null;
};

function initials(value: string) {
  return (
    value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
      .join("") || "A"
  );
}

function StudentAvatar({ student, colors, dense = false, onOpenPhoto }: { student: Student; colors: ThemeColors; dense?: boolean; onOpenPhoto?: () => void }) {
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const photoUrl = student.photoUrl?.trim();
  const showPhoto = Boolean(photoUrl && failedPhotoUrl !== photoUrl);
  const avatarStyle = [styles.avatar, dense ? styles.avatarDense : null, { backgroundColor: colors.secondaryBg, borderColor: colors.border }];
  const content = showPhoto ? (
    <Image
      source={{ uri: photoUrl }}
      style={styles.avatarImage}
      resizeMode="cover"
      accessibilityLabel={`Foto de ${student.name}`}
      onError={() => setFailedPhotoUrl(photoUrl ?? null)}
    />
  ) : (
    <Text style={[styles.avatarLabel, { color: colors.text }]}>{initials(student.name)}</Text>
  );

  if (!showPhoto || !onOpenPhoto) return <View style={avatarStyle}>{content}</View>;

  return (
    <Pressable
      onPress={onOpenPhoto}
      accessibilityRole="button"
      accessibilityLabel={`Ampliar foto de ${student.name}`}
      style={({ pressed }) => [avatarStyle, { opacity: pressed ? 0.72 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

export function ClassAttendanceWorkspacePanel({ colors, compact, mobile, dense, dateLabel, students, statusById, detailsById, markedCount, hasChanges, isLoading, isSaving, error, onPrevious, onNext, onOpenCalendar, onOpenReport, onSetStatus, onSetDetails, onSave, onBindStudentNfc, nfcBindingStudentId = null }: ClassAttendanceWorkspacePanelProps) {
  const { containerRef, onLayout, width } = useContainerResponsiveLayout("content");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [photoPreviewStudent, setPhotoPreviewStudent] = useState<Student | null>(null);
  const [draftNote, setDraftNote] = useState("");
  const [draftPainScore, setDraftPainScore] = useState(0);
  const stacked = resolveStackedAttendancePanel(width, mobile);
  const compactPanel = compact || mobile;
  const compactDesktop = compactPanel && !mobile;
  const densePanel = dense || compactDesktop;
  const selectedStudentStatus = selectedStudent ? statusById[selectedStudent.id] : undefined;
  const openStudentDetails = (student: Student) => {
    const details = detailsById[student.id] ?? { note: "", painScore: 0 };
    setDraftNote(details.note);
    setDraftPainScore(details.painScore);
    setSelectedStudent(student);
  };

  const closeStudentDetails = () => {
    setSelectedStudent(null);
  };

  const confirmStudentDetails = () => {
    if (!selectedStudent || !selectedStudentStatus) return;
    onSetDetails(selectedStudent.id, {
      note: draftNote.trim(),
      painScore: draftPainScore,
    });
    closeStudentDetails();
  };

  const renderStudentRow = ({ item: student }: { item: Student }) => {
    const status = statusById[student.id];
    return (
      <View style={[styles.studentRow, mobile ? styles.studentRowMobile : null, stacked ? styles.studentRowStacked : null, densePanel && !mobile ? styles.studentRowDense : null, { borderBottomColor: colors.border }]}>
        <View style={[styles.studentIdentity, mobile ? styles.studentIdentityMobile : null, stacked ? styles.studentIdentityStacked : null]}>
          <StudentAvatar student={student} colors={colors} dense={densePanel || mobile} onOpenPhoto={() => setPhotoPreviewStudent(student)} />
          <Pressable onPress={() => openStudentDetails(student)} disabled={isSaving} accessibilityRole="button" accessibilityLabel={`Abrir dor e observações de ${student.name}`} style={({ pressed }) => [styles.studentNameButton, { opacity: pressed ? 0.72 : 1 }]}>
            <Text numberOfLines={mobile ? 2 : 1} style={[styles.studentName, styles.studentNameButtonLabel, mobile ? styles.studentNameMobile : null, densePanel && !mobile ? styles.studentNameDense : null, { color: colors.text }]}>
              {student.name}
            </Text>
          </Pressable>
        </View>
        <View style={[styles.rowActions, mobile ? styles.rowActionsMobile : null, stacked ? styles.rowActionsStacked : null, densePanel && !mobile ? styles.rowActionsDense : null]}>
          <View style={[styles.segmentedControl, mobile ? styles.segmentedControlMobile : null, stacked ? styles.segmentedControlStacked : null, densePanel && !mobile ? styles.segmentedControlDense : null, { borderColor: colors.border }]}>
            <Pressable onPress={() => onSetStatus(student.id, "presente")} hitSlop={mobile ? 3 : undefined} disabled={isSaving} accessibilityRole="button" accessibilityState={{ selected: status === "presente" }} style={({ pressed }) => [styles.segmentButton, mobile ? styles.segmentButtonMobile : densePanel ? styles.segmentButtonDense : null, status === "presente" ? { backgroundColor: colors.successBg } : null, { opacity: pressed ? 0.72 : 1 }]}>
              <Text style={[styles.segmentLabel, mobile || densePanel ? styles.segmentLabelDense : null, { color: status === "presente" ? colors.successText : colors.text }]}>Presente</Text>
            </Pressable>
            <Pressable onPress={() => onSetStatus(student.id, "faltou")} hitSlop={mobile ? 3 : undefined} disabled={isSaving} accessibilityRole="button" accessibilityState={{ selected: status === "faltou" }} style={({ pressed }) => [styles.segmentButton, mobile ? styles.segmentButtonMobile : densePanel ? styles.segmentButtonDense : null, styles.segmentDivider, { borderLeftColor: colors.border }, status === "faltou" ? { backgroundColor: colors.dangerBg } : null, { opacity: pressed ? 0.72 : 1 }]}>
              <Text style={[styles.segmentLabel, mobile || densePanel ? styles.segmentLabelDense : null, { color: status === "faltou" ? colors.dangerText : colors.text }]}>Faltou</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
    <View ref={containerRef} onLayout={onLayout} testID="embedded-attendance-section" style={styles.attendanceSection}>
      <ClassLessonDateNavigator
        colors={colors}
        dateLabel={dateLabel}
        onPrevious={onPrevious}
        onNext={onNext}
        onOpenCalendar={onOpenCalendar}
        disabled={isLoading || isSaving}
        isLoading={isLoading}
        calendarAccessibilityLabel="Selecionar data da chamada"
        testID="attendance-date-navigator"
      />
      <View style={[styles.panel, mobile ? styles.panelMobile : null, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.toolbar, mobile ? styles.toolbarMobile : compactDesktop ? styles.toolbarCompact : null, densePanel && !mobile ? styles.toolbarDense : null, { borderBottomColor: colors.border }]}>
        <View style={[styles.toolbarActions, mobile ? styles.toolbarActionsMobile : compactDesktop ? styles.toolbarActionsCompact : null, stacked ? styles.toolbarActionsStacked : null, densePanel && !mobile ? styles.toolbarActionsDense : null]}>
          <View style={[styles.syncSummary, stacked ? styles.syncSummaryStacked : null]}>
            <Text numberOfLines={stacked ? undefined : 1} style={[styles.markedLabel, mobile ? styles.markedLabelMobile : compactDesktop ? styles.markedLabelCompact : null, stacked ? styles.markedLabelStacked : null, densePanel && !mobile ? styles.markedLabelDense : null, { color: colors.muted }]}>
              <Text
                style={{
                  color: markedCount ? colors.successText : colors.text,
                  fontWeight: "800",
                }}
              >
                {markedCount}
              </Text>
            {` de ${students.length} marcados`}
            </Text>
          </View>
          <View style={[styles.toolbarButtons, mobile ? styles.toolbarButtonsMobile : null, stacked ? styles.toolbarButtonsStacked : null]}>
            <Pressable onPress={onOpenReport} hitSlop={mobile ? 2 : undefined} accessibilityRole="button" accessibilityLabel="Abrir relatório" style={({ pressed }) => [styles.reportButton, mobile ? styles.reportButtonMobile : compactDesktop ? styles.reportButtonCompact : null, stacked ? styles.toolbarButtonStacked : null, densePanel && !mobile ? styles.reportButtonDense : null, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>
              <GoAtletaIcon name="document" size={16} color={colors.text} />
              <Text style={[styles.reportButtonLabel, mobile || densePanel ? styles.reportButtonLabelDense : null, { color: colors.text }]}>Abrir relatório</Text>
            </Pressable>
            <Pressable
              onPress={onSave}
              disabled={!hasChanges || isSaving}
              accessibilityRole="button"
              accessibilityLabel="Salvar chamada"
              style={({ pressed }) => [
                styles.saveButton,
                mobile ? styles.saveButtonMobile : null,
                densePanel && !mobile ? styles.saveButtonDense : null,
                stacked ? styles.toolbarButtonStacked : null,
                  {
                    backgroundColor: colors.primaryBg,
                    opacity: !hasChanges || isSaving ? 0.55 : pressed ? 0.8 : 1,
                  },
              ]}
            >
              <Text style={[styles.saveButtonLabel, densePanel || mobile ? styles.saveButtonLabelDense : null, { color: colors.primaryText }]}>
                {isSaving ? "Salvando..." : "Salvar chamada"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

        <FlatList
          data={isLoading ? [] : students}
          keyExtractor={(student) => student.id}
          renderItem={renderStudentRow}
          style={[styles.studentList, mobile ? styles.studentListMobile : null, densePanel && !mobile ? styles.studentListDense : null]}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          initialNumToRender={mobile ? 8 : 10}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          ListHeaderComponent={error ? (
            <View
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.dangerBg,
                  borderColor: colors.dangerBorder,
                },
              ]}
            >
              <Text style={{ color: colors.dangerText, fontWeight: "700" }}>{error}</Text>
            </View>
          ) : null}
          ListEmptyComponent={isLoading ? (
            <View style={styles.loadingState} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={colors.primaryBg} />
              <Text style={{ color: colors.muted, fontWeight: "700" }}>Carregando chamada…</Text>
            </View>
          ) : (
            <View style={styles.loadingState}>
              <Text style={{ color: colors.muted, fontWeight: "700" }}>Nenhum aluno nesta turma.</Text>
            </View>
          )}
        />

      </View>
    </View>

      <StudentPhotoViewerModal
        visible={Boolean(photoPreviewStudent)}
        name={photoPreviewStudent?.name}
        uri={photoPreviewStudent?.photoUrl}
        onClose={() => setPhotoPreviewStudent(null)}
      />

      <ModalSheet visible={Boolean(selectedStudent)} onClose={closeStudentDetails} position="center" cardStyle={[styles.detailsModal, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.detailsHeader}>
          <View style={styles.detailsHeaderCopy}>
            <Text style={[styles.detailsTitle, { color: colors.text }]}>Dor e observações</Text>
            <Text numberOfLines={1} style={[styles.detailsStudentName, { color: colors.muted }]}>
              {selectedStudent?.name ?? "Aluno"}
            </Text>
          </View>
          <View style={styles.detailsHeaderActions}>
            {selectedStudent && onBindStudentNfc ? (
              <Pressable
                onPress={() => onBindStudentNfc(selectedStudent)}
                disabled={Boolean(nfcBindingStudentId)}
                accessibilityRole="button"
                accessibilityLabel={`Cadastrar tag NFC de ${selectedStudent.name}`}
                style={({ pressed }) => [
                  styles.detailsNfcButton,
                  {
                    backgroundColor: colors.secondaryBg,
                    borderColor: colors.border,
                    opacity: nfcBindingStudentId ? 0.55 : pressed ? 0.72 : 1,
                  },
                ]}
              >
                {nfcBindingStudentId === selectedStudent.id ? <ActivityIndicator size="small" color={colors.primaryBg} /> : <GoAtletaIcon name="nfc" size={18} color={colors.primaryBg} />}
              </Pressable>
            ) : null}
            <Pressable
              onPress={closeStudentDetails}
              accessibilityRole="button"
              accessibilityLabel="Fechar dor e observações"
              style={({ pressed }) => [
                styles.detailsCloseButton,
                {
                  backgroundColor: colors.secondaryBg,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <GoAtletaIcon name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {!selectedStudentStatus ? (
          <View
            style={[
              styles.detailsWarning,
              {
                backgroundColor: colors.secondaryBg,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.detailsWarningText, { color: colors.muted }]}>Marque presente ou faltou antes de registrar.</Text>
          </View>
        ) : null}

        <View style={styles.detailsSection}>
          <Text style={[styles.detailsLabel, { color: colors.text }]}>Dor agora</Text>
          <View style={styles.painOptions}>
            {PAIN_OPTIONS.map((option) => {
              const selected = draftPainScore === option.score;
              return (
                <Pressable
                  key={option.score}
                  onPress={() => setDraftPainScore(option.score)}
                  disabled={!selectedStudentStatus || isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={`Dor: ${option.label}`}
                  accessibilityState={{
                    selected,
                    disabled: !selectedStudentStatus || isSaving,
                  }}
                  style={({ pressed }) => [
                    styles.painButton,
                    {
                      backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                      borderColor: selected ? colors.primaryBg : colors.border,
                      opacity: !selectedStudentStatus || isSaving ? 0.55 : pressed ? 0.72 : 1,
                    },
                  ]}
                >
                  <PainFaceIcon option={option} color={selected ? colors.primaryText : colors.text} />
                  <Text style={[styles.painButtonLabel, { color: selected ? colors.primaryText : colors.text }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.detailsSection}>
          <Text style={[styles.detailsLabel, { color: colors.text }]}>Observação</Text>
          <TextInput
            value={draftNote}
            onChangeText={setDraftNote}
            placeholder="Observação (opcional)"
            placeholderTextColor={colors.muted}
            editable={Boolean(selectedStudentStatus) && !isSaving}
            multiline
            maxLength={500}
            style={[
              styles.detailsInput,
              {
                backgroundColor: colors.secondaryBg,
                borderColor: colors.border,
                color: colors.text,
                opacity: selectedStudentStatus ? 1 : 0.55,
              },
            ]}
          />
        </View>

        <Pressable
          onPress={confirmStudentDetails}
          disabled={!selectedStudentStatus || isSaving}
          accessibilityRole="button"
          accessibilityLabel="Concluir observações"
          style={({ pressed }) => [
            styles.detailsConfirmButton,
            {
              backgroundColor: colors.primaryBg,
              opacity: !selectedStudentStatus || isSaving ? 0.55 : pressed ? 0.8 : 1,
            },
          ]}
        >
          <Text style={[styles.detailsConfirmLabel, { color: colors.primaryText }]}>Concluir</Text>
        </Pressable>
      </ModalSheet>
    </>
  );
}

const styles = StyleSheet.create({
  attendanceSection: {
    width: "100%",
    gap: 12,
  },
  panel: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  panelMobile: { borderRadius: 14 },
  toolbar: {
    minHeight: 0,
    padding: 14,
    borderBottomWidth: 1,
    alignItems: "stretch",
    gap: 10,
  },
  toolbarCompact: { padding: 12, gap: 10 },
  toolbarMobile: {
    minHeight: 0,
    flexDirection: "column",
    alignItems: "stretch",
    padding: 10,
    gap: 8,
  },
  toolbarDense: { minHeight: 62, padding: 10, gap: 8 },
  toolbarActions: {
    minWidth: 0,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  toolbarActionsCompact: {
    gap: 8,
  },
  toolbarActionsMobile: {
    width: "100%",
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    justifyContent: "space-between",
    gap: 8,
  },
  toolbarActionsStacked: { flexDirection: "column", alignItems: "stretch" },
  toolbarActionsDense: { gap: 8 },
  syncSummary: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  syncSummaryStacked: { width: "100%", flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  markedLabel: { fontSize: 13, fontWeight: "600" },
  markedLabelCompact: { minWidth: 0, flex: 1, fontSize: 12 },
  markedLabelDense: { fontSize: 12, flexShrink: 0 },
  markedLabelMobile: { minWidth: 0, flex: 1, fontSize: 12 },
  markedLabelStacked: { width: "100%", flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  toolbarButtons: { flexDirection: "row", alignItems: "center", gap: 8 },
  toolbarButtonsMobile: { flexShrink: 0 },
  toolbarButtonsStacked: { width: "100%" },
  toolbarButtonStacked: { minWidth: 0, flex: 1, paddingHorizontal: 8 },
  reportButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  reportButtonCompact: {
    flexShrink: 0,
    minHeight: 40,
    paddingHorizontal: 10,
    gap: 6,
  },
  reportButtonMobile: {
    flexShrink: 0,
    minHeight: 40,
    paddingHorizontal: 10,
    gap: 6,
  },
  reportButtonDense: { minHeight: 38, paddingHorizontal: 10, gap: 5 },
  reportButtonLabel: { fontSize: 13, fontWeight: "800" },
  reportButtonLabelDense: { fontSize: 12 },
  saveButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDense: { minHeight: 38, paddingHorizontal: 12 },
  saveButtonMobile: { minHeight: 40, paddingHorizontal: 12, flexShrink: 0 },
  saveButtonLabel: { fontSize: 13, fontWeight: "800" },
  saveButtonLabelDense: { fontSize: 12 },
  errorBanner: {
    margin: 12,
    marginBottom: 0,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  loadingState: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  studentList: { maxHeight: 560 },
  studentListDense: { maxHeight: 480 },
  studentListMobile: { maxHeight: 440 },
  studentRow: {
    minHeight: 78,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  studentRowDense: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  studentRowMobile: {
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    overflow: "hidden",
  },
  studentRowStacked: {
    minHeight: 0,
    alignItems: "stretch",
    flexDirection: "column",
    paddingVertical: 8,
    gap: 6,
  },
  studentIdentity: {
    minWidth: 0,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  studentIdentityMobile: { minWidth: 0, flex: 1, gap: 8, overflow: "visible" },
  studentIdentityStacked: {
    width: "100%",
    minHeight: 36,
    flexGrow: 0,
    flexShrink: 0,
  },
  studentNameButton: {
    minWidth: 0,
    flex: 1,
    minHeight: 36,
    justifyContent: "center",
  },
  studentNameButtonLabel: { flex: 0 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarDense: { width: 34, height: 34, borderRadius: 17 },
  avatarImage: { width: "100%", height: "100%" },
  avatarLabel: { fontSize: 14, fontWeight: "900" },
  studentName: { minWidth: 0, flex: 1, fontSize: 15, fontWeight: "800" },
  studentNameMobile: { fontSize: 13, lineHeight: 17 },
  studentNameDense: { fontSize: 14 },
  rowActions: {
    width: 250,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  rowActionsMobile: {
    width: 142,
    minWidth: 0,
    flexShrink: 0,
    justifyContent: "flex-end",
  },
  rowActionsStacked: { width: "100%", alignSelf: "stretch" },
  rowActionsDense: { width: 220 },
  segmentedControl: {
    minWidth: 250,
    height: 44,
    borderWidth: 1,
    borderRadius: 11,
    overflow: "hidden",
    flexDirection: "row",
  },
  segmentedControlMobile: {
    minWidth: 0,
    width: 142,
    flex: 1,
    height: 38,
    borderRadius: 9,
  },
  segmentedControlStacked: { width: undefined, flex: 1 },
  segmentedControlDense: { minWidth: 220, height: 40, borderRadius: 10 },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentButtonDense: { minHeight: 38 },
  segmentButtonMobile: { minHeight: 36 },
  segmentDivider: { borderLeftWidth: 1 },
  segmentLabel: { fontSize: 13, fontWeight: "800" },
  segmentLabelDense: { fontSize: 12 },
  detailsModal: {
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    overflow: "visible",
  },
  detailsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailsHeaderCopy: { minWidth: 0, flex: 1, gap: 2 },
  detailsHeaderActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailsTitle: { fontSize: 17, fontWeight: "900" },
  detailsStudentName: { fontSize: 12, fontWeight: "700" },
  detailsNfcButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsWarning: { borderWidth: 1, borderRadius: 10, padding: 10 },
  detailsWarningText: { fontSize: 12, fontWeight: "700" },
  detailsSection: { gap: 6 },
  detailsLabel: { fontSize: 13, fontWeight: "800" },
  painOptions: { flexDirection: "row", gap: 6 },
  painButton: {
    flex: 1,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
  },
  painButtonLabel: { fontSize: 10, fontWeight: "800", textAlign: "center" },
  detailsInput: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    textAlignVertical: "top",
  },
  detailsConfirmButton: {
    minHeight: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsConfirmLabel: { fontSize: 13, fontWeight: "900" },
});
