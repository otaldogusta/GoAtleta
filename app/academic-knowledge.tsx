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
import { markRender, measureAsync } from "../src/observability/perf";
import {
  canManageGlobalAcademicKnowledge,
  listGlobalAcademicCuratorInventory,
  listGlobalAcademicSourceExcerpts,
  listGlobalAcademicSourceInterpretations,
  publishGlobalAcademicCandidate,
  rejectGlobalAcademicCandidate,
  saveGlobalAcademicCandidate,
  setGlobalAcademicCandidateStatus,
  updateGlobalAcademicCandidate,
  type GlobalAcademicInterpretationAdmin,
  type GlobalAcademicSourceExcerpt,
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
  rejected: "Rejeitado",
};

// perf-check: ignore-inline-row-style - lista administrativa limitada ao inventário acadêmico (até 60 itens); estilos dependem do tema ativo.
export default function AcademicKnowledgeScreen() {
  markRender("screen.academicKnowledge.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<GlobalAcademicCuratorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [selected, setSelected] = useState<GlobalAcademicCuratorItem | null>(null);
  const [editing, setEditing] = useState<GlobalAcademicInterpretationAdmin | null>(null);
  const [interpretations, setInterpretations] = useState<GlobalAcademicInterpretationAdmin[]>([]);
  const [excerpts, setExcerpts] = useState<GlobalAcademicSourceExcerpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [venue, setVenue] = useState("");
  const [doi, setDoi] = useState("");
  const [claim, setClaim] = useState("");
  const [application, setApplication] = useState("");
  const [limitations, setLimitations] = useState("");
  const [administrativeExcerpt, setAdministrativeExcerpt] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const canManage = await measureAsync(
        "screen.academicKnowledge.load.inventory",
        canManageGlobalAcademicKnowledge,
      );
      setAllowed(canManage);
      setItems(
        canManage
          ? await measureAsync(
              "screen.academicKnowledge.load.curatorItems",
              listGlobalAcademicCuratorInventory,
            )
          : [],
      );
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

  const populateForm = (
    item: GlobalAcademicCuratorItem,
    interpretation?: GlobalAcademicInterpretationAdmin,
  ) => {
    setSelected(item);
    setEditing(interpretation ?? null);
    setTitle(interpretation?.title ?? item.filename.replace(/\.[^.]+$/, ""));
    setAuthors(interpretation?.authors.join("; ") ?? "");
    setYear(interpretation?.publicationYear?.toString() ?? "");
    setVenue(interpretation?.publicationVenue ?? "");
    setDoi(interpretation?.doi ?? "");
    setClaim(interpretation?.claim ?? "");
    setApplication(interpretation?.practicalApplication ?? "");
    setLimitations(interpretation?.limitations.join("\n") ?? "");
    setAdministrativeExcerpt(interpretation?.administrativeExcerpt ?? "");
  };

  const choose = async (item: GlobalAcademicCuratorItem) => {
    setBusy(true);
    try {
      const [sourceInterpretations, sourceExcerpts] = await Promise.all([
        listGlobalAcademicSourceInterpretations(item.sourceRevisionId),
        listGlobalAcademicSourceExcerpts(item.sourceRevisionId),
      ]);
      setInterpretations(sourceInterpretations);
      setExcerpts(sourceExcerpts);
      populateForm(item);
    } catch {
      Alert.alert("Curadoria", "Não foi possível abrir a revisão privada.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selected || !title.trim() || !claim.trim() || !application.trim()) {
      Alert.alert("Curadoria", "Preencha título, síntese e aplicação prática.");
      return;
    }
    setBusy(true);
    try {
      const authorList = authors.split(";").map((value) => value.trim()).filter(Boolean);
      const candidate = {
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
          administrativeExcerpt: administrativeExcerpt.trim() || undefined,
        };
      if (editing) {
        await updateGlobalAcademicCandidate({
          interpretationId: editing.id,
          candidate,
        });
      } else {
        await saveGlobalAcademicCandidate({
          sourceRevisionId: selected.sourceRevisionId,
          candidate,
        });
      }
      await reload();
      setSelected(null);
      setEditing(null);
      Alert.alert("Curadoria", "Conhecimento atômico salvo para revisão.");
    } catch {
      Alert.alert("Curadoria", "Não foi possível salvar a síntese.");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (item: GlobalAcademicInterpretationAdmin) => {
    setBusy(true);
    try {
      await rejectGlobalAcademicCandidate(
        item.id,
        "Rejeitado explicitamente durante a curadoria piloto.",
      );
      if (selected) {
        setInterpretations(
          await listGlobalAcademicSourceInterpretations(selected.sourceRevisionId),
        );
      }
      await reload();
    } catch {
      Alert.alert("Curadoria", "Não foi possível rejeitar a síntese.");
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
                    {item.extractionStatus === "ready" ? (
                      <Pressable disabled={busy} onPress={() => void choose(item)} style={{ padding: 8 }}>
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {item.publicationStatus ? "Revisar conhecimentos" : "Criar síntese"}
                        </Text>
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
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                  Conhecimentos atômicos
                </Text>
                {interpretations.map((interpretation) => (
                  <View key={interpretation.id} style={{ gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {interpretation.claim}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {statusLabel[interpretation.publicationStatus] ?? interpretation.publicationStatus}
                    </Text>
                    {interpretation.publicationStatus === "awaiting_review" ? (
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <Pressable onPress={() => populateForm(selected, interpretation)} style={{ padding: 8 }}>
                          <Text style={{ color: colors.text }}>Editar</Text>
                        </Pressable>
                        <Pressable disabled={busy} onPress={() => void reject(interpretation)} style={{ padding: 8 }}>
                          <Text style={{ color: colors.dangerSolidBg }}>Rejeitar</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ))}
                <Pressable onPress={() => populateForm(selected)} style={{ alignSelf: "flex-start", padding: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Novo conhecimento</Text>
                </Pressable>
                {excerpts.length ? (
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Trechos privados para conferência</Text>
                    {excerpts.map((excerpt) => (
                      <Pressable
                        key={`${excerpt.chunkIndex}:${excerpt.sourceLocation ?? ""}`}
                        onPress={() => setAdministrativeExcerpt(excerpt.excerpt)}
                        style={{ borderLeftWidth: 3, borderLeftColor: colors.border, padding: 10 }}
                      >
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {excerpt.sourceLocation ?? `Trecho ${excerpt.chunkIndex + 1}`}
                        </Text>
                        <Text numberOfLines={4} style={{ color: colors.text }}>
                          {excerpt.excerpt}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>
                  {editing ? "Editar síntese" : "Nova síntese acadêmica"}
                </Text>
                {[
                  ["Título", title, setTitle],
                  ["Autores separados por ponto e vírgula", authors, setAuthors],
                  ["Ano", year, setYear],
                  ["Periódico, evento ou editora", venue, setVenue],
                  ["DOI", doi, setDoi],
                  ["Síntese original", claim, setClaim],
                  ["Aplicação prática", application, setApplication],
                  ["Limitações, uma por linha", limitations, setLimitations],
                  ["Excerto curto para auditoria privada", administrativeExcerpt, setAdministrativeExcerpt],
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
                  <Pressable onPress={() => { setSelected(null); setEditing(null); }} style={{ padding: 10 }}>
                    <Text style={{ color: colors.text }}>Cancelar</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={() => void save()} style={{ padding: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {busy ? "Salvando..." : editing ? "Atualizar revisão" : "Salvar para revisão"}
                    </Text>
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
