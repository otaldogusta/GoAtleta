import type { Signal as CopilotSignal } from "../ai/signal-engine";
import type { RegulationRuleSet } from "../api/regulation-rule-sets";
import type { RegulationUpdate } from "../api/regulation-updates";

export type { CopilotSignal };

export type CopilotContextData = {
  screen: string;
  title?: string;
  subtitle?: string;
  activeSignal?: CopilotSignal;
};

export type CopilotActionResult = {
  message: string;
  citationsCount?: number;
  confidence?: number;
};

export type CopilotAction = {
  id: string;
  title: string;
  description?: string;
  requires?: (ctx: CopilotContextData | null) => string | null;
  run: (ctx: CopilotContextData | null) => Promise<CopilotActionResult | string | void> | CopilotActionResult | string | void;
};

export type CopilotHistoryItem = {
  id: string;
  actionTitle: string;
  message: string;
  createdAt: string;
  status: "success" | "error";
  citationsCount?: number;
  confidence?: number;
};

export type InsightsCategory =
  | "reports"
  | "absences"
  | "nfc"
  | "attendance"
  | "engagement"
  | "regulation";

export type SignalInsightsCategory = Exclude<InsightsCategory, "regulation">;

export type InsightsView =
  | { mode: "root" }
  | { mode: "category"; category: InsightsCategory }
  | { mode: "detail"; category: InsightsCategory; itemId: string };

export type CopilotState = {
  context: CopilotContextData | null;
  actions: CopilotAction[];
  signals: CopilotSignal[];
  regulationUpdates: RegulationUpdate[];
  regulationRuleSets: RegulationRuleSet[];
  selectedSignalId: string | null;
  open: boolean;
  runningActionId: string | null;
  history: CopilotHistoryItem[];
  hasUnreadUpdates: boolean;
  unreadCount: number;
};

export type RegistryStatePatch = Pick<
  CopilotState,
  "context" | "actions" | "signals" | "selectedSignalId"
>;
