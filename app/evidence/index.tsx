import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    evidenceApproveStudies,
    evidenceSearchPubMed,
    evidenceSummarizeStudies,
    type EvidenceStudy,
    type EvidenceSummary,
} from "../../src/api/evidence";
import { useRole } from "../../src/auth/role";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { Button } from "../../src/ui/Button";
import { Pressable } from "../../src/ui/Pressable";
import { useAppTheme } from "../../src/ui/app-theme";

export default function EvidenceScreen() {
  const { colors } = useAppTheme();
  const { role } = useRole();
  const { activeOrganizationId, activeOrganization } = useOrganization();

  const [query, setQuery] = useState("periodização vôlei juvenil força potência");
  const [question, setQuestion] = useState("Quais ações práticas para microciclo semanal?");
  const [studies, setStudies] = useState<EvidenceStudy[]>([]);
  const [selectedPmids, setSelectedPmids] = useState<string[]>([]);
  const [summary, setSummary] = useState<EvidenceSummary | null>(null);
  const [busyAction, setBusyAction] = useState<"search" | "summarize" | "approve" | null>(null);
  const [feedback, setFeedback] = useState("");

  const isAdmin = Number(activeOrganization?.role_level ?? 0) >= 50;

  const selectedStudies = useMemo(() => {
    const selectedSet = new Set(selectedPmids);
    return studies.filter((study) => selectedSet.has(study.pmid));
  }, [selectedPmids, studies]);

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
      const result = await evidenceSearchPubMed({
        query: query.trim(),
        organizationId: activeOrganizationId,
        maxResults: 8,
      });
      setStudies(result);
      setSelectedPmids(result.slice(0, 3).map((study) => study.pmid));
      setSummary(null);
      setFeedback(result.length ? `${result.length} estudo(s) encontrados.` : "Nenhum estudo encontrado.");
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
      const result = await evidenceSummarizeStudies({
        organizationId: activeOrganizationId,
        studies: selectedStudies,
        question,
      });
      setSummary(result);
      setFeedback("Resumo científico gerado.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar resumo.";
      setFeedback(message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async () => {
    if (busyAction) return;
    if (!activeOrganizationId) {
      setFeedback("Selecione uma organização ativa antes de aprovar.");
      return;
    }
    if (!selectedStudies.length || !summary) {
      setFeedback("Busque, selecione estudos e gere um resumo antes de aprovar.");
      return;
    }

    setBusyAction("approve");
    setFeedback("");

    try {
      const result = await evidenceApproveStudies({
        organizationId: activeOrganizationId,
        studies: selectedStudies,
        summary,
        sport: "volleyball",
        level: "youth",
      });
      setFeedback(`${result.approvedCount} documento(s) aprovados e enviados ao KB.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao aprovar evidência.";
      setFeedback(message);
    } finally {
      setBusyAction(null);
    }
  };

  if (role !== "trainer") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 36 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
            Evidências científicas
          </Text>
          <Text style={{ color: colors.muted }}>
            Buscar no PubMed, gerar síntese e aprovar para a base interna.
          </Text>
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
          {studies.map((study) => {
            const selected = selectedPmids.includes(study.pmid);
            return (
              <Pressable
                key={study.pmid}
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
            label={`Gerar síntese (${selectedStudies.length} selecionados)`}
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
          disabled={!isAdmin || !summary || !selectedStudies.length}
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
