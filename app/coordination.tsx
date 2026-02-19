import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import {
    cacheDirectory,
    documentDirectory,
    EncodingType,
    writeAsStringAsync,
} from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { memo, useCallback, useMemo, useState } from "react";
import { Platform, RefreshControl, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    classifySyncError,
    generateExecutiveSummary,
    suggestDataFixes,
    type DataFixIssue,
    type DataFixSuggestionsResult,
    type ExecutiveSummaryResult,
    type SyncErrorClassificationResult,
} from "../src/api/ai";
import {
    AdminPendingAttendance,
    AdminPendingSessionLogs,
    AdminRecentActivity,
    listAdminPendingAttendance,
    listAdminPendingSessionLogs,
    listAdminRecentActivity,
} from "../src/api/reports";
import {
    buildNextClassSuggestion,
    type NextClassSuggestion,
} from "../src/core/intelligence/suggestion-engine";
import { useSmartSync } from "../src/core/use-smart-sync";
import {
    clearPendingWritesDeadLetterCandidates,
    exportSyncHealthReportJson,
    flushPendingWrites,
    getClasses,
    getPendingWritePayloadById,
    getPendingWritesDiagnostics,
    getSessionLogsByRange,
    listPendingWriteFailures,
    reprocessPendingWriteById,
    reprocessPendingWritesNetworkFailures,
    type PendingWriteFailureRow,
    type PendingWritesDiagnostics,
} from "../src/db/seed";
import { CoordinationAiDocument } from "../src/pdf/coordination-ai-document";
import { exportPdf, safeFileName } from "../src/pdf/export-pdf";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { AuditPanel } from "../src/screens/coordination/AuditPanel";
import { ClassRadarPanel, type ClassRadarItem } from "../src/screens/coordination/ClassRadarPanel";
import { ConsistencyPanel } from "../src/screens/coordination/ConsistencyPanel";
import { OrgMembersPanel } from "../src/screens/coordination/OrgMembersPanel";
import { SyncSupportPanel } from "../src/screens/coordination/SyncSupportPanel";
import {
  useCopilot,
  useCopilotActions,
  useCopilotContext,
} from "../src/copilot/CopilotProvider";
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
  dataFixSuggestions: DataFixSuggestionsResult | null;
}) : AiExportBundle | null => {
  const { organizationName, executiveSummary, dataFixSuggestions } = params;
  if (!executiveSummary && !dataFixSuggestions) return null;

  const generatedAt = new Date().toLocaleString("pt-BR");
  const sections: { heading: string; body: string }[] = [];

  if (executiveSummary) {
    sections.push({ heading: "Resumo Executivo", body: formatExecutiveSummaryText(executiveSummary) });
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
        minWidth: 90,
        flex: 1,
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.secondaryBg,
      }}
    >
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
    </View>
  );
});

export default function CoordinationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { activeOrganization } = useOrganization();
  const { syncPausedReason, resumeSync } = useSmartSync();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const organizationId = activeOrganization?.id ?? null;
  const organizationName = activeOrganization?.name ?? "Organização";

  const [activeTab, setActiveTab] = useState<CoordinationTab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
  const [syncClassifications, setSyncClassifications] = useState<Record<string, SyncErrorClassificationResult>>({});
  const [dataFixSuggestions, setDataFixSuggestions] = useState<DataFixSuggestionsResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiExportLoading, setAiExportLoading] = useState(false);
  const [classRadarItems, setClassRadarItems] = useState<ClassRadarItem[]>([]);

  const isDesktopLayout = Platform.OS === "web" && width >= 1180;
  const isWideLayout = width >= 860;
  const isCompactLayout = width < 430;

  const tabItems = useMemo(
    () => [
      { id: "dashboard" as const, label: "Dashboard" },
      { id: "members" as const, label: "Gerenciar membros" },
    ],
    []
  );

  const topDelaysByTrainer = useMemo(
    () =>
      pendingReports.slice(0, 5).map((item) => ({
        classId: item.classId,
        className: item.className,
        unit: item.unit,
        daysWithoutReport: item.lastReportAt
          ? Math.max(
              0,
              Math.floor((Date.now() - new Date(item.lastReportAt).getTime()) / (1000 * 60 * 60 * 24))
            )
          : null,
      })),
    [pendingReports]
  );

  const criticalPendingReports = useMemo(
    () =>
      pendingReports
        .filter((item) => {
          if (!item.lastReportAt) return true;
          const days = Math.floor((Date.now() - new Date(item.lastReportAt).getTime()) / (1000 * 60 * 60 * 24));
          return days > 7;
        })
        .slice(0, 10),
    [pendingReports]
  );

  const coordinationHealthScore = useMemo(() => {
    if (loading) return null;
    const pressurePoints =
      pendingAttendance.length * 2 +
      pendingReports.length * 3 +
      pendingWritesDiagnostics.highRetry * 4 +
      failedWrites.length * 5;
    const score = Math.max(8, 100 - pressurePoints);
    return Math.min(100, score);
  }, [failedWrites.length, loading, pendingAttendance.length, pendingReports.length, pendingWritesDiagnostics.highRetry]);

  const dataFixIssues = useMemo<DataFixIssue[]>(() => {
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

    return issues;
  }, [failedWrites, pendingReports]);

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
      setSyncClassifications({});
      setDataFixSuggestions(null);
      setClassRadarItems([]);
      setAiMessage(null);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [attendanceRows, reportRows, activityRows, classes, sessionLogs] = await Promise.all([
        listAdminPendingAttendance({ organizationId }),
        listAdminPendingSessionLogs({ organizationId }),
        listAdminRecentActivity({ organizationId, limit: 12 }),
        getClasses({ organizationId }),
        getSessionLogsByRange(start.toISOString(), now.toISOString(), { organizationId }),
      ]);
      const queueDiagnostics = await getPendingWritesDiagnostics(10);
      const failed = await listPendingWriteFailures(12);
      const classesById = new Map(classes.map((item) => [item.id, item]));
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

      const logsByClass = sessionLogs.reduce<Record<string, typeof sessionLogs>>((acc, item) => {
        if (!acc[item.classId]) acc[item.classId] = [];
        acc[item.classId].push(item);
        return acc;
      }, {});

      const radarRows: ClassRadarItem[] = classes
        .map((item) => {
          const logs = logsByClass[item.id] ?? [];
          const suggestion: NextClassSuggestion = buildNextClassSuggestion({
            className: item.name,
            logs,
          });
          return {
            classId: item.id,
            className: item.name,
            unit: item.unit,
            radarScore: suggestion.radarScore,
            trendLabel: suggestion.trendLabel,
            alerts: suggestion.alerts,
            nextTrainingPrompt: suggestion.nextTrainingPrompt,
            logsCount: logs.length,
          };
        })
        .sort((a, b) => a.radarScore - b.radarScore)
        .slice(0, 6);

      setClassRadarItems(radarRows);
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
      setClassRadarItems([]);
      setAiMessage(null);
      setError(err instanceof Error ? err.message : "Falha ao carregar dados da coordenação.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
      const periodLabel = "Coordenação - últimos 7 dias";
      const summary = await generateExecutiveSummary(
        {
          periodLabel,
          syncHealth: {
            syncPausedReason,
            diagnostics: pendingWritesDiagnostics,
          },
          slaStats: {
            pendingAttendance: pendingAttendance.length,
            pendingReports: pendingReports.length,
            recentActivity: recentActivity.length,
          },
          criticalClasses: criticalPendingReports,
          pendingWritesDiagnostics,
          deadLettersRecent: failedWrites.slice(0, 10),
          topDelaysByTrainer,
        },
        {
          cache: {
            organizationId,
            periodLabel,
            ttlMs: 120_000,
          },
        }
      );

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
    criticalPendingReports,
    topDelaysByTrainer,
    failedWrites,
    pendingAttendance.length,
    pendingReports.length,
    pendingWritesDiagnostics,
    recentActivity.length,
    syncPausedReason,
    organizationId,
  ]);

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
        const classification = await classifySyncError(
          {
            error: item.lastError ?? "Erro não informado",
            payload: parsedPayload,
            orgContext: {
              organizationId,
              organizationName,
              userRole: isAdmin ? "admin" : "member",
            },
          },
          {
            cache: {
              organizationId,
              periodLabel: "Coordenação - suporte sync",
              scope: item.id,
              ttlMs: 120_000,
            },
          }
        );

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
      if (!dataFixIssues.length) {
        setAiMessage("Nenhuma inconsistência relevante para sugerir correções.");
        return;
      }

      const suggested = await suggestDataFixes(
        { issues: dataFixIssues },
        {
          cache: {
            organizationId,
            periodLabel: "Coordenação - últimos 7 dias",
            ttlMs: 120_000,
          },
        }
      );
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
  }, [dataFixIssues, organizationId]);

  const handleCopyWhatsappMessage = useCallback(async () => {
    try {
      const content =
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
  }, [executiveSummary]);

  const handleCopyRadarPrompt = useCallback(async (item: ClassRadarItem) => {
    try {
      await Clipboard.setStringAsync(item.nextTrainingPrompt);
      setAiMessage(`Prompt da turma ${item.className} copiado para o próximo treino.`);
    } catch (error) {
      setAiMessage(
        error instanceof Error
          ? `Falha ao copiar prompt da turma ${item.className}: ${error.message}`
          : `Falha ao copiar prompt da turma ${item.className}.`
      );
    }
  }, []);

  const handleExportMarkdown = useCallback(async () => {
    setAiExportLoading(true);
    try {
      const bundle = buildAiExportBundle({
        organizationName,
        executiveSummary,
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
  }, [dataFixSuggestions, executiveSummary, organizationName]);

  const handleExportPdf = useCallback(async () => {
    setAiExportLoading(true);
    try {
      const bundle = buildAiExportBundle({
        organizationName,
        executiveSummary,
        dataFixSuggestions,
      });

      if (!bundle) {
        setAiMessage("Nada para exportar. Gere os blocos de IA primeiro.");
        return;
      }

      const fileName = `${safeFileName(bundle.title)}_${safeFileName(bundle.generatedAt)}.pdf`;
      const webDocument = (
        <CoordinationAiDocument
          title={bundle.title}
          generatedAt={bundle.generatedAt}
          sections={bundle.sections}
        />
      );

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
  }, [dataFixSuggestions, executiveSummary, organizationName]);

  const { open: openCopilot, actionCount } = useCopilot();

  useCopilotContext(
    useMemo(
      () =>
        activeTab === "dashboard"
          ? {
              screen: "coordination_dashboard",
              title: "Coordenação",
              subtitle: "Assistente contextual da coordenação",
              chips: [
                { label: "Org", value: organizationName },
                { label: "Pendências", value: String(pendingAttendance.length + pendingReports.length) },
                { label: "Sync", value: String(pendingWritesDiagnostics.total) },
              ],
            }
          : {
              screen: "coordination_members",
              title: "Coordenação - membros",
              subtitle: "Gestão de membros",
              chips: [{ label: "Org", value: organizationName }],
            },
      [
        activeTab,
        organizationName,
        pendingAttendance.length,
        pendingReports.length,
        pendingWritesDiagnostics.total,
      ]
    )
  );

  const coordinationCopilotActions = useMemo(
    () =>
      activeTab !== "dashboard"
        ? []
        : [
            {
              id: "coord_exec_summary",
              title: "Gerar resumo executivo",
              description: "Atualiza visão executiva da operação e copia o texto.",
              run: async () => {
                await handleGenerateExecutiveSummary();
                return { message: "Resumo executivo atualizado." };
              },
            },
            {
              id: "coord_fix_suggestions",
              title: "Sugerir correções",
              description: "Analisa inconsistências e propõe opções de correção.",
              requires: () =>
                dataFixIssues.length ? null : "Sem inconsistências relevantes para correção neste momento.",
              run: async () => {
                await handleSuggestDataFixes();
                return { message: "Sugestões de correção atualizadas." };
              },
            },
            {
              id: "coord_whatsapp",
              title: "Copiar mensagem para WhatsApp",
              description: "Gera versão curta para comunicação rápida com a equipe.",
              requires: () =>
                executiveSummary ? null : "Gere primeiro um resumo executivo para montar a mensagem.",
              run: async () => {
                await handleCopyWhatsappMessage();
                return { message: "Mensagem para WhatsApp copiada." };
              },
            },
            {
              id: "coord_export_md",
              title: "Exportar markdown",
              description: "Exporta resumo + correções em .md.",
              requires: () =>
                executiveSummary || dataFixSuggestions
                  ? null
                  : "Gere pelo menos um bloco de IA antes de exportar.",
              run: async () => {
                await handleExportMarkdown();
                return { message: "Exportação markdown concluída." };
              },
            },
            {
              id: "coord_export_pdf",
              title: "Exportar PDF",
              description: "Gera PDF para compartilhar com a coordenação.",
              requires: () =>
                executiveSummary || dataFixSuggestions
                  ? null
                  : "Gere pelo menos um bloco de IA antes de exportar.",
              run: async () => {
                await handleExportPdf();
                return { message: "Exportação PDF concluída." };
              },
            },
          ],
    [
      activeTab,
      dataFixIssues.length,
      dataFixSuggestions,
      executiveSummary,
      handleCopyWhatsappMessage,
      handleExportMarkdown,
      handleExportPdf,
      handleGenerateExecutiveSummary,
      handleSuggestDataFixes,
    ]
  );

  useCopilotActions(coordinationCopilotActions);

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
      <View
        style={{
          paddingHorizontal: isDesktopLayout ? 20 : isCompactLayout ? 12 : 16,
          paddingTop: 12,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: isWideLayout ? 16 : isCompactLayout ? 12 : 14,
            gap: 10,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>
              Coordenação
            </Text>
            <Text style={{ color: colors.muted }}>
              Dashboard e gestão de membros da organização • {organizationName}.
            </Text>
          </View>
        </View>

        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: isCompactLayout ? 5 : 6,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", gap: 6, flexWrap: isCompactLayout ? "wrap" : "nowrap" }}>
            {tabItems.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setActiveTab(tab.id)}
                  style={{
                    flex: isCompactLayout ? undefined : 1,
                    flexGrow: isCompactLayout ? 1 : undefined,
                    minWidth: isCompactLayout ? "48%" : undefined,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 999,
                    borderWidth: selected ? 1 : 0,
                    borderColor: selected ? colors.border : "transparent",
                    backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      color: selected ? colors.primaryText : colors.text,
                      fontWeight: "700",
                      fontSize: isCompactLayout ? 12 : 13,
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
          contentContainerStyle={{
            paddingHorizontal: isDesktopLayout ? 20 : isCompactLayout ? 12 : 16,
            paddingBottom: 28,
            gap: 12,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadDashboard();
              }}
              tintColor={colors.text}
              colors={[colors.text]}
            />
          }
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
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: isWideLayout ? 16 : isCompactLayout ? 12 : 14,
              gap: 12,
            }}
          >
            <View
              style={{
                flexDirection: isWideLayout ? "row" : "column",
                justifyContent: "space-between",
                alignItems: isWideLayout ? "center" : "flex-start",
                gap: 10,
              }}
            >
              <View style={{ gap: 3 }}>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
                  Visão geral da coordenação
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Indicadores operacionais da organização {organizationName}.
                </Text>
              </View>
              <View
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>
                  SAÚDE OPERACIONAL
                </Text>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                  {coordinationHealthScore === null ? "..." : `${coordinationHealthScore}%`}
                </Text>
              </View>
            </View>

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

            <View
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                height: 12,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  height: "100%",
                  width: `${coordinationHealthScore ?? 0}%`,
                  backgroundColor: colors.primaryBg,
                }}
              />
            </View>
          </View>

          <ClassRadarPanel
            colors={colors}
            loading={loading}
            items={classRadarItems}
            onCopyPrompt={handleCopyRadarPrompt}
          />

          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 12,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "800" }}>Copilot central</Text>
            <Text style={{ color: colors.muted }}>
              {actionCount
                ? `Copilot disponível com ${actionCount} ação(ões) para esta tela.`
                : "Copilot sem ações para este contexto."}
            </Text>
            {aiMessage ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>{aiMessage}</Text>
            ) : null}
            <Pressable
              onPress={openCopilot}
              disabled={!actionCount || aiLoading || aiExportLoading}
              style={{
                alignSelf: "flex-start",
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: actionCount && !aiLoading && !aiExportLoading ? 1 : 0.6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {aiLoading || aiExportLoading ? "Executando..." : "Abrir Copilot"}
              </Text>
            </Pressable>
          </View>

          {isWideLayout ? (
            <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
              <View style={{ flex: 1.2, gap: 12 }}>
                <ConsistencyPanel
                  colors={colors}
                  loading={loading}
                  pendingAttendance={pendingAttendance}
                  pendingReports={pendingReports}
                  onOpenAttendance={({ classId, targetDate }) =>
                    router.push({
                      pathname: "/class/[id]/attendance",
                      params: { id: classId, date: targetDate },
                    })
                  }
                  onOpenReport={({ classId, periodStart }) =>
                    router.push({
                      pathname: "/class/[id]/session",
                      params: {
                        id: classId,
                        tab: "relatório",
                        date: periodStart,
                      },
                    })
                  }
                  formatDateBr={formatDateBr}
                  formatDateTimeBr={formatDateTimeBr}
                />
              </View>

              <View style={{ flex: isDesktopLayout ? 0.8 : 1, gap: 12 }}>
                <SyncSupportPanel
                  colors={colors}
                  loading={loading}
                  syncPausedReason={syncPausedReason}
                  pendingWritesDiagnostics={pendingWritesDiagnostics}
                  failedWrites={failedWrites}
                  syncActionLoading={syncActionLoading}
                  syncActionMessage={syncActionMessage}
                  aiLoading={aiLoading}
                  syncClassifications={syncClassifications}
                  onResumePausedSync={handleResumePausedSync}
                  onGoLogin={() => router.push("/login")}
                  onGoProfile={() => router.push("/profile")}
                  onReprocessQueueNow={handleReprocessQueueNow}
                  onReprocessNetworkFailures={handleReprocessNetworkFailures}
                  onClearDeadLetterCandidates={handleClearDeadLetterCandidates}
                  onExportSyncHealthJson={handleExportSyncHealthJson}
                  onReprocessSingleItem={handleReprocessSingleItem}
                  onCopyFailedPayload={handleCopyFailedPayload}
                  onClassifySyncError={handleClassifySyncError}
                />

                <AuditPanel
                  colors={colors}
                  loading={loading}
                  pendingAttendanceCount={pendingAttendance.length}
                  pendingReportsCount={pendingReports.length}
                  onOpenReports={() => router.push("/reports")}
                />
              </View>
            </View>
          ) : (
            <>
              <SyncSupportPanel
                colors={colors}
                loading={loading}
                syncPausedReason={syncPausedReason}
                pendingWritesDiagnostics={pendingWritesDiagnostics}
                failedWrites={failedWrites}
                syncActionLoading={syncActionLoading}
                syncActionMessage={syncActionMessage}
                aiLoading={aiLoading}
                syncClassifications={syncClassifications}
                onResumePausedSync={handleResumePausedSync}
                onGoLogin={() => router.push("/login")}
                onGoProfile={() => router.push("/profile")}
                onReprocessQueueNow={handleReprocessQueueNow}
                onReprocessNetworkFailures={handleReprocessNetworkFailures}
                onClearDeadLetterCandidates={handleClearDeadLetterCandidates}
                onExportSyncHealthJson={handleExportSyncHealthJson}
                onReprocessSingleItem={handleReprocessSingleItem}
                onCopyFailedPayload={handleCopyFailedPayload}
                onClassifySyncError={handleClassifySyncError}
              />

              <AuditPanel
                colors={colors}
                loading={loading}
                pendingAttendanceCount={pendingAttendance.length}
                pendingReportsCount={pendingReports.length}
                onOpenReports={() => router.push("/reports")}
              />

              <ConsistencyPanel
                colors={colors}
                loading={loading}
                pendingAttendance={pendingAttendance}
                pendingReports={pendingReports}
                onOpenAttendance={({ classId, targetDate }) =>
                  router.push({
                    pathname: "/class/[id]/attendance",
                    params: { id: classId, date: targetDate },
                  })
                }
                onOpenReport={({ classId, periodStart }) =>
                  router.push({
                    pathname: "/class/[id]/session",
                    params: {
                      id: classId,
                      tab: "relatório",
                      date: periodStart,
                    },
                  })
                }
                formatDateBr={formatDateBr}
                formatDateTimeBr={formatDateTimeBr}
              />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
