import { markRender, measureAsync } from "../../src/observability/perf";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../../src/ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    evidenceApproveStudies,
    evidenceSearchPubMed,
    evidenceSummarizeStudies,
    type EvidenceStudy,
    type EvidenceSummary,
} from "../../src/api/evidence";
import { useRole } from "../../src/auth/role";
import { useOrganization } from "../../src/providers/organization-context";
import { Button } from "../../src/ui/Button";
import { Pressable } from "../../src/ui/Pressable";
import { useAppTheme } from "../../src/ui/app-theme";
import { useResponsiveLayout } from "../../src/ui/use-responsive-layout";
import { useOptionalCopilotOpen } from "../../src/copilot/CopilotProvider";
import { usesEvidenceAssistantButton } from "../../src/copilot/route-visibility";
import { GoAtletaIcon } from "../../src/ui/icon-registry";
import { compactUiMetrics } from "../../src/theme/tokens";
import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { useTrainerRouteScope } from "../../src/navigation/use-trainer-route-scope";

const styles = StyleSheet.create({
  assistantAction: {
    width: 44,
    height: 44,
    borderRadius: 22,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});

const reviewKey = (organizationId: string | null | undefined, question: string, studies: EvidenceStudy[]) =>
  JSON.stringify([organizationId, question.trim(), studies.map(study => study.pmid).sort()]);

export default function EvidenceScreen() {
  markRender("screen.evidence.render.root");
  const { colors } = useAppTheme();
  const studyTitleStyle = useMemo(() => ({ color: colors.muted }), [colors.muted]);
  const pathname = usePathname();
  const router = useRouter();
  const trainerRoutes = useTrainerRouteScope();
  const { width } = useWindowDimensions();
  const openAssistant = useOptionalCopilotOpen();
  const assistantHeaderAction = openAssistant && usesEvidenceAssistantButton(pathname, width) ? (
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir Assistente de Evidências" onPress={openAssistant}
      style={styles.assistantAction}>
      <GoAtletaIcon name="chat" size={compactUiMetrics.iconSize} color={colors.muted} />
    </Pressable>
  ) : null;
  const responsiveLayout = useResponsiveLayout();
  const { role } = useRole();
  const { activeOrganizationId, activeOrganization } = useOrganization();

  const [query, setQuery] = useState("periodização vôlei juvenil força potência");
  const [question, setQuestion] = useState("Quais ações práticas para microciclo semanal?");
  const [studies, setStudies] = useState<EvidenceStudy[]>([]);
  const [selectedPmids, setSelectedPmids] = useState<string[]>([]);
  const [review, setReview] = useState<{ key: string; summary: EvidenceSummary; studyTitles: string[] } | null>(null);
  const [busyAction, setBusyAction] = useState<"search" | "summarize" | "approve" | null>(null);
  const [feedback, setFeedback] = useState("");

  const isAdmin = Number(activeOrganization?.role_level ?? 0) >= 50;

  const selectedStudies = useMemo(() => {
    const selectedSet = new Set(selectedPmids);
    return studies.filter((study) => selectedSet.has(study.pmid));
  }, [selectedPmids, studies]);
  const currentReviewKey = reviewKey(activeOrganizationId, question, selectedStudies);
  const reviewIsCurrent = review?.key === currentReviewKey;
  const summary = review?.summary;

  const toggleSelection = (pmid: string) => {
    setSelectedPmids((current) =>
      current.includes(pmid)
        ? current.filter((value) => value !== pmid)
        : [...current, pmid]
    );
  };

  const handleSearch = async () => {
    if (busyAction) return;
    if (!query.trim()) {
      setFeedback("Digite um termo de busca.");
      return;
    }

    setBusyAction("search");
    setFeedback("");

    try {
      const result = await measureAsync("screen.evidence.action.search", () => evidenceSearchPubMed({
        query: query.trim(),
        organizationId: activeOrganizationId,
        maxResults: 8,
      }));
      setStudies(result);
      setSelectedPmids(result.slice(0, 3).map((study) => study.pmid));
      setReview(null);
      setFeedback(result.length ? `${result.length} estudos encontrados. Os primeiros resultados foram sugeridos na seleção.` : "Nenhum estudo encontrado. Tente ajustar o termo da busca.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na busca PubMed.";
      setFeedback(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSummarize = async () => {
    if (busyAction) return;
    if (!selectedStudies.length) {
      setFeedback("Selecione ao menos 1 estudo para resumir.");
      return;
    }

    setBusyAction("summarize");
    setFeedback("");

    try {
      const result = await measureAsync("screen.evidence.action.summarize", () => evidenceSummarizeStudies({
        organizationId: activeOrganizationId,
        studies: selectedStudies,
        question,
      }));
      setReview({ key: currentReviewKey, summary: result, studyTitles: selectedStudies.map(study => study.title) });
      setFeedback("Resumo científico gerado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar resumo.";
      setFeedback(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async () => {
    if (busyAction || !isAdmin) return;
    if (!activeOrganizationId) {
      setFeedback("Selecione uma organização ativa antes de aprovar.");
      return;
    }
    if (!selectedStudies.length || !summary || !reviewIsCurrent) {
      setFeedback("Gere uma síntese para a pergunta e os estudos selecionados.");
      return;
    }

    setBusyAction("approve");
    setFeedback("");

    try {
      const result = await measureAsync("screen.evidence.action.approve", () => evidenceApproveStudies({
        organizationId: activeOrganizationId,
        studies: selectedStudies,
        summary,
        sport: "volleyball",
        level: "youth",
      }));
      setFeedback(`${result.approvedCount} documento(s) aprovados e enviados ao KB.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao aprovar evidência.";
      setFeedback(message);
    } finally {
      setBusyAction(null);
    }
  };

  const contentWidth = Math.min(responsiveLayout.maxContentWidth, 960) + responsiveLayout.gutter * 2;
  const pageHeader = (
    <ScreenPageHeader
      title="Evidências científicas"
      onBack={() => navigateBackOrReplace({ router, fallback: role === "trainer" ? trainerRoutes.home : "/" })}
      horizontalBleed={0}
      contentStyle={{ width: "100%", maxWidth: contentWidth, alignSelf: "center", paddingHorizontal: responsiveLayout.gutter }}
      right={assistantHeaderAction}
    />
  );

  if (role !== "trainer") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {pageHeader}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
            Acesso restrito
          </Text>
          <Text style={{ color: colors.muted, marginTop: 8, textAlign: "center" }}>
            Esta área está disponível somente para treinadores.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {pageHeader}
      <ScrollView
        contentContainerStyle={{ width: "100%", maxWidth: contentWidth, alignSelf: "center", padding: responsiveLayout.gutter, gap: responsiveLayout.density.pageGap, paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ color: colors.muted }}>
          Buscar no PubMed, gerar síntese e aprovar para a base interna.
        </Text>

        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 12,
            gap: 10,
          }}
        >
          <TextInput
            accessibilityLabel="Buscar estudos no PubMed"
            value={query}
            onChangeText={setQuery}
            placeholder="Ex.: volleyball youth training load"
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
          <Button
            label="Buscar no PubMed"
            onPress={handleSearch}
            loading={busyAction === "search"}
            disabled={!query.trim()}
          />
        </View>

        <View style={{ gap: 8 }}>
          {selectedStudies.length ? (
            <View style={{ alignItems: "flex-start" }}>
              <Button label="Limpar seleção" variant="outline" onPress={() => setSelectedPmids([])} />
            </View>
          ) : null}
          {studies.map((study) => {
            const selected = selectedPmids.includes(study.pmid);
            return (
              <Pressable
                key={study.pmid}
                accessibilityRole="checkbox"
                aria-checked={selected}
                onPress={() => toggleSelection(study.pmid)}
                style={{
                  borderWidth: 1,
                  borderColor: selected ? colors.primaryBg : colors.border,
                  backgroundColor: colors.card,
                  borderRadius: 14,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>{study.title}</Text>
                <Text style={{ color: colors.muted }}>
                  {study.journal || "Periódico não informado"}
                  {study.publishedAt ? ` • ${study.publishedAt}` : ""}
                </Text>
                <Text style={{ color: colors.muted }} numberOfLines={2}>
                  {study.abstract || "Sem abstract disponível."}
                </Text>
                <Text style={{ color: selected ? colors.primaryBg : colors.muted }}>
                  {selected ? "Selecionado" : "Toque para selecionar"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            borderRadius: 16,
            padding: 12,
            gap: 10,
          }}
        >
          <TextInput
            accessibilityLabel="Pergunta da síntese"
            value={question}
            onChangeText={setQuestion}
            placeholder="Pergunta da síntese"
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
          <Button
            label={`${summary && !reviewIsCurrent ? "Gerar nova síntese" : "Gerar síntese"} (${selectedStudies.length})`}
            onPress={handleSummarize}
            loading={busyAction === "summarize"}
            disabled={!selectedStudies.length}
          />
        </View>

        {summary ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              borderRadius: 16,
              padding: 12,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
              {summary.headline}
            </Text>
            {!reviewIsCurrent ? <Text accessibilityLiveRegion="polite" style={{ color: colors.warningText }}>
              A seleção ou a pergunta mudou. Gere uma nova síntese para aprovar.
            </Text> : null}
            <Text style={{ color: colors.text, fontWeight: "700" }}>Estudos desta síntese</Text>
            {review?.studyTitles.map((title, index) => (
              <Text key={`${index}:${title}`} style={studyTitleStyle}>{title}</Text>
            ))}
            <Text style={{ color: colors.muted }}>
              Confiança: {summary.confidence.toUpperCase()}
            </Text>
            {summary.practicalTakeaways.map((item, index) => (
              <Text key={`takeaway-${index}`} style={{ color: colors.text }}>
                • {item}
              </Text>
            ))}
            <Text style={{ color: colors.muted }}>
              Limitações: {summary.limitations.join(" | ")}
            </Text>
            <Text style={{ color: colors.muted }}>
              Tags sugeridas: {summary.suggestedTags.join(", ") || "n/a"}
            </Text>
          </View>
        ) : null}

        <Button
          label={isAdmin ? "Aprovar e publicar no KB" : "Aprovação exige admin"}
          onPress={handleApprove}
          loading={busyAction === "approve"}
          disabled={!isAdmin || !reviewIsCurrent || !selectedStudies.length || Boolean(busyAction)}
        />

        {feedback ? (
          <Text style={{ color: colors.muted }}>{feedback}</Text>
        ) : null}

        {busyAction && studies.length === 0 ? (
          <View style={{ paddingVertical: 20, alignItems: "center" }}>
            <ActivityIndicator color={colors.primaryBg} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
