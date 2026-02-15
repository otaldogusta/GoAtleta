import { useState } from "react";
import { FlatList, Text, useWindowDimensions, View } from "react-native";

import type { SyncErrorClassificationResult } from "../../api/ai";
import {
    type PendingWriteFailureRow,
    type PendingWritesDiagnostics,
} from "../../db/seed";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";

type AppColors = ReturnType<typeof useAppTheme>["colors"];

type SyncSupportPanelProps = {
  colors: AppColors;
  loading: boolean;
  syncPausedReason: "auth" | "permission" | "org_switch" | null;
  pendingWritesDiagnostics: PendingWritesDiagnostics;
  failedWrites: PendingWriteFailureRow[];
  syncActionLoading: boolean;
  syncActionMessage: string | null;
  aiLoading: boolean;
  syncClassifications: Record<string, SyncErrorClassificationResult>;
  onResumePausedSync: () => void;
  onGoLogin: () => void;
  onGoProfile: () => void;
  onReprocessQueueNow: () => void;
  onReprocessNetworkFailures: () => void;
  onClearDeadLetterCandidates: () => void;
  onExportSyncHealthJson: () => void;
  onReprocessSingleItem: (id: string) => void;
  onCopyFailedPayload: (id: string) => void;
  onClassifySyncError: (item: PendingWriteFailureRow) => void;
};

export function SyncSupportPanel({
  colors,
  loading,
  syncPausedReason,
  pendingWritesDiagnostics,
  failedWrites,
  syncActionLoading,
  syncActionMessage,
  aiLoading,
  syncClassifications,
  onResumePausedSync,
  onGoLogin,
  onGoProfile,
  onReprocessQueueNow,
  onReprocessNetworkFailures,
  onClearDeadLetterCandidates,
  onExportSyncHealthJson,
  onReprocessSingleItem,
  onCopyFailedPayload,
  onClassifySyncError,
}: SyncSupportPanelProps) {
  const { width } = useWindowDimensions();
  const isCompactLayout = width < 430;
  const [showAdvancedSyncActions, setShowAdvancedSyncActions] = useState(false);

  const visible =
    !loading &&
    (pendingWritesDiagnostics.deadLetterCandidates > 0 ||
      pendingWritesDiagnostics.deadLetterStored > 0 ||
      syncPausedReason !== null ||
      failedWrites.length > 0);

  if (!visible) return null;

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: isCompactLayout ? 12 : 16,
        gap: isCompactLayout ? 7 : 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 }}>
          Saúde da Sincronização
        </Text>
        <View
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
            Fila crítica
          </Text>
        </View>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        {pendingWritesDiagnostics.deadLetterCandidates} item(ns) com 10+ tentativas • {pendingWritesDiagnostics.deadLetterStored} item(ns) arquivado(s) em dead-letter. Máx retry: {pendingWritesDiagnostics.maxRetry}.
      </Text>
      {syncPausedReason ? (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Sync pausado por {syncPausedReason === "auth" ? "autenticação" : syncPausedReason === "permission" ? "permissão" : "troca de organização"}.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Pressable
              onPress={onResumePausedSync}
              disabled={syncActionLoading}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.primaryBg,
                paddingHorizontal: 12,
                paddingVertical: isCompactLayout ? 7 : 8,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                Tentar novamente
              </Text>
            </Pressable>
            {syncPausedReason === "auth" ? (
              <Pressable
                onPress={onGoLogin}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 12,
                  paddingVertical: isCompactLayout ? 7 : 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  Reautenticar
                </Text>
              </Pressable>
            ) : null}
            {syncPausedReason === "permission" ? (
              <Pressable
                onPress={onGoProfile}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 12,
                  paddingVertical: isCompactLayout ? 7 : 8,
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
          onPress={onReprocessQueueNow}
          disabled={syncActionLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: syncActionLoading ? colors.secondaryBg : colors.primaryBg,
            paddingHorizontal: 12,
            paddingVertical: isCompactLayout ? 8 : 9,
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
          onPress={() => setShowAdvancedSyncActions((current) => !current)}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 12,
            paddingVertical: isCompactLayout ? 8 : 9,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            {showAdvancedSyncActions ? "Ocultar ações" : "Mais ações"}
          </Text>
        </Pressable>
      </View>

      {showAdvancedSyncActions ? (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
          <Pressable
            onPress={onReprocessNetworkFailures}
            disabled={syncActionLoading}
            style={{
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingHorizontal: 12,
              paddingVertical: isCompactLayout ? 8 : 9,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              Reprocessar falhas de rede
            </Text>
          </Pressable>
        <Pressable
          onPress={onClearDeadLetterCandidates}
          disabled={syncActionLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 12,
            paddingVertical: isCompactLayout ? 8 : 9,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Arquivar dead-letter
          </Text>
        </Pressable>
        <Pressable
          onPress={onExportSyncHealthJson}
          disabled={syncActionLoading}
          style={{
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            paddingHorizontal: 12,
            paddingVertical: isCompactLayout ? 8 : 9,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            Exportar JSON
          </Text>
        </Pressable>
        </View>
      ) : null}
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
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  padding: 12,
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
                    onPress={() => onReprocessSingleItem(item.id)}
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
                    onPress={() => onCopyFailedPayload(item.id)}
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
                    onPress={() => onClassifySyncError(item)}
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
  );
}
