export type SessionTabId = "treino" | "relatório";

export type SessionBlockKey = "warmup" | "main" | "cooldown";

export type SessionTabItem = {
  id: SessionTabId;
  label: string;
};

export type SessionTrainingBlockPreview = {
  key: SessionBlockKey;
  label: string;
  previewItems: string[];
  updated: boolean;
};

export type SessionSavedPlanPreview = {
  id: string;
  title: string;
  meta: string;
  preview: string;
  applicationLabel: string;
  isApplying: boolean;
};
