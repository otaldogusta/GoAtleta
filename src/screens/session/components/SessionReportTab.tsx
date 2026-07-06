import type { ComponentProps, RefObject } from "react";
import {
  FlatList,
  Image,
  Platform,
  Text,
  TextInput,
  type TextStyle,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../../ui/AnchoredDropdownOption";
import type { ThemeColors } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon, type GoAtletaIconName } from "../../../ui/icon-registry";

type ReportTechnique = "boa" | "ok" | "ruim" | "nenhum";
type ReportPhotoSource = "camera" | "library";
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
  activity: string;
  conclusion: string;
  autoActivity: string;
  canApplyAutoActivity: boolean;
  showAppliedPreview: boolean;
  canSuggestActivity: boolean;
  canSuggestConclusion: boolean;
  isRewritingActivity: boolean;
  isRewritingConclusion: boolean;
  reportPhotoUris: string[];
  photoLimit: number;
  isPickingPhoto: boolean;
  reportHasChanges: boolean;
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
  onChangeParticipantsCount: (value: string) => void;
  onChangeActivity: (value: string) => void;
  onChangeConclusion: (value: string) => void;
  onRewriteActivity: () => void;
  onRewriteConclusion: () => void;
  onApplyAutoActivity: () => void;
  onToggleAppliedPreview: () => void;
  onPickPhoto: (source: ReportPhotoSource) => void;
  onOpenPhotoActions: (index: number) => void;
  onClosePhotoActions: () => void;
  onReplacePhoto: (source: ReportPhotoSource, index: number) => void;
  onRemovePhoto: (index: number) => void;
  onSaveReport: () => void;
  onSaveAndGenerateReport: () => void;
};

export function SessionReportTab({
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
  activity,
  conclusion,
  autoActivity,
  canApplyAutoActivity,
  showAppliedPreview,
  canSuggestActivity,
  canSuggestConclusion,
  isRewritingActivity,
  isRewritingConclusion,
  reportPhotoUris,
  photoLimit,
  isPickingPhoto,
  reportHasChanges,
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
  onChangeParticipantsCount,
  onChangeActivity,
  onChangeConclusion,
  onRewriteActivity,
  onRewriteConclusion,
  onApplyAutoActivity,
  onToggleAppliedPreview,
  onPickPhoto,
  onOpenPhotoActions,
  onClosePhotoActions,
  onReplacePhoto,
  onRemovePhoto,
  onSaveReport,
  onSaveAndGenerateReport,
}: SessionReportTabProps) {
  const photoLimitReached = reportPhotoUris.length >= photoLimit;

  return (
    <View
      ref={containerRef}
      onLayout={onContainerLayout}
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        position: "relative",
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
        {ptBR.session.report.title}
      </Text>
      <Text style={{ color: colors.muted }}>{sessionDateLabel}</Text>
      {!hasExistingReport ? (
        <Text style={{ color: colors.muted }}>{ptBR.session.report.noReportYet}</Text>
      ) : null}
      {hasExistingReport ? (
        <View
          style={{
            alignSelf: "flex-start",
            paddingVertical: 4,
            paddingHorizontal: 8,
            borderRadius: 10,
            backgroundColor: colors.successBg,
            marginTop: 4,
          }}
        >
          <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "700" }}>
            {ptBR.session.report.editingExisting}
          </Text>
        </View>
      ) : null}

      <View style={{ gap: 12, marginTop: 12 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {ptBR.session.report.pse}
            </Text>
            <View ref={pseTriggerRef}>
              <Pressable
                onPress={onTogglePsePicker}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                  {String(pse)}
                </Text>
                <ReportIcon
                  name="down"
                  size={16}
                  color={colors.muted}
                  style={{ transform: [{ rotate: showPsePicker ? "180deg" : "0deg" }] }}
                />
              </Pressable>
            </View>
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {ptBR.session.report.technique}
            </Text>
            <View ref={techniqueTriggerRef}>
              <Pressable
                onPress={onToggleTechniquePicker}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                  {technique}
                </Text>
                <ReportIcon
                  name="down"
                  size={16}
                  color={colors.muted}
                  style={{
                    transform: [{ rotate: showTechniquePicker ? "180deg" : "0deg" }],
                  }}
                />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {ptBR.session.report.participants}
            </Text>
            <TextInput
              placeholder={ptBR.session.report.participantsPlaceholder}
              value={participantsCount}
              onChangeText={onChangeParticipantsCount}
              keyboardType="numeric"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
          </View>

          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {ptBR.session.report.activity}
            </Text>
            <View style={{ position: "relative" }}>
              <TextInput
                placeholder={ptBR.session.report.activityPlaceholder}
                value={activity}
                onChangeText={onChangeActivity}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  paddingRight: 52,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              {canSuggestActivity || isRewritingActivity ? (
                <Pressable
                  onPress={onRewriteActivity}
                  disabled={isRewritingActivity}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    marginTop: -15,
                    borderRadius: 999,
                    width: 30,
                    height: 30,
                    backgroundColor: colors.primaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: isRewritingActivity ? 0.65 : 1,
                  }}
                >
                  <ReportIcon
                    name={isRewritingActivity ? "loading" : "sparkle"}
                    size={14}
                    color={colors.primaryText}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {autoActivity ? (
          <View
            style={{
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 6,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
                  {ptBR.session.report.previewAppliedTraining}
                </Text>
                <Pressable
                  onPress={onApplyAutoActivity}
                  disabled={!canApplyAutoActivity}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: canApplyAutoActivity
                      ? colors.primaryBg
                      : colors.secondaryBg,
                    opacity: canApplyAutoActivity ? 1 : 0.6,
                  }}
                >
                  <Text
                    style={{
                      color: canApplyAutoActivity ? colors.primaryText : colors.muted,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    Aplicar
                  </Text>
                </Pressable>
              </View>
              <Pressable onPress={onToggleAppliedPreview}>
                <ReportIcon
                  name="down"
                  size={16}
                  color={colors.muted}
                  style={{
                    transform: [{ rotate: showAppliedPreview ? "180deg" : "0deg" }],
                  }}
                />
              </Pressable>
            </View>
            {showAppliedPreview ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>{autoActivity}</Text>
            ) : null}
            {!canApplyAutoActivity ? (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {ptBR.session.report.clearToApplyHint}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            {ptBR.session.report.conclusion}
          </Text>
          <View style={{ position: "relative" }}>
            <TextInput
              placeholder={ptBR.session.report.conclusionPlaceholder}
              value={conclusion}
              onChangeText={onChangeConclusion}
              placeholderTextColor={colors.placeholder}
              multiline
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                paddingRight: 52,
                borderRadius: 12,
                minHeight: 90,
                textAlignVertical: "top",
                backgroundColor: colors.inputBg,
                color: colors.inputText,
              }}
            />
            {canSuggestConclusion || isRewritingConclusion ? (
              <Pressable
                onPress={onRewriteConclusion}
                disabled={isRewritingConclusion}
                style={{
                  position: "absolute",
                  right: 8,
                  top: 8,
                  borderRadius: 999,
                  width: 30,
                  height: 30,
                  backgroundColor: colors.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: isRewritingConclusion ? 0.65 : 1,
                }}
              >
                <ReportIcon
                  name={isRewritingConclusion ? "loading" : "sparkle"}
                  size={14}
                  color={colors.primaryText}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            {ptBR.session.report.photos}
          </Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              padding: 10,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => onPickPhoto("camera")}
                disabled={isPickingPhoto || photoLimitReached}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingVertical: 9,
                  alignItems: "center",
                  opacity: isPickingPhoto || photoLimitReached ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  {isPickingPhoto ? ptBR.session.actions.opening : ptBR.session.actions.takePhoto}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onPickPhoto("library")}
                disabled={isPickingPhoto || photoLimitReached}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingVertical: 9,
                  alignItems: "center",
                  opacity: isPickingPhoto || photoLimitReached ? 0.6 : 1,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  {ptBR.session.actions.gallery}
                </Text>
              </Pressable>
            </View>

            {reportPhotoUris.length ? (
              <FlatList
                data={reportPhotoUris}
                keyExtractor={(uri, index) => `${uri}_${index}`}
                numColumns={Platform.OS === "web" ? 4 : 3}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 8 }}
                columnWrapperStyle={{ gap: 8 }}
                renderItem={({ item: uri, index }) => (
                  <Pressable
                    onPress={() => onOpenPhotoActions(index)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: Platform.OS === "web" ? 112 : undefined,
                      aspectRatio: Platform.OS === "web" ? undefined : 1,
                      borderRadius: 10,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border,
                      position: "relative",
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Image
                      source={{ uri }}
                      resizeMode="cover"
                      style={{ width: "100%", height: "100%" }}
                    />
                    <View
                      style={{
                        position: "absolute",
                        right: 6,
                        bottom: 6,
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        backgroundColor: "rgba(0,0,0,0.72)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ReportIcon name="edit" size={12} color={colors.primaryText} />
                    </View>
                  </Pressable>
                )}
              />
            ) : null}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Button
            label={
              hasExistingReport
                ? ptBR.session.actions.saveChanges
                : ptBR.session.actions.save
            }
            variant="secondary"
            onPress={onSaveReport}
            disabled={!reportHasChanges}
          />
          <Button
            label={ptBR.session.actions.generateReport}
            onPress={onSaveAndGenerateReport}
          />
        </View>
      </View>

      <AnchoredDropdown
        visible={showPsePickerContent}
        layout={pseTriggerLayout}
        container={containerWindow}
        animationStyle={psePickerAnimationStyle}
        zIndex={420}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={onClosePickers}
        scrollContentStyle={{ padding: 8, gap: 6 }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
          <AnchoredDropdownOption
            key={value}
            active={pse === value}
            onPress={() => onSelectPse(value)}
          >
            <Text
              style={{
                color: pse === value ? colors.primaryText : colors.text,
                fontSize: 14,
                fontWeight: pse === value ? "700" : "500",
              }}
            >
              {value}
            </Text>
          </AnchoredDropdownOption>
        ))}
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={showTechniquePickerContent}
        layout={techniqueTriggerLayout}
        container={containerWindow}
        animationStyle={techniquePickerAnimationStyle}
        zIndex={420}
        maxHeight={160}
        nestedScrollEnabled
        onRequestClose={onClosePickers}
        scrollContentStyle={{ padding: 8, gap: 6 }}
      >
        {(["nenhum", "boa", "ok", "ruim"] as const).map((value) => (
          <AnchoredDropdownOption
            key={value}
            active={technique === value}
            onPress={() => onSelectTechnique(value)}
          >
            <Text
              style={{
                color: technique === value ? colors.primaryText : colors.text,
                fontSize: 14,
                fontWeight: technique === value ? "700" : "500",
                textTransform: "capitalize",
              }}
            >
              {value}
            </Text>
          </AnchoredDropdownOption>
        ))}
      </AnchoredDropdown>

      <ModalSheet
        visible={photoActionIndex !== null}
        onClose={onClosePhotoActions}
        position="center"
        overlayZIndex={30000}
        backdropOpacity={0.7}
        cardStyle={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 18,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 10,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {ptBR.session.report.photoActionTitle}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>
          {ptBR.session.report.photoActionSubtitle}
        </Text>
        <View style={{ gap: 8, marginTop: 6 }}>
          <Pressable
            onPress={() => {
              if (photoActionIndex === null) return;
              onReplacePhoto("camera", photoActionIndex);
            }}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {ptBR.session.actions.replaceCamera}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (photoActionIndex === null) return;
              onReplacePhoto("library", photoActionIndex);
            }}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {ptBR.session.actions.replaceGallery}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (photoActionIndex === null) return;
              onRemovePhoto(photoActionIndex);
            }}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.dangerBorder,
              backgroundColor: colors.dangerBg,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>
              {ptBR.session.actions.remove}
            </Text>
          </Pressable>
          <Pressable
            onPress={onClosePhotoActions}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {ptBR.session.actions.cancel}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
    </View>
  );
}
