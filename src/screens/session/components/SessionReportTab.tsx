import { useState, type RefObject } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import type { ThemeColors } from "../../../ui/app-theme";
import { radius, spacing } from "../../../theme/tokens";
import { ReportPhotoGallery } from "./ReportPhotoGallery";
import { SessionReportActions } from "./SessionReportActions";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";

type ReportTechnique = "boa" | "ok" | "ruim" | "nenhum";
type ReportPhotoSource = "camera" | "library";
type ReportFieldFocus = "activity" | "conclusion";
type DropdownLayout = { x: number; y: number; width: number; height: number };
type ContainerPoint = { x: number; y: number };

type ReportIconName = "down" | "sparkle" | "loading" | "edit";

const reportIconNames: Record<ReportIconName, GoAtletaIconName> = {
  down: "chevronDown",
  sparkle: "assistant",
  loading: "ellipsisHorizontal",
  edit: "edit",
};

const ReportIcon = ({
  name,
  color,
  size = 16,
  style,
}: {
  name: ReportIconName;
  color: string;
  size?: number;
  style?: TextStyle;
}) => <GoAtletaIcon name={reportIconNames[name]} size={size} color={color} style={style} />;

type SessionReportTabProps = {
  embedded?: boolean;
  compactFields?: boolean;
  inputBackground?: string;
  colors: ThemeColors;
  containerRef: RefObject<View | null>;
  pseTriggerRef: RefObject<View | null>;
  techniqueTriggerRef: RefObject<View | null>;
  onContainerLayout: () => void;
  sessionDateLabel: string;
  hasExistingReport: boolean;
  pse: number;
  technique: ReportTechnique;
  participantsCount: string;
  participantsCountFromAttendance?: boolean;
  activity: string;
  conclusion: string;
  canSuggestActivity: boolean;
  canSuggestConclusion: boolean;
  isRewritingActivity: boolean;
  isRewritingConclusion: boolean;
  reportPhotoUris: string[];
  photoLimit: number;
  isPickingPhoto: boolean;
  reportHasChanges: boolean;
  pendingAction?: "save" | "pdf" | null;
  reportDraftStatus: "loading" | "idle" | "saving" | "saved" | "restored";
  showPsePicker: boolean;
  showTechniquePicker: boolean;
  showPsePickerContent: boolean;
  showTechniquePickerContent: boolean;
  pseTriggerLayout: DropdownLayout | null;
  techniqueTriggerLayout: DropdownLayout | null;
  containerWindow: ContainerPoint | null;
  psePickerAnimationStyle: StyleProp<ViewStyle>;
  techniquePickerAnimationStyle: StyleProp<ViewStyle>;
  photoActionIndex: number | null;
  onTogglePsePicker: () => void;
  onToggleTechniquePicker: () => void;
  onClosePickers: () => void;
  onSelectPse: (value: number) => void;
  onSelectTechnique: (value: ReportTechnique) => void;
  onChangeActivity: (value: string) => void;
  onChangeConclusion: (value: string) => void;
  onFieldFocus?: (nativeTarget: number, field: ReportFieldFocus) => void;
  onRewriteActivity: () => void;
  onRewriteConclusion: () => void;
  onPickPhoto: (source: ReportPhotoSource) => void;
  onOpenPhotoActions: (index: number) => void;
  onClosePhotoActions: () => void;
  onReplacePhoto: (source: ReportPhotoSource, index: number) => void;
  onRemovePhoto: (index: number) => void;
  onSaveReport: () => void;
  onSaveAndGenerateReport: () => void;
};

export function SessionReportTab({
  embedded = false,
  compactFields = false,
  inputBackground,
  colors,
  containerRef,
  pseTriggerRef,
  techniqueTriggerRef,
  onContainerLayout,
  sessionDateLabel,
  hasExistingReport,
  pse,
  technique,
  participantsCount,
  participantsCountFromAttendance = false,
  activity,
  conclusion,
  canSuggestActivity,
  canSuggestConclusion,
  isRewritingActivity,
  isRewritingConclusion,
  reportPhotoUris,
  photoLimit,
  isPickingPhoto,
  reportHasChanges,
  pendingAction = null,
  reportDraftStatus,
  showPsePicker,
  showTechniquePicker,
  showPsePickerContent,
  showTechniquePickerContent,
  pseTriggerLayout,
  techniqueTriggerLayout,
  containerWindow,
  psePickerAnimationStyle,
  techniquePickerAnimationStyle,
  photoActionIndex,
  onTogglePsePicker,
  onToggleTechniquePicker,
  onClosePickers,
  onSelectPse,
  onSelectTechnique,
  onChangeActivity,
  onChangeConclusion,
  onFieldFocus,
  onRewriteActivity,
  onRewriteConclusion,
  onPickPhoto,
  onOpenPhotoActions,
  onClosePhotoActions,
  onReplacePhoto,
  onRemovePhoto,
  onSaveReport,
  onSaveAndGenerateReport,
}: SessionReportTabProps) {
  const techniqueLabels = { nenhum: "Não avaliar", ruim: "Ruim", ok: "OK", boa: "Boa" };
  const fieldBackground = inputBackground ?? colors.inputBg;
  const inputText = [styles.inputText, { color: colors.inputText }];
  const sectionBorder = { borderTopColor: colors.border };
  const label = [styles.label, { color: colors.text }];
  const rewriteAction = (field: "activity" | "conclusion") => {
    const busy = field === "activity" ? isRewritingActivity : isRewritingConclusion;
    const enabled = field === "activity" ? canSuggestActivity : canSuggestConclusion;
    if (!enabled && !busy) return null;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Revisar texto: ${field === "activity" ? "atividade realizada" : "como foi a aula"}`}
        disabled={busy} onPress={field === "activity" ? onRewriteActivity : onRewriteConclusion}
        suppressWebHoverFeedback style={[styles.textAction, { opacity: busy ? 0.55 : 1 }]}>
        <ReportIcon name={busy ? "loading" : "sparkle"} size={14} color={colors.muted} />
        <Text style={{ color: colors.muted, fontSize: 12 }}>{busy ? "Revisando…" : "Revisar texto"}</Text>
      </Pressable>
    );
  };

  return (
    <View ref={containerRef} onLayout={onContainerLayout}
      style={[styles.container, !embedded && { padding: spacing.md, borderRadius: radius.container, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
      {!embedded ? <View style={{ gap: spacing.xs }}><Text style={[styles.sectionTitle, { color: colors.text }]}>{ptBR.session.report.title}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{sessionDateLabel}</Text></View> : null}

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <View style={styles.inline}><GoAtletaIcon name="edit" size={16} color={colors.muted} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Como foi a aula?</Text></View>
          {rewriteAction("conclusion")}
        </View>
        <ReportInput colors={colors} backgroundColor={fieldBackground} accessibilityLabel="Como foi a aula?" placeholder="O que funcionou? O que retomar na próxima aula?"
            value={conclusion} onChangeText={onChangeConclusion} onFocus={event => onFieldFocus?.(event.nativeEvent.target, "conclusion")}
            placeholderTextColor={colors.placeholder} multiline style={[inputText, { minHeight: 102 }]} />
      </View>

      <View style={styles.field}>
        <View style={styles.labelRow}>
          <View style={styles.inline}><GoAtletaIcon name="document" size={16} color={colors.muted} /><Text style={label}>Atividade realizada</Text></View>
          {rewriteAction("activity")}
        </View>
        <ReportInput colors={colors} backgroundColor={fieldBackground} accessibilityLabel="Atividade realizada" placeholder="O que a turma praticou?"
            value={activity} onChangeText={onChangeActivity} onFocus={event => onFieldFocus?.(event.nativeEvent.target, "activity")}
            placeholderTextColor={colors.placeholder} multiline style={[inputText, { minHeight: 60 }]} />
      </View>

      <View style={[styles.section, sectionBorder]}>
        <View style={[styles.labelRow, { flexWrap: "wrap" }]}>
          <View style={styles.inline}><GoAtletaIcon name="options" size={16} color={colors.muted} /><Text style={[styles.sectionTitle, { color: colors.text }]}>Avaliação da turma</Text></View>
          {participantsCountFromAttendance ? <View style={styles.inline} accessibilityLabel={`Preenchido pela chamada: ${participantsCount} presentes`}><GoAtletaIcon name="students" size={14} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 12 }}>{participantsCount} {Number(participantsCount) === 1 ? "presente" : "presentes"}</Text></View> : null}
        </View>
        <View style={[styles.evaluation, compactFields && { flexDirection: "column" }]}>
          <View style={styles.evaluationField}>
            <Text style={label}>Esforço · PSE</Text>
            <View ref={pseTriggerRef}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Esforço percebido: ${pse} de 10`} accessibilityState={{ expanded: showPsePicker }} onPress={onTogglePsePicker}
                style={[styles.select, { backgroundColor: fieldBackground, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 14 }}>{pse} / 10</Text><ReportIcon name="down" color={colors.muted} style={{ transform: [{ rotate: showPsePicker ? "180deg" : "0deg" }] }} />
              </Pressable>
            </View>
          </View>
          <View style={styles.evaluationField}>
            <Text style={label}>Técnica geral</Text>
            <View ref={techniqueTriggerRef}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Técnica geral: ${techniqueLabels[technique]}`} accessibilityState={{ expanded: showTechniquePicker }} onPress={onToggleTechniquePicker}
                style={[styles.select, { backgroundColor: fieldBackground, borderColor: colors.border }]}>
                <Text style={{ color: colors.text, fontSize: 14 }}>{techniqueLabels[technique]}</Text><ReportIcon name="down" color={colors.muted} style={{ transform: [{ rotate: showTechniquePicker ? "180deg" : "0deg" }] }} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.section, sectionBorder]}>
        <ReportPhotoGallery colors={colors} compact={compactFields} uris={reportPhotoUris} limit={photoLimit} busy={isPickingPhoto}
          selectedIndex={photoActionIndex} onOpen={onOpenPhotoActions} onClose={onClosePhotoActions}
          onAdd={onPickPhoto} onReplace={onReplacePhoto} onRemove={onRemovePhoto} />
      </View>

      {!embedded ? <SessionReportActions colors={colors} compact={compactFields} hasExistingReport={hasExistingReport} dirty={reportHasChanges} draftStatus={reportDraftStatus} pendingAction={pendingAction} onSave={onSaveReport} onExport={onSaveAndGenerateReport} /> : null}

      <AnchoredDropdown visible={showPsePickerContent} layout={pseTriggerLayout} container={containerWindow} animationStyle={psePickerAnimationStyle}
        zIndex={420} density="menu" fitContent maxHeight={280} nestedScrollEnabled onRequestClose={onClosePickers} scrollContentStyle={{ padding: spacing.xs, gap: spacing.xs }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(value => <AnchoredDropdownOption key={value} active={pse === value} onPress={() => onSelectPse(value)}><Text style={{ color: pse === value ? colors.primaryText : colors.text, fontSize: 14 }}>{value} / 10</Text></AnchoredDropdownOption>)}
      </AnchoredDropdown>
      <AnchoredDropdown visible={showTechniquePickerContent} layout={techniqueTriggerLayout} container={containerWindow} animationStyle={techniquePickerAnimationStyle}
        zIndex={420} density="menu" fitContent maxHeight={280} nestedScrollEnabled onRequestClose={onClosePickers} scrollContentStyle={{ padding: spacing.xs, gap: spacing.xs }}>
        {(["nenhum", "ruim", "ok", "boa"] as const).map(value => <AnchoredDropdownOption key={value} active={technique === value} onPress={() => onSelectTechnique(value)}><Text style={{ color: technique === value ? colors.primaryText : colors.text, fontSize: 14 }}>{techniqueLabels[value]}</Text></AnchoredDropdownOption>)}
      </AnchoredDropdown>
    </View>
  );
}

function ReportInput({ colors, backgroundColor, onFocus, onBlur, ...props }: TextInputProps & { colors: ThemeColors; backgroundColor: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.inputContainer, { backgroundColor, borderColor: focused ? colors.text : colors.border }]}>
      <TextInput {...props} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", gap: spacing.xl },
  field: { gap: spacing.xs },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  labelRow: { minHeight: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  label: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", lineHeight: 24 },
  inputContainer: { minHeight: 50, paddingHorizontal: 14, paddingVertical: spacing.sm, borderWidth: 1, borderRadius: radius.internal },
  inputText: { padding: 0, borderRadius: 0, fontSize: 14, lineHeight: 23, textAlignVertical: "top" },
  textAction: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 40, paddingHorizontal: spacing.xs },
  section: { borderTopWidth: 1, paddingTop: spacing.lg, gap: spacing.md },
  evaluation: { flexDirection: "row", gap: spacing.md },
  evaluationField: { flex: 1, minWidth: 0, gap: spacing.xs },
  select: { minHeight: 50, borderWidth: 1, borderRadius: radius.internal, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
