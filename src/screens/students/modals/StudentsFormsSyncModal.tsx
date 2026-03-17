import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";

import { useAuth } from "../../../auth/auth";
import { buildAthleteIntakeSummary, mapGoogleFormsRowToAthleteIntake } from "../../../core/athlete-intake";
import type { ClassGroup } from "../../../core/models";
import { syncGoogleFormsAthleteIntakes } from "../../../db/seed";
import {
    applyStudentsSync,
    previewStudentsSync,
    type StudentImportFunctionResult,
} from "../../../services/students-sync-service";
import { useAppTheme } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import { loadGoogleFormsSheetImport, type LoadedGoogleFormsSheet } from "../google-forms-sync";

type StudentsFormsSyncModalProps = {
  visible: boolean;
  organizationId: string | null;
  classes: ClassGroup[];
  onClose: () => void;
  onImportApplied?: () => void;
};

export function StudentsFormsSyncModal({
  visible,
  organizationId,
  classes,
  onClose,
  onImportApplied,
}: StudentsFormsSyncModalProps) {
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const cardStyle = useModalCardStyle({
    maxWidth: 560,
    maxHeight: "82%",
    padding: 16,
    radius: 20,
  });

  const [sheetUrl, setSheetUrl] = useState("");
  const [loadedSheet, setLoadedSheet] = useState<LoadedGoogleFormsSheet | null>(null);
  const [previewResult, setPreviewResult] = useState<StudentImportFunctionResult | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  const summary = previewResult?.summary ?? null;
  const canApply = Boolean(summary && summary.create + summary.update > 0 && loadedSheet);
  const conflictRows = useMemo(
    () => (previewResult?.rows ?? []).filter((row) => row.action === "conflict" || row.action === "error"),
    [previewResult]
  );

  const summaryCards = useMemo(
    () =>
      summary
        ? [
            { label: "Criar", value: summary.create },
            { label: "Atualizar", value: summary.update },
            { label: "Conflitos", value: summary.conflict },
            { label: "Ignorar", value: summary.skip },
          ]
        : [],
    [summary]
  );

  const intakePreview = useMemo(() => {
    if (!loadedSheet?.rawRows?.length) return null;
    const intakes = loadedSheet.rawRows
      .map((row) => mapGoogleFormsRowToAthleteIntake(row))
      .filter((item) => item.fullName.trim().length > 0);
    if (!intakes.length) return null;
    const summaryData = buildAthleteIntakeSummary(intakes);
    return {
      total: summaryData.total,
      volleyballAny: summaryData.volleyballAny,
      volleyballOnly: summaryData.volleyballOnly,
      multiModality: summaryData.multiModality,
      cardioRisk: summaryData.cardioRisk,
      orthoRisk: summaryData.orthoRisk,
      currentInjury: summaryData.currentInjury,
      needsMedicalClearance: summaryData.needsMedicalClearance,
      needsIndividualAttention: summaryData.needsIndividualAttention,
      apto: intakes.filter((item) => item.riskStatus === "apto").length,
      atencao: intakes.filter((item) => item.riskStatus === "atencao").length,
      revisar: intakes.filter((item) => item.riskStatus === "revisar").length,
    };
  }, [loadedSheet]);

  const intakePreviewCards = useMemo(
    () =>
      intakePreview
        ? [
            { label: "Total", value: intakePreview.total },
            { label: "Apto", value: intakePreview.apto },
            { label: "Atenção", value: intakePreview.atencao },
            { label: "Revisar", value: intakePreview.revisar },
            { label: "Liberação médica", value: intakePreview.needsMedicalClearance },
            { label: "Acompanhamento", value: intakePreview.needsIndividualAttention },
            { label: "Multi-modalidade", value: intakePreview.multiModality },
            { label: "Vôlei (qualquer)", value: intakePreview.volleyballAny },
            { label: "Vôlei (somente)", value: intakePreview.volleyballOnly },
          ]
        : [],
    [intakePreview]
  );

  const resetFeedback = useCallback(() => {
    setFlowError(null);
    setPreviewResult(null);
    setLoadedSheet(null);
  }, []);

  const handlePreview = useCallback(async () => {
    if (!organizationId) {
      Alert.alert("Sincronizar Forms", "Selecione uma organizacao ativa.");
      return;
    }

    try {
      setFlowError(null);
      setLoadingMessage("Lendo planilha do Google Sheets...");
      const loaded = await loadGoogleFormsSheetImport(sheetUrl);
      setLoadedSheet(loaded);
      setLoadingMessage("Gerando previa da sincronizacao...");
      const preview = await previewStudentsSync({
        organizationId,
        policy: "misto",
        sourceFilename: loaded.sourceFilename,
        rows: loaded.rows,
        accessToken: session?.access_token ?? null,
      });
      setPreviewResult(preview);
      setLoadingMessage(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao sincronizar planilha.";
      setFlowError(message);
      setLoadingMessage(null);
      setPreviewResult(null);
      setLoadedSheet(null);
    }
  }, [organizationId, sheetUrl]);

  const handleApply = useCallback(() => {
    if (!organizationId || !loadedSheet || !previewResult) return;

    Alert.alert(
      "Aplicar sincronizacao",
      "Confirmar importacao das respostas do Forms para alunos?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Aplicar",
          onPress: async () => {
            setApplyLoading(true);
            try {
              const result = await applyStudentsSync({
                organizationId,
                policy: "misto",
                sourceFilename: loadedSheet.sourceFilename,
                runId: previewResult.runId,
                accessToken: session?.access_token ?? null,
              });
              const intakeResult = await syncGoogleFormsAthleteIntakes({
                organizationId,
                rawRows: loadedSheet.rawRows,
                classes,
              });
              Alert.alert(
                "Sincronizacao concluida",
                `Alunos: C:${result.summary.create} U:${result.summary.update} X:${result.summary.conflict} S:${result.summary.skip} E:${result.summary.error}\nAnamnese: C:${intakeResult.created} U:${intakeResult.updated} V:${intakeResult.matchedStudents} T:${intakeResult.linkedClasses} Sug:${intakeResult.suggestedClasses}`
              );
              onImportApplied?.();
              onClose();
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Falha ao aplicar sincronizacao.";
              setFlowError(message);
              Alert.alert("Sincronizar Forms", message);
            } finally {
              setApplyLoading(false);
            }
          },
        },
      ]
    );
  }, [classes, loadedSheet, onClose, onImportApplied, organizationId, previewResult, session?.access_token]);

  return (
    <ModalSheet visible={visible} onClose={onClose} cardStyle={cardStyle} position="center">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
            Sincronizar Forms
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Cole o link do Google Sheets para gerar preview e importar alunos e anamnese sem baixar arquivo.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Turmas na organizacao: {classes.length}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ marginTop: 12, maxHeight: 480 }}>
        <ScrollView showsVerticalScrollIndicator nestedScrollEnabled contentContainerStyle={{ gap: 10 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.background,
              padding: 12,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
              Link da planilha
            </Text>
            <TextInput
              value={sheetUrl}
              onChangeText={(value) => {
                setSheetUrl(value);
                resetFeedback();
              }}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              placeholderTextColor={colors.muted}
              style={{
                minHeight: 96,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.card,
                color: colors.text,
                paddingHorizontal: 12,
                paddingVertical: 10,
                textAlignVertical: "top",
              }}
              multiline
            />
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              Aceita o link de edicao do Google Sheets ou apenas o ID da planilha.
            </Text>
            <Button
              label={loadingMessage ? loadingMessage : "Gerar preview da sincronizacao"}
              variant="outline"
              onPress={() => void handlePreview()}
              loading={Boolean(loadingMessage)}
            />
          </View>

          {flowError ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.dangerSolidBg,
                borderRadius: 12,
                backgroundColor: colors.dangerBg,
                padding: 10,
                gap: 4,
              }}
            >
              <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>
                Falha ao ler planilha
              </Text>
              <Text style={{ color: colors.dangerText, fontSize: 12 }}>{flowError}</Text>
            </View>
          ) : null}

          {loadedSheet ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
                padding: 12,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                Planilha conectada
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Sheet ID: {loadedSheet.sheetId}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Linhas validas para importacao: {loadedSheet.rows.length}
              </Text>
            </View>
          ) : null}

          {summary ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                Preview da sincronizacao
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {summaryCards.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      minWidth: 92,
                      flexGrow: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      gap: 2,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{item.label}</Text>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Total de respostas processadas: {summary.totalRows}
              </Text>
              <Button
                label="Aplicar sincronizacao"
                variant="success"
                onPress={handleApply}
                loading={applyLoading}
                disabled={!canApply}
              />
            </View>
          ) : null}

          {conflictRows.length ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                Conflitos para revisar ({conflictRows.length})
              </Text>
              {conflictRows.slice(0, 15).map((row) => (
                <View
                  key={`${row.rowNumber}-${row.action}-${row.flags?.join("-") ?? "none"}`}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    backgroundColor: colors.card,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    gap: 2,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Linha {row.rowNumber} - {row.action === "error" ? "erro" : "conflito"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {row.errorMessage || (row.flags?.length ? row.flags.join(", ") : "Revisao manual recomendada")}
                  </Text>
                </View>
              ))}
              {conflictRows.length > 15 ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Mostrando 15 de {conflictRows.length} conflitos.
                </Text>
              ) : null}
            </View>
          ) : null}

          {intakePreview ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                backgroundColor: colors.background,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>
                Preview da anamnese
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {intakePreviewCards.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      minWidth: 108,
                      flexGrow: 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      gap: 2,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{item.label}</Text>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Risco cardio: {intakePreview.cardioRisk} | Risco ortopédico: {intakePreview.orthoRisk} | Lesão atual: {intakePreview.currentInjury}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </ModalSheet>
  );
}
