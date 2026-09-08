import { CopilotScreenChat } from "./CopilotScreenChat";
import { AssistantModelSelector } from "../../assistant/components/AssistantModelSelector";
import type { AssistantModelChoice } from "../../assistant/model-choice";
import { memo, useState } from "react";
import {
    Text,
    View,
} from "react-native";

import type { Signal as CopilotSignal } from "../../ai/signal-engine";
import type { RegulationUpdate } from "../../api/regulation-updates";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import type { OperationalContextResult } from "../operational-context";
import type { CopilotAction, InsightsCategory, InsightsView } from "../types";
import { CopilotLessonChat } from "./CopilotLessonChat";
import type { CopilotLessonScope } from "../lesson-context";


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
  lesson?: CopilotLessonScope | null;
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
  lesson,
  visible,
  isWebModal,
  viewportWidth,
  viewportHeight,
  sheetMaxWidth,
  sheetMaxHeight,
  sheetMinHeight,
  sheetContentBottomPadding,
  colors,
  operationalContext,
  close,
}: CopilotModalProps) {
  const [modelPreference, setModelPreference] = useState<AssistantModelChoice>("auto");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
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
        {<View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <AssistantModelSelector value={modelPreference} onChange={setModelPreference} disabled={chatBusy} />
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>{lesson ? `${lesson.className} · ${lesson.date.split("-").reverse().join("/")}` : operationalContext.snapshot.contextTitle ?? "Go"}</Text>
        </View>}
        <Pressable
          accessibilityLabel="Histórico do assistente"
          accessibilityRole="button"
          disabled={chatBusy}
          onPress={() => setHistoryOpen(value => !value)}
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
          <GoAtletaIcon name="time" size={18} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityLabel="Fechar chat"
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
          <GoAtletaIcon name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      {lesson ? <CopilotLessonChat historyOpen={historyOpen} onCloseHistory={() => setHistoryOpen(false)} {...lesson} appSnapshot={operationalContext.snapshot} modelPreference={modelPreference} onBusyChange={setChatBusy} /> :
        <CopilotScreenChat historyOpen={historyOpen} onCloseHistory={() => setHistoryOpen(false)} onClose={close} snapshot={operationalContext.snapshot} modelPreference={modelPreference} onBusyChange={setChatBusy} />}
    </ModalSheet>
  );
});
