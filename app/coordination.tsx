import { useFocusEffect } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    AdminPendingAttendance,
    AdminPendingSessionLogs,
    AdminRecentActivity,
    listAdminPendingAttendance,
    listAdminPendingSessionLogs,
    listAdminRecentActivity,
} from "../src/api/reports";
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
  import { useSmartSync } from "../src/core/use-smart-sync";
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
                        </View>
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
