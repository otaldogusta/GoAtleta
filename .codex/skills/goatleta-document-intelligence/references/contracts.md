# Contratos canônicos

Usar estes nomes e responsabilidades como fronteiras estáveis. Implementar os tipos no módulo de domínio compartilhado do runtime, não dentro de componentes ou prompts.

```ts
type DocumentSourceRecord = {
  id: string;
  organizationId: string;
  programId?: string;
  modalityId?: string;
  classId?: string;
  provider: "google_drive" | "upload" | "url" | "pasted_text";
  externalId?: string;
  externalRevisionId?: string;
  sourceUrl?: string;
  filename: string;
  mimeType: string;
  contentHash: string;
  modifiedAt?: string;
};

type ExtractedDocumentField<T> = {
  value: T | null;
  confidence: number;
  sourceText?: string;
  sourceLocation?: string;
  warnings: string[];
};

type DocumentInterpretation = {
  sourceDocumentId: string;
  documentType: "monthly_plan" | "lesson_plan" | "report" | "calendar" | "assessment" | "institutional_guidance" | "regulation" | "unknown";
  fields: Record<string, ExtractedDocumentField<unknown>>;
  warnings: string[];
  extractionConfidence: number;
};

type DocumentContextBinding = {
  organizationId: string;
  programId?: string;
  modalityId?: string;
  classId?: string;
  period?: string;
  confidence: number;
  status: "confirmed" | "ambiguous" | "unresolved";
};

type AppStateSnapshot = {
  id: string;
  organizationId: string;
  classId: string;
  capturedAt: string;
  version: string;
  state: unknown;
};

type ReconciliationKind = "new_information" | "complement" | "conflict" | "stale_information" | "duplicate" | "missing_in_document" | "missing_in_app";

type DocumentMergeItem = {
  id: string;
  kind: ReconciliationKind;
  targetType: "cycle" | "session" | "report" | "class" | "event" | "deadline";
  targetId?: string;
  currentValue: unknown;
  proposedValue: unknown;
  recommendation: "apply" | "review" | "keep_current" | "ignore";
  reason: string;
  recommendationConfidence: number;
};

type DocumentReconciliationResult = {
  sourceDocumentId: string;
  snapshotId: string;
  items: DocumentMergeItem[];
  warnings: string[];
};

type DocumentMergeProposal = {
  id: string;
  sourceDocumentId: string;
  organizationId: string;
  classId: string;
  snapshotVersion: string;
  items: DocumentMergeItem[];
  status: "draft" | "approved" | "partially_approved" | "rejected" | "applied";
};

type ApprovedChangeSet = {
  proposalId: string;
  approvedItemIds: string[];
  approvedBy: string;
  expectedStateVersion: string;
  idempotencyKey: string;
};

type AppliedChangeValue = {
  mergeItemId: string;
  targetType: DocumentMergeItem["targetType"];
  targetId: string;
  previousValue: unknown;
  appliedValue: unknown;
};

type ChangeApplicationReceipt = {
  proposalId: string;
  applicationId: string;
  appliedItemIds: string[];
  skippedItemIds: string[];
  affectedEntities: Array<{ targetType: DocumentMergeItem["targetType"]; targetId: string }>;
  changes: AppliedChangeValue[];
  previousVersion: string;
  resultingVersion: string;
  sourceOperationId: string;
  transactionId: string;
  appliedBy: string;
  appliedAt: string;
  undoToken: string;
};
```

## Invariantes

- Exigir `organizationId` em todo contrato persistido.
- Validar `classId` contra a organização no servidor.
- Gerar proposta somente a partir de snapshot atual identificado por versão.
- Aplicar somente IDs presentes em `ApprovedChangeSet`.
- Manter `extractionConfidence`, `DocumentContextBinding.confidence` e `recommendationConfidence` semanticamente separados.
- Tornar recibos, auditoria e desfazer persistentes e rastreáveis à origem.
