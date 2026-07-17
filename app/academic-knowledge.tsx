import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackTitleHeader } from "../src/components/ui/BackTitleHeader";
import {
  canManageGlobalAcademicKnowledge,
  listGlobalAcademicCuratorInventory,
  publishGlobalAcademicCandidate,
  saveGlobalAcademicCandidate,
  setGlobalAcademicCandidateStatus,
  type GlobalAcademicCuratorItem,
} from "../src/db/academic-knowledge";
import { useAppTheme } from "../src/ui/app-theme";
import { Pressable } from "../src/ui/Pressable";

const statusLabel: Record<string, string> = {
  ready: "Pronto para curadoria",
  review_required: "Revisão documental necessária",
  failed: "Falha na extração",
  pending: "Processando",
  awaiting_review: "Síntese em revisão",
  published: "Publicado",
  published_outdated: "Publicado · nova revisão disponível",
  superseded: "Substituído",
  withdrawn: "Retirado",
  blocked: "Bloqueado",
};

export default function AcademicKnowledgeScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<GlobalAcademicCuratorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [selected, setSelected] = useState<GlobalAcademicCuratorItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [venue, setVenue] = useState("");
  const [doi, setDoi] = useState("");
  const [claim, setClaim] = useState("");
  const [application, setApplication] = useState("");
  const [limitations, setLimitations] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const canManage = await canManageGlobalAcademicKnowledge();
      setAllowed(canManage);
      setItems(canManage ? await listGlobalAcademicCuratorInventory() : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = useMemo(
    () => ({
      ready: items.filter((item) => item.extractionStatus === "ready").length,
      pending: items.filter((item) => item.extractionStatus === "review_required").length,
      published: items.filter((item) =>
        ["published", "published_outdated"].includes(item.publicationStatus ?? ""),
      ).length,
    }),
    [items],
  );

  const choose = (item: GlobalAcademicCuratorItem) => {
    setSelected(item);
    setTitle(item.title ?? item.filename.replace(/\.[^.]+$/, ""));
    setAuthors("");
    setYear("");
    setVenue("");
    setDoi("");
    setClaim("");
    setApplication("");
    setLimitations("");
  };

  const save = async () => {
    if (!selected || !title.trim() || !claim.trim() || !application.trim()) {
      Alert.alert("Curadoria", "Preencha título, síntese e aplicação prática.");
      return;
    }
    setBusy(true);
    try {
      const authorList = authors.split(";").map((value) => value.trim()).filter(Boolean);
      await saveGlobalAcademicCandidate({
        sourceRevisionId: selected.sourceRevisionId,
        candidate: {
          title: title.trim(),
          authors: authorList,
          publicationYear: year.trim() ? Number(year) : undefined,
          publicationVenue: venue.trim() || undefined,
          doi: doi.trim() || undefined,
          claim: claim.trim(),
          practicalApplication: application.trim(),
          limitations: limitations.split("\n").map((value) => value.trim()).filter(Boolean),
          citationLabel:
            authorList.length && year.trim()
              ? `${authorList[0]} (${year.trim()})`
              : title.trim(),
          materialType: selected.materialType,
          evidenceLevel: selected.evidenceLevel,
          classificationConfidence: 1,
        },
      });
      await reload();
      setSelected(null);
      Alert.alert("Curadoria", "Síntese salva para revisão.");
    } catch {
      Alert.alert("Curadoria", "Não foi possível salvar a síntese.");
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (
    item: GlobalAcademicCuratorItem,
    action: "publish" | "withdrawn" | "blocked",
  ) => {
    if (!item.interpretationId) return;
    setBusy(true);
    try {
      if (action === "publish") {
        await publishGlobalAcademicCandidate(item.interpretationId);
      } else {
        await setGlobalAcademicCandidateStatus(item.interpretationId, action);
      }
      await reload();
    } catch {
      Alert.alert("Curadoria", "Não foi possível atualizar a publicação.");
    } finally {
      setBusy(false);
    }
  };

  const fieldStyle = {
    color: colors.text,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 1200, alignSelf: "center", padding: 16, gap: 16 }}>
        <BackTitleHeader title="Base pedagógica do GoAtleta" onBack={() => router.replace("/profile")} />
        {loading ? <ActivityIndicator color={colors.text} /> : null}
        {!loading && !allowed ? (
          <Text style={{ color: colors.muted }}>Esta área está disponível somente para curadores autorizados.</Text>
        ) : null}
        {allowed ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[
                `${counts.ready} prontos`,
                `${counts.pending} com revisão pendente`,
                `${counts.published} publicados`,
              ].map((label) => (
                <View key={label} style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6 }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={{ gap: 8 }}>
              {items.map((item) => (
                <View key={item.sourceRevisionId} style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 12, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{item.filename}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {statusLabel[item.publicationStatus ?? item.extractionStatus] ?? item.extractionStatus}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {item.extractionStatus === "ready" && !item.publicationStatus ? (
                      <Pressable onPress={() => choose(item)} style={{ padding: 8 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>Criar síntese</Text>
                      </Pressable>
                    ) : null}
                    {item.publicationStatus === "awaiting_review" ? (
                      <Pressable disabled={busy} onPress={() => void changeStatus(item, "publish")} style={{ padding: 8 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>Publicar</Text>
                      </Pressable>
                    ) : null}
                    {["published", "published_outdated"].includes(item.publicationStatus ?? "") ? (
                      <>
                        <Pressable disabled={busy} onPress={() => void changeStatus(item, "withdrawn")} style={{ padding: 8 }}>
                          <Text style={{ color: colors.text }}>Retirar</Text>
                        </Pressable>
                        <Pressable disabled={busy} onPress={() => void changeStatus(item, "blocked")} style={{ padding: 8 }}>
                          <Text style={{ color: colors.dangerSolidBg }}>Bloquear</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
            {selected ? (
              <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 }}>
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>Síntese acadêmica</Text>
                {[
                  ["Título", title, setTitle],
                  ["Autores separados por ponto e vírgula", authors, setAuthors],
                  ["Ano", year, setYear],
                  ["Periódico, evento ou editora", venue, setVenue],
                  ["DOI", doi, setDoi],
                  ["Síntese original", claim, setClaim],
                  ["Aplicação prática", application, setApplication],
                  ["Limitações, uma por linha", limitations, setLimitations],
                ].map(([label, value, setter]) => (
                  <View key={label as string} style={{ gap: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: "600" }}>{label as string}</Text>
                    <TextInput
                      value={value as string}
                      onChangeText={setter as (text: string) => void}
                      multiline={(label as string).includes("Síntese") || (label as string).includes("Aplicação") || (label as string).includes("Limitações")}
                      style={fieldStyle}
                    />
                  </View>
                ))}
                <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
                  <Pressable onPress={() => setSelected(null)} style={{ padding: 10 }}>
                    <Text style={{ color: colors.text }}>Cancelar</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => void save()} style={{ padding: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>{busy ? "Salvando..." : "Salvar para revisão"}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </>
        ) : null}
        {Platform.OS !== "web" ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>A curadoria é administrada na versão web.</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
