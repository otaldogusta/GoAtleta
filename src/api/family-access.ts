import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { getValidAccessToken } from "../auth/session";

type JsonRecord = Record<string, unknown>;

export type FamilyRelationshipType =
  "guardian" | "parent" | "relative" | "payer" | "self" | "other";

export type FamilyStudentContext = {
  relationshipId: string;
  relationshipType: FamilyRelationshipType;
  relationshipLabel: string;
  studentId: string;
  studentName: string;
  studentPhotoUrl: string | null;
  organizationId: string;
  organizationName: string;
  classId: string | null;
  className: string | null;
  isFinancialResponsible: boolean;
  canViewAgenda: boolean;
  canViewAttendance: boolean;
  canViewProgress: boolean;
  canViewFinance: boolean;
  canPay: boolean;
};

export type FamilyScheduleItem = {
  id: string;
  classId: string | null;
  className: string | null;
  startsAt: string;
  endsAt: string | null;
  sessionType: string | null;
};

export type FamilyAttendanceHistoryItem = {
  date: string;
  status: "present" | "absent" | "unknown";
  classId: string | null;
  className: string | null;
};

export type FamilyAttendanceSummary = {
  available: boolean;
  reason: string | null;
  total: number;
  present: number;
  absent: number;
  attendanceRatePercent: number;
  lastRecordedOn: string | null;
  history: FamilyAttendanceHistoryItem[];
};

export type FamilyProgressSummary = {
  available: boolean;
  reason: string | null;
};

export type FamilyOverview = {
  relationshipId: string;
  organizationId: string;
  organizationName: string;
  studentId: string;
  studentName: string;
  classId: string | null;
  className: string | null;
  canViewSchedule: boolean;
  canViewAttendance: boolean;
  canViewProgress: boolean;
  nextSchedule: FamilyScheduleItem[];
  attendance: FamilyAttendanceSummary;
  progress: FamilyProgressSummary;
};

export type FamilyInvoiceStatus =
  "open" | "overdue" | "paid" | "cancelled" | "waived" | "unknown";

export type FamilyInvoice = {
  id: string;
  title: string;
  reference: string | null;
  dueDate: string | null;
  amountMinor: number;
  paidAmountMinor: number;
  outstandingAmountMinor: number;
  currency: string;
  status: FamilyInvoiceStatus;
  paidAt: string | null;
  paymentUrl: string | null;
};

export type FamilyFinanceSummary = {
  currency: string;
  openAmountMinor: number;
  overdueAmountMinor: number;
  paidAmountMinor: number;
  dueSoonAmountMinor: number;
  openCount: number;
  overdueCount: number;
};

export type FamilyFinanceData = {
  summary: FamilyFinanceSummary;
  invoices: FamilyInvoice[];
};

export class FamilyAccessRequestError extends Error {
  status: number;
  rpc: FamilyRpcName;

  constructor(message: string, status: number, rpc: FamilyRpcName) {
    super(message);
    this.name = "FamilyAccessRequestError";
    this.status = status;
    this.rpc = rpc;
  }
}

type FamilyRpcName =
  | "get_my_student_contexts_v1"
  | "get_my_family_overview_v1"
  | "get_my_family_finance_v1";

const asRecord = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return "";
};

const readNullableString = (...values: unknown[]) =>
  readString(...values) || null;

const readBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "t", "1", "yes", "sim"].includes(normalized)) return true;
    if (["false", "f", "0", "no", "nao", "não"].includes(normalized))
      return false;
  }
  return fallback;
};

const readInteger = (...values: unknown[]) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return 0;
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const parsed = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const readSafeHttpUrl = (...values: unknown[]) => {
  const candidate = readString(...values);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
};

const normalizeRelationshipType = (value: unknown): FamilyRelationshipType => {
  const normalized = readString(value).toLowerCase();
  if (["guardian", "responsavel", "responsável"].includes(normalized))
    return "guardian";
  if (["parent", "pai", "mae", "mãe"].includes(normalized)) return "parent";
  if (["relative", "parente"].includes(normalized)) return "relative";
  if (["payer", "financial", "pagador", "financeiro"].includes(normalized))
    return "payer";
  if (["self", "athlete", "student", "aluno", "atleta"].includes(normalized))
    return "self";
  return "other";
};

const relationshipLabelFor = (
  type: FamilyRelationshipType,
  source: JsonRecord,
) =>
  readString(source.relationship_label, source.relation_label) ||
  (
    {
      guardian: "Responsável",
      parent: "Responsável",
      relative: "Familiar",
      payer: "Responsável financeiro",
      self: "Atleta",
      other: "Vínculo familiar",
    } satisfies Record<FamilyRelationshipType, string>
  )[type];

const unwrapRows = (payload: unknown, keys: string[]) => {
  if (Array.isArray(payload)) return payload;
  const record = asRecord(payload);
  if (!record) return [];
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [record];
};

export const mapFamilyStudentContexts = (
  payload: unknown,
): FamilyStudentContext[] => {
  const seen = new Set<string>();
  const contexts: FamilyStudentContext[] = [];

  for (const item of unwrapRows(payload, ["contexts", "items", "data"])) {
    const row = asRecord(item);
    if (!row) continue;
    const capabilities = asRecord(row.capabilities) ?? {};
    const studentId = readString(row.student_id, row.studentId);
    const organizationId = readString(row.organization_id, row.organizationId);
    if (!studentId || !organizationId) continue;
    const relationshipType = normalizeRelationshipType(
      row.relationship_kind ??
        row.relationship_type ??
        row.relationshipType ??
        row.relation,
    );
    const relationshipId = readString(
      row.relationship_id,
      row.relationshipId,
      row.id,
    );
    if (!relationshipId) continue;
    const dedupeKey = `${relationshipId}:${studentId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const canPay = readBoolean(row.can_pay ?? row.canPay ?? capabilities.pay);
    const isFinancialResponsible = readBoolean(
      row.is_financial_responsible ??
        row.isFinancialResponsible ??
        capabilities.finance_responsible,
      canPay,
    );

    contexts.push({
      relationshipId,
      relationshipType,
      relationshipLabel: relationshipLabelFor(relationshipType, row),
      studentId,
      studentName:
        readString(row.student_name, row.studentName, row.name) || "Atleta",
      studentPhotoUrl: readNullableString(
        row.student_photo_url,
        row.studentPhotoUrl,
        row.photo_url,
      ),
      organizationId,
      organizationName:
        readString(row.organization_name, row.organizationName) ||
        "Instituição",
      classId: readNullableString(row.class_id, row.classId),
      className: readNullableString(row.class_name, row.className),
      isFinancialResponsible,
      canViewAgenda: readBoolean(
        row.can_view_schedule ??
          row.can_view_agenda ??
          row.canViewAgenda ??
          capabilities.schedule ??
          capabilities.agenda,
      ),
      canViewAttendance: readBoolean(
        row.can_view_attendance ??
          row.canViewAttendance ??
          capabilities.attendance,
      ),
      canViewProgress: readBoolean(
        row.can_view_progress ?? row.canViewProgress ?? capabilities.progress,
      ),
      canViewFinance: readBoolean(
        row.can_view_financial ??
          row.can_view_finance ??
          row.canViewFinance ??
          capabilities.financial ??
          capabilities.finance,
      ),
      canPay,
    });
  }

  return contexts;
};

const normalizeInvoiceStatus = (value: unknown): FamilyInvoiceStatus => {
  const normalized = readString(value).toLowerCase();
  if (["open", "pending", "due", "a_vencer", "aberta"].includes(normalized))
    return "open";
  if (
    ["overdue", "late", "delinquent", "vencida", "inadimplente"].includes(
      normalized,
    )
  ) {
    return "overdue";
  }
  if (["paid", "settled", "received", "paga", "pago"].includes(normalized))
    return "paid";
  if (
    [
      "cancelled",
      "canceled",
      "cancelada",
      "void",
      "voided",
      "refunded",
    ].includes(normalized)
  ) {
    return "cancelled";
  }
  if (["waived", "exempt", "isenta", "isento"].includes(normalized))
    return "waived";
  return "unknown";
};

const invoiceFromRecord = (row: JsonRecord): FamilyInvoice | null => {
  const id = readString(row.invoice_id, row.id);
  if (!id) return null;
  const amountMinor = readInteger(
    row.amount_minor,
    row.amountMinor,
    row.amount_cents,
    row.total_amount_minor,
    row.totalAmountMinor,
  );
  const paidAmountMinor = Math.max(
    0,
    readInteger(row.paid_minor, row.paidAmountMinor, row.paid_cents),
  );
  const rawTitle = readString(row.title, row.description, row.label) || "Mensalidade";
  const title = rawTitle.replace(
    /^mensalidade\s+mensalidade\b/i,
    "Mensalidade",
  );
  return {
    id,
    title,
    reference: readNullableString(
      row.reference,
      row.reference_month,
      row.competence_month,
      row.competence,
    ),
    dueDate: readNullableString(row.due_date, row.dueDate),
    amountMinor,
    paidAmountMinor,
    outstandingAmountMinor: Math.max(0, amountMinor - paidAmountMinor),
    currency: readString(row.currency, row.currency_code) || "BRL",
    status: normalizeInvoiceStatus(row.status),
    paidAt: readNullableString(row.paid_at, row.paidAt),
    paymentUrl: readSafeHttpUrl(
      row.payment_url,
      row.checkout_url,
      row.paymentUrl,
    ),
  };
};

const emptySummary = (currency = "BRL"): FamilyFinanceSummary => ({
  currency,
  openAmountMinor: 0,
  overdueAmountMinor: 0,
  paidAmountMinor: 0,
  dueSoonAmountMinor: 0,
  openCount: 0,
  overdueCount: 0,
});

const calculateSummary = (invoices: FamilyInvoice[]): FamilyFinanceSummary => {
  const summary = emptySummary(invoices[0]?.currency ?? "BRL");
  for (const invoice of invoices) {
    summary.paidAmountMinor +=
      invoice.paidAmountMinor ||
      (invoice.status === "paid" ? invoice.amountMinor : 0);
    if (invoice.status === "open") {
      summary.openAmountMinor += invoice.outstandingAmountMinor;
      summary.dueSoonAmountMinor += invoice.outstandingAmountMinor;
      summary.openCount += 1;
    }
    if (invoice.status === "overdue") {
      summary.openAmountMinor += invoice.outstandingAmountMinor;
      summary.overdueAmountMinor += invoice.outstandingAmountMinor;
      summary.openCount += 1;
      summary.overdueCount += 1;
    }
  }
  return summary;
};

export const mapFamilyFinanceData = (
  payload: unknown,
  relationshipId?: string,
): FamilyFinanceData => {
  const record = asRecord(payload);
  const nestedData = asRecord(record?.data);
  const source = nestedData ?? record;
  const invoicePayload =
    source?.invoices ??
    source?.items ??
    (Array.isArray(payload) ? payload : []);
  const invoices = unwrapRows(invoicePayload, ["invoices", "items", "data"])
    .filter((item) => {
      if (!relationshipId) return true;
      const row = asRecord(item);
      return (
        readString(row?.relationship_id, row?.relationshipId) === relationshipId
      );
    })
    .map((item) => {
      const row = asRecord(item);
      return row ? invoiceFromRecord(row) : null;
    })
    .filter((item): item is FamilyInvoice => Boolean(item));
  const calculated = calculateSummary(invoices);
  // A top-level summary may aggregate multiple linked athletes. When a
  // relationship is selected, derive the summary only from its filtered rows.
  const summarySource = relationshipId ? null : asRecord(source?.summary);
  if (!summarySource) return { summary: calculated, invoices };
  const currency =
    readString(summarySource.currency, summarySource.currency_code) ||
    calculated.currency;

  return {
    summary: {
      currency,
      openAmountMinor: readInteger(
        summarySource.open_amount_minor,
        summarySource.openAmountMinor,
        calculated.openAmountMinor,
      ),
      overdueAmountMinor: readInteger(
        summarySource.overdue_amount_minor,
        summarySource.overdueAmountMinor,
        calculated.overdueAmountMinor,
      ),
      paidAmountMinor: readInteger(
        summarySource.paid_amount_minor,
        summarySource.paidAmountMinor,
        calculated.paidAmountMinor,
      ),
      dueSoonAmountMinor: readInteger(
        summarySource.due_soon_amount_minor,
        summarySource.dueSoonAmountMinor,
        calculated.dueSoonAmountMinor,
      ),
      openCount: readInteger(
        summarySource.open_count,
        summarySource.openCount,
        calculated.openCount,
      ),
      overdueCount: readInteger(
        summarySource.overdue_count,
        summarySource.overdueCount,
        calculated.overdueCount,
      ),
    },
    invoices,
  };
};

const normalizeAttendanceStatus = (
  value: unknown,
): FamilyAttendanceHistoryItem["status"] => {
  const normalized = readString(value).toLowerCase();
  if (["present", "presente"].includes(normalized)) return "present";
  if (["absent", "ausente", "falta"].includes(normalized)) return "absent";
  return "unknown";
};

const mapScheduleItems = (payload: unknown): FamilyScheduleItem[] =>
  unwrapRows(payload, ["items", "data"])
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const id = readString(row.session_id, row.id);
      const startsAt = readString(row.starts_at, row.start_at, row.startsAt);
      if (!id || !startsAt) return null;
      return {
        id,
        classId: readNullableString(row.class_id, row.classId),
        className: readNullableString(row.class_name, row.className),
        startsAt,
        endsAt: readNullableString(row.ends_at, row.end_at, row.endsAt),
        sessionType: readNullableString(row.session_type, row.type),
      } satisfies FamilyScheduleItem;
    })
    .filter((item): item is FamilyScheduleItem => Boolean(item));

const mapAttendanceSummary = (payload: unknown): FamilyAttendanceSummary => {
  const row = asRecord(payload);
  const history = unwrapRows(row?.history, ["items", "data"])
    .map((item) => {
      const historyRow = asRecord(item);
      if (!historyRow) return null;
      const date = readString(historyRow.date, historyRow.recorded_on);
      if (!date) return null;
      return {
        date,
        status: normalizeAttendanceStatus(historyRow.status),
        classId: readNullableString(historyRow.class_id, historyRow.classId),
        className: readNullableString(
          historyRow.class_name,
          historyRow.className,
        ),
      } satisfies FamilyAttendanceHistoryItem;
    })
    .filter((item): item is FamilyAttendanceHistoryItem => Boolean(item));

  return {
    available: readBoolean(row?.available),
    reason: readNullableString(row?.reason),
    total: readInteger(row?.total),
    present: readInteger(row?.present),
    absent: readInteger(row?.absent),
    attendanceRatePercent: readNumber(
      row?.attendance_rate_percent,
      row?.attendanceRatePercent,
    ),
    lastRecordedOn: readNullableString(
      row?.last_recorded_on,
      row?.lastRecordedOn,
    ),
    history,
  };
};

const mapProgressSummary = (payload: unknown): FamilyProgressSummary => {
  const row = asRecord(payload);
  return {
    available: readBoolean(row?.available),
    reason: readNullableString(row?.reason),
  };
};

export const mapFamilyOverviews = (payload: unknown): FamilyOverview[] =>
  unwrapRows(payload, ["overviews", "items", "data"])
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const relationshipId = readString(
        row.relationship_id,
        row.relationshipId,
      );
      const organizationId = readString(
        row.organization_id,
        row.organizationId,
      );
      const studentId = readString(row.student_id, row.studentId);
      if (!relationshipId || !organizationId || !studentId) return null;
      return {
        relationshipId,
        organizationId,
        organizationName:
          readString(row.organization_name, row.organizationName) ||
          "Instituição",
        studentId,
        studentName: readString(row.student_name, row.studentName) || "Atleta",
        classId: readNullableString(row.class_id, row.classId),
        className: readNullableString(row.class_name, row.className),
        canViewSchedule: readBoolean(row.can_view_schedule, false),
        canViewAttendance: readBoolean(row.can_view_attendance, false),
        canViewProgress: readBoolean(row.can_view_progress, false),
        nextSchedule: mapScheduleItems(row.next_schedule),
        attendance: mapAttendanceSummary(row.attendance_summary),
        progress: mapProgressSummary(row.progress_summary),
      } satisfies FamilyOverview;
    })
    .filter((item): item is FamilyOverview => Boolean(item));

const callFamilyRpc = async ({
  rpc,
  accessToken,
  body,
}: {
  rpc: FamilyRpcName;
  accessToken?: string;
  body?: JsonRecord;
}) => {
  const token = accessToken ?? (await getValidAccessToken());
  if (!token)
    throw new FamilyAccessRequestError("Sessão indisponível.", 401, rpc);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), 5000);
  let response: Response;
  try {
    response = await fetch(
      `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${rpc}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      },
    );
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FamilyAccessRequestError(
        "Tempo esgotado ao carregar o acesso familiar.",
        408,
        rpc,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
  const text = await response.text();
  if (!response.ok) {
    throw new FamilyAccessRequestError(
      text.trim() || "Não foi possível carregar o acesso familiar.",
      response.status,
      rpc,
    );
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new FamilyAccessRequestError(
      "Resposta inválida do servidor.",
      502,
      rpc,
    );
  }
};

export const isFamilyFoundationUnavailable = (error: unknown) =>
  error instanceof FamilyAccessRequestError &&
  error.rpc === "get_my_student_contexts_v1" &&
  /PGRST202|could not find[^\n]*get_my_student_contexts_v1|schema cache[^\n]*(get_my_student_contexts_v1|function)/i.test(
    error.message,
  );

export const getMyStudentContexts = async (accessToken?: string) =>
  mapFamilyStudentContexts(
    await callFamilyRpc({ rpc: "get_my_student_contexts_v1", accessToken }),
  );

export const getMyFamilyOverview = async (
  relationshipId: string,
  accessToken?: string,
) => {
  const normalizedRelationshipId = relationshipId.trim();
  if (!normalizedRelationshipId) {
    throw new FamilyAccessRequestError(
      "Vínculo familiar não selecionado.",
      400,
      "get_my_family_overview_v1",
    );
  }
  const overviews = mapFamilyOverviews(
    await callFamilyRpc({ rpc: "get_my_family_overview_v1", accessToken }),
  );
  return (
    overviews.find(
      (overview) => overview.relationshipId === normalizedRelationshipId,
    ) ?? null
  );
};

export const getMyFamilyFinance = async (
  relationshipId: string,
  accessToken?: string,
) => {
  const normalizedRelationshipId = relationshipId.trim();
  if (!normalizedRelationshipId) {
    throw new FamilyAccessRequestError(
      "Vínculo familiar não selecionado.",
      400,
      "get_my_family_finance_v1",
    );
  }
  return mapFamilyFinanceData(
    await callFamilyRpc({
      rpc: "get_my_family_finance_v1",
      accessToken,
    }),
    normalizedRelationshipId,
  );
};
