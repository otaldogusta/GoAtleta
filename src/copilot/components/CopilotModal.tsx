import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import {
    Animated,
    Platform,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";

import type { Signal as CopilotSignal } from "../../ai/signal-engine";
import type { RegulationUpdate } from "../../api/regulation-updates";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import type { OperationalContextResult } from "../operational-context";
import type { CopilotAction, InsightsCategory, InsightsView } from "../types";
import { CopilotCategoryView } from "./CopilotCategoryView";
import { CopilotRegulationDetailView } from "./CopilotRegulationDetailView";
import { CopilotRootView } from "./CopilotRootView";
import { CopilotSignalDetailView } from "./CopilotSignalDetailView";

const CONTEXT_COMPOSER_MIN_HEIGHT = 40;
const CONTEXT_COMPOSER_MAX_HEIGHT = 120;
const CONTEXT_COMPOSER_MAX_HEIGHT_WEB = 84;

type SignalInsightsCategory = Exclude<InsightsCategory, "regulation">;

type Colors = {
  border: string;
  background: string;
  secondaryBg: string;
  text: string;
  muted: string;
  primaryBg: string;
  primaryText: string;
  card: string;
  inputBg: string;
  dangerText: string;
  warningText: string;
};

type CopilotModalProps = {
  visible: boolean;
  isWebModal: boolean;
  viewportWidth: number;
  viewportHeight: number;
  sheetMaxWidth: number | undefined;
  sheetMaxHeight: number;
  sheetMinHeight: number;
  sheetContentBottomPadding: number;
  colors: Colors;
  insightsView: InsightsView;
  setInsightsView: (view: InsightsView) => void;
  operationalContext: OperationalContextResult;
  state: {
    open: boolean;
    actions: CopilotAction[];
    signals: CopilotSignal[];
    regulationUpdates: RegulationUpdate[];
    runningActionId: string | null;
    hasUnreadUpdates: boolean;
    unreadCount: number;
  };
  signalsByCategory: Record<SignalInsightsCategory, CopilotSignal[]>;
  hasRegulationDetails: boolean;
  latestRegulationSourceUrl: string;
  detailRegulationUpdate: RegulationUpdate | null;
  activeDrawerSignal: CopilotSignal | null;
  activeCategoryLabel: string | null;
  selectedSeverityColor: string;
  selectedSeverityLabel: string;
  recommendedActionIds: Set<string>;
  orderedActions: CopilotAction[];
  recommendedActions: CopilotAction[];
  rootQuickActions: CopilotAction[];
  canExpandRootActions: boolean;
  showAllRootActions: boolean;
  setShowAllRootActions: (value: boolean) => void;
  assistantTyping: boolean;
  thinkingPulse: any;
  contextPreview: { actionTitle: string; message: string } | null;
  composerValue: string;
  setComposerValue: (value: string) => void;
  composerInputHeight: number;
  setComposerInputHeight: (value: number) => void;
  nowMs: number;
  setActiveSignal: (signalId: string | null) => void;
  runAction: (action: CopilotAction) => Promise<void>;
  close: () => void;
  onNavigateToHistory: () => void;
  onNavigateToAssistant: () => void;
  onNavigateToRegulationHistory: () => void;
  onNavigateToImpactAction: (route: string) => void;
  submitComposer: () => void;
  handleComposerKeyPress: (event: any) => void;
};

export const CopilotModal = memo(function CopilotModal({
  visible,
  isWebModal,
  viewportWidth,
  viewportHeight,
  sheetMaxWidth,
  sheetMaxHeight,
  sheetMinHeight,
  sheetContentBottomPadding,
  colors,
  insightsView,
  setInsightsView,
  operationalContext,
  state,
  signalsByCategory,
  hasRegulationDetails,
  latestRegulationSourceUrl,
  detailRegulationUpdate,
  activeDrawerSignal,
  activeCategoryLabel,
  selectedSeverityColor,
  selectedSeverityLabel,
  recommendedActionIds,
  orderedActions,
  recommendedActions,
  rootQuickActions,
  canExpandRootActions,
  showAllRootActions,
  setShowAllRootActions,
  assistantTyping,
  thinkingPulse,
  contextPreview,
  composerValue,
  setComposerValue,
  composerInputHeight,
  setComposerInputHeight,
  nowMs,
  setActiveSignal,
  runAction,
  close,
  onNavigateToHistory,
  onNavigateToAssistant,
  onNavigateToRegulationHistory,
  onNavigateToImpactAction,
  submitComposer,
  handleComposerKeyPress,
}: CopilotModalProps) {
  if (!visible) return null;
  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      backdropOpacity={0.5}
      position={isWebModal ? "center" : "bottom"}
      overlayZIndex={5000}
      slideOffset={isWebModal ? 10 : 24}
      cardStyle={{
        width: isWebModal ? "94%" : "100%",
        maxWidth: isWebModal ? Math.max(420, Math.min(viewportWidth - 42, 860)) : sheetMaxWidth,
        alignSelf: "center",
        maxHeight: isWebModal ? Math.min(viewportHeight - 36, 820) : sheetMaxHeight,
        minHeight: isWebModal ? Math.min(Math.max(560, viewportHeight * 0.75), viewportHeight - 48) : sheetMinHeight,
        marginBottom: isWebModal ? 0 : 0,
        borderBottomLeftRadius: isWebModal ? 28 : 0,
        borderBottomRightRadius: isWebModal ? 28 : 0,
        borderTopLeftRadius: isWebModal ? 28 : 20,
        borderTopRightRadius: isWebModal ? 28 : 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        overflow: "hidden",
        paddingTop: 12,
        paddingHorizontal: 14,
        paddingBottom: sheetContentBottomPadding,
        gap: 10,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Pressable
          onPress={onNavigateToHistory}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="time-outline" size={18} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={close}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            width: 36,
            height: 36,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator
        contentContainerStyle={{ gap: 10, paddingBottom: 6, paddingHorizontal: 2 }}
      >
        {insightsView.mode !== "root" ? (
          <Pressable
            onPress={() => {
              if (insightsView.mode === "detail") {
                setInsightsView({ mode: "category", category: insightsView.category });
                return;
              }
              setInsightsView({ mode: "root" });
            }}
            style={{
              alignSelf: "flex-start",
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        ) : null}

        <CopilotRootView
          isWebModal={isWebModal}
          colors={colors}
          insightsView={insightsView}
          setInsightsView={setInsightsView}
          operationalContext={operationalContext}
          state={state}
          hasRegulationDetails={hasRegulationDetails}
          latestRegulationSourceUrl={latestRegulationSourceUrl}
          rootQuickActions={rootQuickActions}
          canExpandRootActions={canExpandRootActions}
          setShowAllRootActions={setShowAllRootActions}
          nowMs={nowMs}
          setActiveSignal={setActiveSignal}
          runAction={runAction}
          onNavigateToRegulationHistory={onNavigateToRegulationHistory}
        />

        <CopilotCategoryView
          colors={colors}
          insightsView={insightsView}
          setInsightsView={setInsightsView}
          state={state}
          signalsByCategory={signalsByCategory}
          setActiveSignal={setActiveSignal}
        />

        <CopilotRegulationDetailView
          colors={colors}
          insightsView={insightsView}
          detailRegulationUpdate={detailRegulationUpdate}
          onNavigateToImpactAction={onNavigateToImpactAction}
        />

        <CopilotSignalDetailView
          colors={colors}
          insightsView={insightsView}
          activeDrawerSignal={activeDrawerSignal}
          activeCategoryLabel={activeCategoryLabel}
          selectedSeverityColor={selectedSeverityColor}
          selectedSeverityLabel={selectedSeverityLabel}
          recommendedActionIds={recommendedActionIds}
          orderedActions={orderedActions}
          recommendedActions={recommendedActions}
          state={state}
          runAction={runAction}
        />
      </ScrollView>

      {assistantTyping ? (
        <View
          style={{
            alignSelf: "flex-start",
            maxWidth: "58%",
            paddingHorizontal: 12,
            paddingVertical: 11,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {[0, 1, 2].map((index) => {
              const phase = index * 0.2;
              const opacity = thinkingPulse.interpolate({
                inputRange: [0, phase, phase + 0.2, 1],
                outputRange: [0.3, 0.45, 1, 0.35],
                extrapolate: "clamp",
              });
              const translateY = thinkingPulse.interpolate({
                inputRange: [0, phase, phase + 0.2, 1],
                outputRange: [0, 0, -3, 0],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={`context-thinking-dot-${index}`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.muted,
                    opacity,
                    transform: [{ translateY }],
                  }}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      {!assistantTyping && contextPreview ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginBottom: 8,
            gap: 4,
          }}
        >
          {contextPreview.actionTitle ? (
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
              {contextPreview.actionTitle}
            </Text>
          ) : null}
          <Text style={{ color: colors.text, fontSize: 13 }}>{contextPreview.message}</Text>
        </View>
      ) : null}

      <View
        style={{
          borderRadius: 28,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: 10,
          paddingVertical: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <Pressable
            onPress={onNavigateToAssistant}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
          <TextInput
            value={composerValue}
            onChangeText={(value) => {
              setComposerValue(value);
              if (!value.trim() && composerInputHeight !== CONTEXT_COMPOSER_MIN_HEIGHT) {
                setComposerInputHeight(CONTEXT_COMPOSER_MIN_HEIGHT);
              }
            }}
            placeholder="Pergunte sobre este contexto..."
            placeholderTextColor={colors.muted}
            returnKeyType="send"
            onSubmitEditing={submitComposer}
            onKeyPress={handleComposerKeyPress}
            onContentSizeChange={(event) => {
              if (!composerValue.trim()) {
                if (composerInputHeight !== CONTEXT_COMPOSER_MIN_HEIGHT) {
                  setComposerInputHeight(CONTEXT_COMPOSER_MIN_HEIGHT);
                }
                return;
              }
              const maxHeight =
                Platform.OS === "web" ? CONTEXT_COMPOSER_MAX_HEIGHT_WEB : CONTEXT_COMPOSER_MAX_HEIGHT;
              const next = Math.max(
                CONTEXT_COMPOSER_MIN_HEIGHT,
                Math.min(maxHeight, Math.ceil(event.nativeEvent.contentSize.height))
              );
              if (next !== composerInputHeight) {
                setComposerInputHeight(next);
              }
            }}
            multiline
            scrollEnabled={
              composerInputHeight >=
              (Platform.OS === "web" ? CONTEXT_COMPOSER_MAX_HEIGHT_WEB : CONTEXT_COMPOSER_MAX_HEIGHT)
            }
            style={{
              flex: 1,
              minHeight: CONTEXT_COMPOSER_MIN_HEIGHT,
              height: composerInputHeight,
              color: colors.text,
              paddingHorizontal: 2,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: 16,
              textAlignVertical: "top",
              ...(Platform.OS === "web"
                ? ({
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                  } as const)
                : null),
            }}
          />
          <Pressable
            onPress={submitComposer}
            disabled={!composerValue.trim()}
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
              justifyContent: "center",
              opacity: composerValue.trim() ? 1 : 0.55,
            }}
          >
            <Ionicons name="arrow-up" size={20} color={colors.primaryText} />
          </Pressable>
        </View>
      </View>
    </ModalSheet>
  );
});
