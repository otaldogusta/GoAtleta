import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    compareRegulationRuleSets,
    listRegulationClauses,
    listRegulationRuleSets,
    type RegulationClause,
    type RegulationRuleSet,
    type RegulationRuleSetDiff,
} from "../src/api/regulation-rule-sets";
import { listRegulationUpdates, type RegulationUpdate } from "../src/api/regulation-updates";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

const statusLabel: Record<RegulationRuleSet["status"], string> = {
  draft: "Rascunho",
  active: "Ativo",
  pending_next_cycle: "Proximo ciclo",
  archived: "Arquivado",
};

const diffLabel: Record<RegulationRuleSetDiff["diffKind"], string> = {
  added: "Adicionada",
  removed: "Removida",
  changed: "Alterada",
  equal: "Igual",
};

const dateLabel = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
};

export default function RegulationHistoryScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { activeOrganization, activeOrganizationId } = useOrganization();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ruleSets, setRuleSets] = useState<RegulationRuleSet[]>([]);
  const [updates, setUpdates] = useState<RegulationUpdate[]>([]);
  const [leftRuleSetId, setLeftRuleSetId] = useState<string>("");
  const [rightRuleSetId, setRightRuleSetId] = useState<string>("");
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>("");
  const [diffs, setDiffs] = useState<RegulationRuleSetDiff[]>([]);
  const [clauses, setClauses] = useState<RegulationClause[]>([]);
  const [loadingDiffs, setLoadingDiffs] = useState(false);
  const [loadingClauses, setLoadingClauses] = useState(false);

  const activeRuleSet = useMemo(
    () => ruleSets.find((item) => item.id === selectedRuleSetId) ?? null,
    [ruleSets, selectedRuleSetId]
  );

  const loadData = useCallback(async () => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId) {
      setRuleSets([]);
      setUpdates([]);
      setDiffs([]);
      setClauses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [ruleSetRows, updatesResult] = await Promise.all([
        listRegulationRuleSets({ organizationId, limit: 120 }),
        listRegulationUpdates({ organizationId, unreadOnly: false, limit: 50 }),
      ]);
      setRuleSets(ruleSetRows);
      setUpdates(updatesResult.items);
      const firstId = ruleSetRows[0]?.id ?? "";
      const secondId = ruleSetRows[1]?.id ?? ruleSetRows[0]?.id ?? "";
      setSelectedRuleSetId((prev) => prev || firstId);
      setLeftRuleSetId((prev) => prev || firstId);
      setRightRuleSetId((prev) => prev || secondId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar regulamentos.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !selectedRuleSetId) {
      setClauses([]);
      return;
    }
    let cancelled = false;
    setLoadingClauses(true);
    void listRegulationClauses({ organizationId, ruleSetId: selectedRuleSetId })
      .then((rows) => {
        if (cancelled) return;
        setClauses(rows);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar clausulas.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingClauses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, selectedRuleSetId]);

  useEffect(() => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !leftRuleSetId || !rightRuleSetId || leftRuleSetId === rightRuleSetId) {
      setDiffs([]);
      return;
    }
    let cancelled = false;
    setLoadingDiffs(true);
    void compareRegulationRuleSets({ organizationId, leftRuleSetId, rightRuleSetId })
      .then((rows) => {
        if (cancelled) return;
        setDiffs(rows.filter((item) => item.diffKind !== "equal"));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao comparar versoes.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingDiffs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, leftRuleSetId, rightRuleSetId]);

  const openSource = useCallback(async (url: string) => {
    const target = String(url ?? "").trim();
    if (!target) return;
    try {
      const canOpen = await Linking.canOpenURL(target);
      if (!canOpen) throw new Error("invalid");
      await Linking.openURL(target);
    } catch {
      Alert.alert("Fonte", "Nao foi possivel abrir o link.");
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => { if (router.canGoBack()) { router.back(); return; } router.replace("/"); }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: "700" }}>Histórico de regulamentos</Text>
          </Pressable>
        </View>

        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{activeOrganization?.name ?? "Organizacao"}</Text>
          <Text style={{ color: colors.muted }}>Comparador de versoes e historico institucional.</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.text} /> : null}
        {!loading && error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}

        {!loading ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Versoes</Text>
            {ruleSets.length ? ruleSets.map((item) => {
              const selected = selectedRuleSetId === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedRuleSetId(item.id)}
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: selected ? colors.primaryBg : colors.border,
                    backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>{item.versionLabel}</Text>
                  <Text style={{ color: selected ? colors.primaryText : colors.muted, fontSize: 12 }}>
                    {statusLabel[item.status]} - {item.sourceAuthority || "Fonte"}
                  </Text>
                </Pressable>
              );
            }) : <Text style={{ color: colors.muted }}>Sem versoes cadastradas.</Text>}
          </View>
        ) : null}

        {!loading && ruleSets.length >= 2 ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Comparacao</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ruleSets.map((item) => (
                <Pressable
                  key={`l-${item.id}`}
                  onPress={() => setLeftRuleSetId(item.id)}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: leftRuleSetId === item.id ? colors.primaryBg : colors.border, backgroundColor: leftRuleSetId === item.id ? colors.primaryBg : colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 7 }}
                >
                  <Text style={{ color: leftRuleSetId === item.id ? colors.primaryText : colors.text, fontWeight: "700", fontSize: 12 }}>{item.versionLabel}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ruleSets.map((item) => (
                <Pressable
                  key={`r-${item.id}`}
                  onPress={() => setRightRuleSetId(item.id)}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: rightRuleSetId === item.id ? colors.primaryBg : colors.border, backgroundColor: rightRuleSetId === item.id ? colors.primaryBg : colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 7 }}
                >
                  <Text style={{ color: rightRuleSetId === item.id ? colors.primaryText : colors.text, fontWeight: "700", fontSize: 12 }}>{item.versionLabel}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {loadingDiffs ? <ActivityIndicator color={colors.text} /> : null}
            {!loadingDiffs && leftRuleSetId === rightRuleSetId ? <Text style={{ color: colors.muted }}>Selecione versoes diferentes.</Text> : null}
            {!loadingDiffs && leftRuleSetId !== rightRuleSetId ? (
              diffs.length ? diffs.map((item) => (
                <View key={`${item.clauseKey}:${item.diffKind}`} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 10, gap: 3 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{item.clauseLabel}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.clauseKey} - {diffLabel[item.diffKind]}</Text>
                </View>
              )) : <Text style={{ color: colors.muted }}>Sem diferencas relevantes.</Text>
            ) : null}
          </View>
        ) : null}

        {!loading ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
              Clausulas {activeRuleSet ? `- ${activeRuleSet.versionLabel}` : ""}
            </Text>
            {loadingClauses ? <ActivityIndicator color={colors.text} /> : null}
            {!loadingClauses && clauses.length ? clauses.map((item) => (
              <View key={item.id} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 10, gap: 3 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.clauseLabel}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.clauseKey} - {item.clauseType}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Base: {JSON.stringify(item.baseValue)}</Text>
              </View>
            )) : null}
            {!loadingClauses && !clauses.length ? <Text style={{ color: colors.muted }}>Sem clausulas para este ruleset.</Text> : null}
          </View>
        ) : null}

        {!loading ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Atualizacoes</Text>
            {updates.length ? updates.map((item) => (
              <View key={item.id} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 10, gap: 5 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Publicado em {dateLabel(item.publishedAt ?? item.createdAt)}</Text>
                <Text style={{ color: colors.muted }}>{item.diffSummary}</Text>
                <Pressable
                  onPress={() => void openSource(item.sourceUrl)}
                  style={{ alignSelf: "flex-start", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 7 }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Ver fonte</Text>
                </Pressable>
              </View>
            )) : <Text style={{ color: colors.muted }}>Sem atualizacoes detectadas.</Text>}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
