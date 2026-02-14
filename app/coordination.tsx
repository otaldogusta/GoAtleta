import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { cacheDirectory, documentDirectory, EncodingType, writeAsStringAsync } from "expo-file-system";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    classifySyncError,
    generateExecutiveSummary,
    generateTrainerMessage,
    suggestDataFixes,
    type DataFixIssue,
    type DataFixSuggestionsResult,
    type ExecutiveSummaryResult,
    type SyncErrorClassificationResult,
    type TrainerMessageResult,
} from "../src/api/ai";
import {
    AdminPendingAttendance,
    AdminPendingSessionLogs,
    AdminRecentActivity,
    listAdminPendingAttendance,
    listAdminPendingSessionLogs,
    listAdminRecentActivity,
} from "../src/api/reports";
import { useSmartSync } from "../src/core/use-smart-sync";
import {
    clearPendingWritesDeadLetterCandidates,
    exportSyncHealthReportJson,
    flushPendingWrites,
    getClasses,
    getPendingWritePayloadById,
    getPendingWritesDiagnostics,
    listPendingWriteFailures,
    reprocessPendingWriteById,
    reprocessPendingWritesNetworkFailures,
    type PendingWriteFailureRow,
    type PendingWritesDiagnostics,
} from "../src/db/seed";
import { CoordinationAiDocument } from "../src/pdf/coordination-ai-document.web";
import { exportPdf, safeFileName } from "../src/pdf/export-pdf";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { OrgMembersPanel } from "../src/screens/coordination/OrgMembersPanel";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

type CoordinationTab = "dashboard" | "members";

const formatDateBr = (value: string | null | undefined) => {
  if (!value) return "-";
  const datePart = value.includes("T") ? value.split("T")[0] : value;
  const parts = datePart.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const formatDateTimeBr = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const toDateKey = (value: string) => (value.includes("T") ? value.split("T")[0] : value);

const parseTimeToMinutes = (value: string | null | undefined) => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const formatExecutiveSummaryText = (summary: ExecutiveSummaryResult) => {
  const highlights = summary.highlights.map((item) => `- ${item}`).join("\n");
  const risks = summary.risks.map((item) => `- ${item}`).join("\n");
  const actions = summary.recommendedActions.map((item) => `- ${item}`).join("\n");
  return [
    summary.headline,
    "",
    "Destaques:",
    highlights || "- Sem destaques",
    "",
    "Riscos:",
    risks || "- Sem riscos",
    "",
    "Ações recomendadas:",
    actions || "- Sem ações",
  ].join("\n");
};

const formatTrainerMessageText = (message: TrainerMessageResult) =>
  [
    `Assunto: ${message.subject || "(sem assunto)"}`,
    "",
    "WhatsApp:",
    message.whatsapp || "(vazio)",
    "",
    "E-mail:",
    message.email || "(vazio)",
    "",
    "One-liner:",
    message.oneLiner || "(vazio)",
  ].join("\n");

const formatSyncClassificationText = (classification: SyncErrorClassificationResult) =>
  [
    `Severidade: ${classification.severity}`,
    `Causa provável: ${classification.probableCause}`,
    `Ação recomendada: ${classification.recommendedAction}`,
    `Suporte: ${classification.supportHint}`,
  ].join("\n");

const formatDataFixesText = (result: DataFixSuggestionsResult) => {
  const blocks = result.suggestions.map((item) => {
    const options = item.options.length ? item.options.map((opt) => `- ${opt}`).join("\n") : "- Sem opções";
    return [
      `${item.issueType}`,
      `Explicação: ${item.explanation || "-"}`,
      "Opções:",
      options,
      `Recomendado: ${item.recommended || "-"}`,
    ].join("\n");
  });
  return [result.summary || "Sugestões indisponíveis", "", ...blocks].join("\n\n");
};

type AiExportBundle = {
  title: string;
  generatedAt: string;
  markdown: string;
  html: string;
  sections: { heading: string; body: string }[];
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildAiExportBundle = (params: {
  organizationName: string;
  executiveSummary: ExecutiveSummaryResult | null;
  trainerMessage: TrainerMessageResult | null;
  dataFixSuggestions: DataFixSuggestionsResult | null;
}) : AiExportBundle | null => {
  const { organizationName, executiveSummary, trainerMessage, dataFixSuggestions } = params;
  if (!executiveSummary && !trainerMessage && !dataFixSuggestions) return null;

  const generatedAt = new Date().toLocaleString("pt-BR");
  const sections: { heading: string; body: string }[] = [];

  if (executiveSummary) {
    sections.push({ heading: "Resumo Executivo", body: formatExecutiveSummaryText(executiveSummary) });
  }
  if (trainerMessage) {
    sections.push({ heading: "Copiloto de Comunicação", body: formatTrainerMessageText(trainerMessage) });
  }
  if (dataFixSuggestions) {
    sections.push({ heading: "Sugestões de Correção", body: formatDataFixesText(dataFixSuggestions) });
  }

  const title = `IA Coordination - ${organizationName}`;
  const markdown = [
    `# ${title}`,
    "",
    `Gerado em: ${generatedAt}`,
    "",
    ...sections.flatMap((section) => [
      `## ${section.heading}`,
      "",
      section.body,
      "",
    ]),
  ].join("\n");

  const html = `<!doctype html><html><head><meta charset=\"utf-8\" /><title>${escapeHtml(
    title
  )}</title><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px;color:#111827}h1{font-size:20px;margin-bottom:8px}h2{font-size:16px;margin-top:20px}pre{white-space:pre-wrap;line-height:1.45;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px}</style></head><body><h1>${escapeHtml(
    title
  )}</h1><p>Gerado em: ${escapeHtml(generatedAt)}</p>${sections
    .map(
      (section) =>
        `<h2>${escapeHtml(section.heading)}</h2><pre>${escapeHtml(section.body)}</pre>`
    )
    .join("")}</body></html>`;

  return { title, generatedAt, markdown, html, sections };
};

const IndicatorCard = memo(function IndicatorCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: string | number;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View
      style={{
        minWidth: 120,
        flexGrow: 1,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
});

export default function CoordinationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const { syncPausedReason, resumeSync } = useSmartSync();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const organizationId = activeOrganization?.id ?? null;
  const organizationName = activeOrganization?.name ?? "Organização";

  const [activeTab, setActiveTab] = useState<CoordinationTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAttendance, setPendingAttendance] = useState<AdminPendingAttendance[]>([]);
  const [pendingReports, setPendingReports] = useState<AdminPendingSessionLogs[]>([]);
  const [recentActivity, setRecentActivity] = useState<AdminRecentActivity[]>([]);
  const [pendingWritesDiagnostics, setPendingWritesDiagnostics] = useState<PendingWritesDiagnostics>({
    total: 0,
    highRetry: 0,
    maxRetry: 0,
    deadLetterCandidates: 0,
    deadLetterStored: 0,
  });
  const [syncActionLoading, setSyncActionLoading] = useState(false);
  const [syncActionMessage, setSyncActionMessage] = useState<string | null>(null);
  const [failedWrites, setFailedWrites] = useState<PendingWriteFailureRow[]>([]);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummaryResult | null>(null);
  const [trainerMessage, setTrainerMessage] = useState<TrainerMessageResult | null>(null);
  const [syncClassifications, setSyncClassifications] = useState<Record<string, SyncErrorClassificationResult>>({});
  const [dataFixSuggestions, setDataFixSuggestions] = useState<DataFixSuggestionsResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiExportLoading, setAiExportLoading] = useState(false);

  const tabItems = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard" },
      { id: "members" as const, label: "Gerenciar membros" },
    ],
    []
  );

  const loadDashboard = useCallback(async () => {
    if (!organizationId || !isAdmin) {
      setPendingAttendance([]);
      setPendingReports([]);
      setRecentActivity([]);
      setPendingWritesDiagnostics({
        total: 0,
        highRetry: 0,
        maxRetry: 0,
        deadLetterCandidates: 0,
        deadLetterStored: 0,
      });
      setFailedWrites([]);
      setExecutiveSummary(null);
      setTrainerMessage(null);
      setSyncClassifications({});
      setDataFixSuggestions(null);
      setAiMessage(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [attendanceRows, reportRows, activityRows, classes] = await Promise.all([
        listAdminPendingAttendance({ organizationId }),
        listAdminPendingSessionLogs({ organizationId }),
        listAdminRecentActivity({ organizationId, limit: 12 }),
        getClasses({ organizationId }),
      ]);
      const queueDiagnostics = await getPendingWritesDiagnostics(10);
      const failed = await listPendingWriteFailures(12);
      const classesById = new Map(classes.map((item) => [item.id, item]));
      const now = new Date();
      const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate()
      ).padStart(2, "0")}`;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const pendingAttendanceVisible = attendanceRows.filter((item) => {
        if (toDateKey(item.targetDate) !== todayKey) return true;
        const classRow = classesById.get(item.classId);
        const classStartMinutes = parseTimeToMinutes(classRow?.startTime);
        if (classStartMinutes === null) return true;
        return classStartMinutes <= nowMinutes;
      });

      setPendingAttendance(pendingAttendanceVisible);
      setPendingReports(reportRows);
      setRecentActivity(activityRows);
      setPendingWritesDiagnostics(queueDiagnostics);
      setFailedWrites(failed);
    } catch (err) {
      setPendingAttendance([]);
      setPendingReports([]);
      setRecentActivity([]);
      setPendingWritesDiagnostics({
        total: 0,
        highRetry: 0,
        maxRetry: 0,
        deadLetterCandidates: 0,
        deadLetterStored: 0,
      });
      setFailedWrites([]);
      setAiMessage(null);
      setError(err instanceof Error ? err.message : "Falha ao carregar dados da coordenação.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, organizationId]);

  const handleReprocessQueueNow = useCallback(async () => {
    setSyncActionLoading(true);
    setSyncActionMessage(null);
    try {
      const result = await flushPendingWrites();
      setSyncActionMessage(
        result.flushed > 0
          ? `Reprocessado: ${result.flushed} item(ns).`
          : result.remaining > 0
          ? `Nenhum item sincronizado agora. Restam ${result.remaining}.`
          : "Fila já estava limpa."
      );
      await loadDashboard();
    } catch (error) {
      setSyncActionMessage(
        error instanceof Error
          ? `Falha ao reprocessar fila: ${error.message}`
          : "Falha ao reprocessar fila."
      );
    } finally {
      setSyncActionLoading(false);
    }
  }, [loadDashboard]);

  const handleClearDeadLetterCandidates = useCallback(async () => {
    setSyncActionLoading(true);
    setSyncActionMessage(null);
    try {
      const result = await clearPendingWritesDeadLetterCandidates(10);
      setSyncActionMessage(
        result.removed > 0
          ? `Arquivado(s) ${result.removed} item(ns) com retry alto em dead-letter.`
          : "Nenhum item com retry alto para arquivar."
      );
      await loadDashboard();
    } catch (error) {
      setSyncActionMessage(
        error instanceof Error
          ? `Falha ao arquivar dead-letter: ${error.message}`
          : "Falha ao arquivar dead-letter."
      );
    } finally {
      setSyncActionLoading(false);
    }
  }, [loadDashboard]);

  const handleExportSyncHealthJson = useCallback(async () => {
    setSyncActionLoading(true);
    setSyncActionMessage(null);
    try {
      const reportJson = await exportSyncHealthReportJson({
        organizationId,
        deadLetterLimit: 100,
        queueErrorLimit: 25,
      });
      await Clipboard.setStringAsync(reportJson);
      setSyncActionMessage(
        "Diagnóstico exportado em JSON e copiado para a área de transferência."
      );
    } catch (error) {
      setSyncActionMessage(
        error instanceof Error
          ? `Falha ao exportar JSON: ${error.message}`
          : "Falha ao exportar JSON."
      );
    } finally {
      setSyncActionLoading(false);
    }
  }, [organizationId]);

  const handleResumePausedSync = useCallback(async () => {
    resumeSync();
    setSyncActionMessage("Sincronização retomada. Tentando novamente.");
    await loadDashboard();
  }, [loadDashboard, resumeSync]);

  const handleReprocessNetworkFailures = useCallback(async () => {
    setSyncActionLoading(true);
    setSyncActionMessage(null);
    try {
      const result = await reprocessPendingWritesNetworkFailures(20);
      setSyncActionMessage(
        result.selected > 0
          ? `Reprocesso de rede: ${result.flushed} sincronizado(s) de ${result.selected} selecionado(s).`
          : "Nenhuma falha de rede selecionável no momento."
      );
      await loadDashboard();
    } catch (error) {
      setSyncActionMessage(
        error instanceof Error
          ? `Falha ao reprocessar falhas de rede: ${error.message}`
          : "Falha ao reprocessar falhas de rede."
      );
    } finally {
      setSyncActionLoading(false);
    }
  }, [loadDashboard]);

  const handleReprocessSingleItem = useCallback(
    async (id: string) => {
      setSyncActionLoading(true);
      setSyncActionMessage(null);
      try {
        const result = await reprocessPendingWriteById(id);
        setSyncActionMessage(
          result.flushed > 0
            ? `Item ${id.slice(0, 8)} reprocessado com sucesso.`
            : `Item ${id.slice(0, 8)} enviado para reprocesso.`
        );
        await loadDashboard();
      } catch (error) {
        setSyncActionMessage(
          error instanceof Error
            ? `Falha ao reprocessar item ${id.slice(0, 8)}: ${error.message}`
            : `Falha ao reprocessar item ${id.slice(0, 8)}.`
        );
      } finally {
        setSyncActionLoading(false);
      }
    },
    [loadDashboard]
  );

  const handleCopyFailedPayload = useCallback(async (id: string) => {
    setSyncActionLoading(true);
    setSyncActionMessage(null);
    try {
      const payload = await getPendingWritePayloadById(id);
      if (!payload) {
        setSyncActionMessage("Payload não encontrado para este item.");
        return;
      }
      await Clipboard.setStringAsync(payload);
      setSyncActionMessage(`Payload do item ${id.slice(0, 8)} copiado.`);
    } catch (error) {
      setSyncActionMessage(
        error instanceof Error
          ? `Falha ao copiar payload: ${error.message}`
          : "Falha ao copiar payload."
      );
    } finally {
      setSyncActionLoading(false);
    }
  }, []);

  const handleGenerateExecutiveSummary = useCallback(async () => {
    setAiLoading(true);
    setAiMessage(null);
    try {
      const topDelaysByTrainer = pendingReports.slice(0, 5).map((item) => ({
        classId: item.classId,
        className: item.className,
        unit: item.unit,
        daysWithoutReport: item.lastReportAt
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(item.lastReportAt).getTime()) / (1000 * 60 * 60 * 24))
            )
          : null,
      }));

      const summary = await generateExecutiveSummary({
        periodLabel: "Coordenação - últimos 7 dias",
        syncHealth: {
          syncPausedReason,
          diagnostics: pendingWritesDiagnostics,
        },
        slaStats: {
          pendingAttendance: pendingAttendance.length,
          pendingReports: pendingReports.length,
          recentActivity: recentActivity.length,
        },
        criticalClasses: pendingReports
          .filter((item) => {
            if (!item.lastReportAt) return true;
            const days = Math.floor((Date.now() - new Date(item.lastReportAt).getTime()) / (1000 * 60 * 60 * 24));
            return days > 7;
          })
          .slice(0, 10),
        pendingWritesDiagnostics,
        deadLettersRecent: failedWrites.slice(0, 10),
        topDelaysByTrainer,
      });

      setExecutiveSummary(summary);
      await Clipboard.setStringAsync(formatExecutiveSummaryText(summary));
      setAiMessage("Resumo executivo gerado e copiado para a área de transferência.");
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `Falha ao gerar resumo executivo: ${error.message}`
          : "Falha ao gerar resumo executivo."
      );
    } finally {
      setAiLoading(false);
    }
  }, [
    failedWrites,
    pendingAttendance.length,
    pendingReports,
    pendingWritesDiagnostics,
    recentActivity.length,
    syncPausedReason,
  ]);

  const handleGenerateTrainerMessage = useCallback(async () => {
    setAiLoading(true);
    setAiMessage(null);
    try {
      const target = pendingReports[0];
      if (!target) {
        setAiMessage("Sem relatórios pendentes para gerar mensagem.");
        return;
      }

      const daysWithoutReport = target.lastReportAt
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(target.lastReportAt).getTime()) / (1000 * 60 * 60 * 24))
          )
        : 999;

      const generated = await generateTrainerMessage(
        {
          organizationName,
          unit: target.unit,
          className: target.className,
          lastReportAt: target.lastReportAt,
          daysWithoutReport,
          pendingItems: [
            `${pendingAttendance.length} chamada(s) pendente(s)`,
            `${pendingReports.length} relatório(s) pendente(s)`,
          ],
          expectedSla: "Relatório semanal atualizado",
        },
        daysWithoutReport > 7 ? "urgent" : "formal"
      );

      setTrainerMessage(generated);
      await Clipboard.setStringAsync(formatTrainerMessageText(generated));
      setAiMessage("Mensagem para professor gerada e copiada para a área de transferência.");
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `Falha ao gerar mensagem: ${error.message}`
          : "Falha ao gerar mensagem."
      );
    } finally {
      setAiLoading(false);
    }
  }, [organizationName, pendingAttendance.length, pendingReports]);

  const handleClassifySyncError = useCallback(
    async (item: PendingWriteFailureRow) => {
      setAiLoading(true);
      setAiMessage(null);
      try {
        const payload = await getPendingWritePayloadById(item.id);
        let parsedPayload: unknown = null;
        if (payload) {
          try {
            parsedPayload = JSON.parse(payload);
          } catch {
            parsedPayload = payload;
          }
        }
        const classification = await classifySyncError({
          error: item.lastError ?? "Erro não informado",
          payload: parsedPayload,
          orgContext: {
            organizationId,
            organizationName,
            userRole: isAdmin ? "admin" : "member",
          },
        });

        setSyncClassifications((prev) => ({ ...prev, [item.id]: classification }));
        await Clipboard.setStringAsync(formatSyncClassificationText(classification));
        setAiMessage(`Classificação do erro ${item.id.slice(0, 8)} gerada e copiada.`);
      } catch (error) {
        setAiMessage(
          error instanceof Error
            ? `Falha ao classificar erro: ${error.message}`
            : "Falha ao classificar erro."
        );
      } finally {
        setAiLoading(false);
      }
    },
    [isAdmin, organizationId, organizationName]
  );

  const handleSuggestDataFixes = useCallback(async () => {
    setAiLoading(true);
    setAiMessage(null);
    try {
      const issues: DataFixIssue[] = [];

      pendingReports.forEach((item) => {
        const daysWithoutReport = item.lastReportAt
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(item.lastReportAt).getTime()) / (1000 * 60 * 60 * 24))
            )
          : 999;
        if (daysWithoutReport > 7) {
          issues.push({
            type: "MISSING_WEEKLY_REPORT",
            severity: daysWithoutReport > 14 ? "critical" : "high",
            entity: {
              classId: item.classId,
              className: item.className,
              unit: item.unit,
            },
            evidence: {
              lastReportAt: item.lastReportAt,
              daysWithoutReport,
            },
          });
        }
      });

      failedWrites.forEach((item) => {
        issues.push({
          type: "SYNC_FAILURE_PERSISTENT",
          severity: item.retryCount >= 10 ? "critical" : "medium",
          entity: {
            pendingWriteId: item.id,
            kind: item.kind,
            streamKey: item.streamKey,
          },
          evidence: {
            retryCount: item.retryCount,
            lastError: item.lastError,
            dedupKey: item.dedupKey,
          },
        });
      });

      if (!issues.length) {
        setAiMessage("Nenhuma inconsistência relevante para sugerir correções.");
        return;
      }

      const suggested = await suggestDataFixes({ issues });
      setDataFixSuggestions(suggested);
      await Clipboard.setStringAsync(formatDataFixesText(suggested));
      setAiMessage("Sugestões de correção geradas e copiadas para a área de transferência.");
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `Falha ao sugerir correções: ${error.message}`
          : "Falha ao sugerir correções."
      );
    } finally {
      setAiLoading(false);
    }
  }, [failedWrites, pendingReports]);

  const handleCopyWhatsappMessage = useCallback(async () => {
    try {
      const content =
        trainerMessage?.whatsapp?.trim() ||
        trainerMessage?.oneLiner?.trim() ||
        (executiveSummary
          ? `${executiveSummary.headline}\n\n${executiveSummary.recommendedActions
              .slice(0, 3)
              .map((item) => `- ${item}`)
              .join("\n")}`
          : "");

      if (!content) {
        setAiMessage("Gere primeiro uma mensagem ou resumo para copiar no WhatsApp.");
        return;
      }

      await Clipboard.setStringAsync(content);
      setAiMessage("Texto para WhatsApp copiado.");
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `Falha ao copiar para WhatsApp: ${error.message}`
          : "Falha ao copiar para WhatsApp."
      );
    }
  }, [executiveSummary, trainerMessage]);

  const handleExportMarkdown = useCallback(async () => {
    setAiExportLoading(true);
    try {
      const bundle = buildAiExportBundle({
        organizationName,
        executiveSummary,
        trainerMessage,
        dataFixSuggestions,
      });

      if (!bundle) {
        setAiMessage("Nada para exportar. Gere os blocos de IA primeiro.");
        return;
      }

      const fileName = `${safeFileName(bundle.title)}_${safeFileName(bundle.generatedAt)}.md`;

      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && typeof document !== "undefined") {
          const blob = new Blob([bundle.markdown], { type: "text/markdown;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1200);
          setAiMessage("Markdown exportado com sucesso.");
          return;
        }
      }

      const base = documentDirectory ?? cacheDirectory ?? "";
      if (!base) {
        await Clipboard.setStringAsync(bundle.markdown);
        setAiMessage("Markdown copiado (storage indisponível no dispositivo).");
        return;
      }

      const target = `${base}${fileName}`;
      await writeAsStringAsync(target, bundle.markdown, { encoding: EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(target, {
          dialogTitle: "Exportar Markdown",
          mimeType: "text/markdown",
        });
      }
      setAiMessage("Markdown exportado com sucesso.");
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `Falha ao exportar Markdown: ${error.message}`
          : "Falha ao exportar Markdown."
      );
    } finally {
      setAiExportLoading(false);
    }
  }, [dataFixSuggestions, executiveSummary, organizationName, trainerMessage]);

  const handleExportPdf = useCallback(async () => {
    setAiExportLoading(true);
    try {
      const bundle = buildAiExportBundle({
        organizationName,
        executiveSummary,
        trainerMessage,
        dataFixSuggestions,
      });

      if (!bundle) {
        setAiMessage("Nada para exportar. Gere os blocos de IA primeiro.");
        return;
      }

      const fileName = `${safeFileName(bundle.title)}_${safeFileName(bundle.generatedAt)}.pdf`;
      const webDocument =
        Platform.OS === "web" ? (
          <CoordinationAiDocument
            title={bundle.title}
            generatedAt={bundle.generatedAt}
            sections={bundle.sections}
          />
        ) : undefined;

      await exportPdf({
        html: bundle.html,
        fileName,
        webDocument,
      });

      setAiMessage("PDF exportado com sucesso.");
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `Falha ao exportar PDF: ${error.message}`
          : "Falha ao exportar PDF."
      );
    } finally {
      setAiExportLoading(false);
    }
  }, [dataFixSuggestions, executiveSummary, organizationName, trainerMessage]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === "dashboard") {
        void loadDashboard();
      }
    }, [activeTab, loadDashboard])
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: 16 }}>
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Coordenação
            </Text>
            <Text style={{ color: colors.muted }}>
              Você não tem acesso a esta área.
            </Text>
            <Pressable
              onPress={() => router.replace("/")}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
            Coordenação
          </Text>
          <Text style={{ color: colors.muted }}>
            Dashboard e gestão de membros da organização • {organizationName}.
          </Text>
        </View>

        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 8,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {tabItems.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={{
                    flexGrow: 1,
                    minWidth: 130,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryText : colors.text,
                      fontWeight: "700",
                      fontSize: 13,
                      textAlign: "center",
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {activeTab === "members" ? (
        <View style={{ flex: 1 }}>
          <OrgMembersPanel embedded />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 12,
              }}
            >
              <Text style={{ color: colors.dangerSolidBg, fontWeight: "700" }}>Erro</Text>
              <Text style={{ color: colors.muted, marginTop: 4 }}>{error}</Text>
            </View>
          ) : null}

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Indicadores
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <IndicatorCard
                label="Chamada pendente"
                value={loading ? "..." : pendingAttendance.length}
                colors={colors}
              />
              <IndicatorCard
                label="Relatórios pendentes"
                value={loading ? "..." : pendingReports.length}
                colors={colors}
              />
              <IndicatorCard
                label="Atividade (7d)"
                value={loading ? "..." : recentActivity.length}
                colors={colors}
              />
              <IndicatorCard
                label="Sync local pendente"
                value={loading ? "..." : pendingWritesDiagnostics.total}
                colors={colors}
              />
            </View>
          </View>

          {!loading ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                IA Assistiva
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Resumo executivo, copiloto de comunicação, classificação de erro e sugestões de correção.
              </Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable
                  onPress={handleGenerateExecutiveSummary}
                  disabled={aiLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: aiLoading ? colors.secondaryBg : colors.primaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: aiLoading ? colors.muted : colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                    Gerar resumo executivo
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleGenerateTrainerMessage}
                  disabled={aiLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Gerar mensagem professor
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSuggestDataFixes}
                  disabled={aiLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Sugerir correções
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCopyWhatsappMessage}
                  disabled={aiLoading || aiExportLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Copiar WhatsApp
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleExportMarkdown}
                  disabled={aiLoading || aiExportLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Exportar Markdown
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleExportPdf}
                  disabled={aiLoading || aiExportLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Exportar PDF
                  </Text>
                </Pressable>
              </View>
              {aiMessage ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>{aiMessage}</Text>
              ) : null}
              {executiveSummary ? (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Resumo: {executiveSummary.headline}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {executiveSummary.recommendedActions.slice(0, 2).join(" • ") || "Sem ações sugeridas."}
                  </Text>
                </View>
              ) : null}
              {trainerMessage ? (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Mensagem sugerida: {trainerMessage.subject || "(sem assunto)"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {trainerMessage.oneLiner || trainerMessage.whatsapp || "Sem conteúdo"}
                  </Text>
                </View>
              ) : null}
              {dataFixSuggestions ? (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Correções sugeridas
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {dataFixSuggestions.summary}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {!loading &&
          (pendingWritesDiagnostics.deadLetterCandidates > 0 ||
            pendingWritesDiagnostics.deadLetterStored > 0 ||
            syncPausedReason !== null ||
            failedWrites.length > 0) ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                Saúde da Sincronização
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {pendingWritesDiagnostics.deadLetterCandidates} item(ns) com 10+ tentativas • {pendingWritesDiagnostics.deadLetterStored} item(ns) arquivado(s) em dead-letter. Máx retry: {pendingWritesDiagnostics.maxRetry}.
              </Text>
              {syncPausedReason ? (
                <View
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    padding: 10,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Sync pausado por {syncPausedReason === "auth" ? "autenticação" : syncPausedReason === "permission" ? "permissão" : "troca de organização"}.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    <Pressable
                      onPress={handleResumePausedSync}
                      disabled={syncActionLoading}
                      style={{
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.primaryBg,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                      }}
                    >
                      <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                        Tentar novamente
                      </Text>
                    </Pressable>
                    {syncPausedReason === "auth" ? (
                      <Pressable
                        onPress={() => router.push("/login")}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                          Reautenticar
                        </Text>
                      </Pressable>
                    ) : null}
                    {syncPausedReason === "permission" ? (
                      <Pressable
                        onPress={() => router.push("/profile")}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                          Trocar organização
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <Pressable
                  onPress={handleReprocessQueueNow}
                  disabled={syncActionLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: syncActionLoading ? colors.secondaryBg : colors.primaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text
                    style={{
                      color: syncActionLoading ? colors.muted : colors.primaryText,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    Reprocessar fila agora
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleReprocessNetworkFailures}
                  disabled={syncActionLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Reprocessar falhas de rede
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleClearDeadLetterCandidates}
                  disabled={syncActionLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Arquivar dead-letter
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleExportSyncHealthJson}
                  disabled={syncActionLoading}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Exportar JSON
                  </Text>
                </Pressable>
              </View>
              {syncActionMessage ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>{syncActionMessage}</Text>
              ) : null}
              {failedWrites.length > 0 ? (
                <View style={{ marginTop: 6, gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                    Falhas recentes (fila)
                  </Text>
                  <FlatList
                    data={failedWrites}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    initialNumToRender={8}
                    windowSize={5}
                    renderItem={({ item }) => (
                      <View
                        style={{
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: colors.secondaryBg,
                          padding: 10,
                          gap: 6,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                          {item.kind} • retry {item.retryCount}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          {item.lastError || "Erro não informado"}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          Stream: {item.streamKey}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          Dedup: {item.dedupKey || "-"}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                          <Pressable
                            onPress={() => handleReprocessSingleItem(item.id)}
                            disabled={syncActionLoading}
                            style={{
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.primaryBg,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                            }}
                          >
                            <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 11 }}>
                              Reprocessar item
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleCopyFailedPayload(item.id)}
                            disabled={syncActionLoading}
                            style={{
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.secondaryBg,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                            }}
                          >
                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
                              Copiar payload
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleClassifySyncError(item)}
                            disabled={aiLoading}
                            style={{
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.secondaryBg,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                            }}
                          >
                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
                              Classificar erro (IA)
                            </Text>
                          </Pressable>
                        </View>
                        {syncClassifications[item.id] ? (
                          <View
                            style={{
                              marginTop: 4,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.card,
                              padding: 8,
                              gap: 2,
                            }}
                          >
                            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
                              IA • severidade {syncClassifications[item.id].severity}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>
                              {syncClassifications[item.id].probableCause}
                            </Text>
                            <Text style={{ color: colors.muted, fontSize: 11 }}>
                              {syncClassifications[item.id].recommendedAction}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Quick Actions Card */}
          {!loading && (pendingAttendance.length > 0 || pendingReports.length > 0) ? (
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.primaryBg,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: "800" }}>
                Ações Rápidas
              </Text>
              <View style={{ gap: 8 }}>
                {pendingAttendance.length > 0 ? (
                  <Pressable
                    onPress={() => router.push("/reports")}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "700", flex: 1 }}>
                      Ver todas as pendências
                    </Text>
                    <View
                      style={{
                        paddingVertical: 3,
                        paddingHorizontal: 8,
                        borderRadius: 999,
                        backgroundColor: colors.background,
                      }}
                    >
                      <Text style={{ color: colors.primaryBg, fontSize: 11, fontWeight: "800" }}>
                        {pendingAttendance.length + pendingReports.length}
                      </Text>
                    </View>
                  </Pressable>
                ) : null}
                {pendingReports.length > 0 ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>
                      💡 Dica: Envie lembretes aos professores sobre relatórios pendentes usando o menu de comunicados.
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Chamadas pendentes
            </Text>
            {loading ? (
              <Text style={{ color: colors.muted }}>Carregando...</Text>
            ) : pendingAttendance.length === 0 ? (
              <Text style={{ color: colors.muted }}>Nenhuma turma com chamada pendente.</Text>
            ) : (
              <FlatList
                data={pendingAttendance}
                keyExtractor={(item) => `${item.classId}_${item.targetDate}`}
                scrollEnabled={false}
                initialNumToRender={10}
                windowSize={6}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/class/[id]/attendance",
                        params: { id: item.classId, date: item.targetDate },
                      })
                    }
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{item.className}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {item.unit || "Sem unidade"} • {item.studentCount} alunos • {formatDateBr(item.targetDate)}
                    </Text>
                  </Pressable>
                )}
              />
            )}
          </View>

          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              Relatórios pendentes
            </Text>
            {loading ? (
              <Text style={{ color: colors.muted }}>Carregando...</Text>
            ) : pendingReports.length === 0 ? (
              <Text style={{ color: colors.muted }}>Nenhuma turma sem relatório recente.</Text>
            ) : (
              <FlatList
                data={pendingReports}
                keyExtractor={(item) => `${item.classId}_${item.periodStart}`}
                scrollEnabled={false}
                initialNumToRender={10}
                windowSize={6}
                contentContainerStyle={{ gap: 8 }}
                renderItem={({ item }) => {
                  const daysSinceReport = item.lastReportAt
                    ? Math.floor(
                        (Date.now() - new Date(item.lastReportAt).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : 999;
                  const isCritical = daysSinceReport > 7;
                  const cardBorderColor = isCritical ? colors.dangerBorder : colors.border;
                  const cardBackgroundColor = isCritical ? colors.dangerBg : colors.secondaryBg;
                  const titleColor = isCritical ? colors.dangerText : colors.text;
                  const subtitleColor = isCritical ? colors.dangerText : colors.muted;

                  return (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/class/[id]/session",
                          params: {
                            id: item.classId,
                            tab: "relatório",
                            date: item.periodStart,
                          },
                        })
                      }
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: cardBorderColor,
                        backgroundColor: cardBackgroundColor,
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
                        <Text style={{ color: titleColor, fontWeight: "700", flex: 1 }}>
                          {item.className}
                        </Text>
                        {isCritical ? (
                          <View
                            style={{
                              paddingVertical: 3,
                              paddingHorizontal: 7,
                              borderRadius: 999,
                              backgroundColor: colors.dangerSolidBg,
                            }}
                          >
                            <Text style={{ color: colors.primaryText, fontSize: 10, fontWeight: "800" }}>
                              {daysSinceReport}d
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={{ color: subtitleColor, fontSize: 12 }}>
                        {item.unit || "Sem unidade"} • Último: {formatDateTimeBr(item.lastReportAt)}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
