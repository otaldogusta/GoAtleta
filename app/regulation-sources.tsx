import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../src/auth/auth";
import {
  createRegulationSource,
  deleteRegulationSource,
  listRegulationSources,
  RegulationAuthority,
  RegulationSource,
  syncRegulationSourceNow,
  toggleRegulationSource,
  updateRegulationSource,
} from "../src/api/regulation-sources";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { ModalSheet } from "../src/ui/ModalSheet";

type FormState = {
  label: string;
  authority: RegulationAuthority;
  sourceUrl: string;
  sport: string;
  topicHintsText: string;
  checkIntervalHours: string;
  enabled: boolean;
};

const authorityOptions: RegulationAuthority[] = ["FIVB", "FPV", "PARANAENSE", "OUTRO"];

const emptyForm: FormState = {
  label: "",
  authority: "FIVB",
  sourceUrl: "",
  sport: "volleyball",
  topicHintsText: "",
  checkIntervalHours: "6",
  enabled: true,
};

const parseTopics = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

export default function RegulationSourcesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const { activeOrganization, activeOrganizationId } = useOrganization();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [sources, setSources] = useState<RegulationSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const organizationName = activeOrganization?.name ?? "Organizacao";

  const loadSources = useCallback(async () => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !isAdmin) {
      setSources([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await listRegulationSources(organizationId);
      setSources(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar fontes.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadSources();
    }, [loadSources])
  );

  const editingSource = useMemo(
    () => sources.find((item) => item.id === editingSourceId) ?? null,
    [editingSourceId, sources]
  );

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setEditingSourceId(null);
    setForm(emptyForm);
  }, []);

  const openCreate = useCallback(() => {
    setEditingSourceId(null);
    setForm(emptyForm);
    setSheetVisible(true);
  }, []);

  const openEdit = useCallback((source: RegulationSource) => {
    setEditingSourceId(source.id);
    setForm({
      label: source.label,
      authority: source.authority,
      sourceUrl: source.sourceUrl,
      sport: source.sport || "volleyball",
      topicHintsText: source.topicHints.join(", "),
      checkIntervalHours: String(source.checkIntervalHours || 6),
      enabled: source.enabled,
    });
    setSheetVisible(true);
  }, []);

  const handleSave = useCallback(async () => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId) return;

    const label = form.label.trim();
    const sourceUrl = form.sourceUrl.trim();
    if (!label || !sourceUrl) {
      Alert.alert("Campos obrigatórios", "Preencha nome da fonte e URL.");
      return;
    }

    const checkIntervalHours = Math.max(1, Math.min(Number(form.checkIntervalHours || 6), 168));
    if (!Number.isFinite(checkIntervalHours)) {
      Alert.alert("Intervalo inválido", "Informe um número de horas entre 1 e 168.");
      return;
    }

    setSaving(true);
    try {
      if (editingSourceId) {
        await updateRegulationSource(editingSourceId, organizationId, {
          label,
          authority: form.authority,
          sourceUrl,
          sport: form.sport || "volleyball",
          topicHints: parseTopics(form.topicHintsText),
          checkIntervalHours,
          enabled: form.enabled,
        });
      } else {
        await createRegulationSource({
          organizationId,
          label,
          authority: form.authority,
          sourceUrl,
          sport: form.sport || "volleyball",
          topicHints: parseTopics(form.topicHintsText),
          checkIntervalHours,
          enabled: form.enabled,
          createdBy: session?.user?.id ?? null,
        });
      }
      closeSheet();
      await loadSources();
    } catch (saveError) {
      Alert.alert("Erro", saveError instanceof Error ? saveError.message : "Falha ao salvar fonte.");
    } finally {
      setSaving(false);
    }
  }, [activeOrganizationId, closeSheet, editingSourceId, form, loadSources, session?.user?.id]);

  const handleToggle = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      try {
        await toggleRegulationSource(source.id, organizationId, !source.enabled);
        await loadSources();
      } catch (toggleError) {
        Alert.alert("Erro", toggleError instanceof Error ? toggleError.message : "Falha ao atualizar status.");
      }
    },
    [activeOrganizationId, loadSources]
  );

  const handleDelete = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      Alert.alert("Remover fonte", `Deseja remover "${source.label}"?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteRegulationSource(source.id, organizationId);
              await loadSources();
            } catch (deleteError) {
              Alert.alert("Erro", deleteError instanceof Error ? deleteError.message : "Falha ao remover.");
            }
          },
        },
      ]);
    },
    [activeOrganizationId, loadSources]
  );

  const handleSyncNow = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      setSyncingSourceId(source.id);
      try {
        const report = await syncRegulationSourceNow({
          organizationId,
          sourceId: source.id,
          force: true,
        });
        await loadSources();
        Alert.alert(
          "Sincronização concluída",
          `Verificadas: ${report.checked}\nNovos documentos: ${report.newDocuments}\nNovos avisos: ${report.newUpdates}`
        );
      } catch (syncError) {
        Alert.alert("Erro", syncError instanceof Error ? syncError.message : "Falha ao sincronizar fonte.");
      } finally {
        setSyncingSourceId(null);
      }
    },
    [activeOrganizationId, loadSources]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          {isAdmin ? (
            <Pressable
              onPress={openCreate}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.primaryBg,
                backgroundColor: colors.primaryBg,
                paddingHorizontal: 14,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Nova fonte</Text>
            </Pressable>
          ) : null}
        </View>

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
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>Regulamento</Text>
          <Text style={{ color: colors.muted }}>
            Fontes monitoradas em {organizationName}.
          </Text>
        </View>

        {!isAdmin ? (
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Acesso restrito</Text>
            <Text style={{ color: colors.muted }}>
              Somente administradores da organização podem gerenciar fontes de regulamento.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 24, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.text} />
          </View>
        ) : null}

        {!loading && error ? (
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.dangerBg,
              backgroundColor: colors.card,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Erro</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
            <Pressable
              onPress={() => void loadSources()}
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingVertical: 8,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Tentar novamente</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && isAdmin && !sources.length ? (
          <View
            style={{
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 14,
              gap: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Nenhuma fonte cadastrada</Text>
            <Text style={{ color: colors.muted }}>
              Adicione uma fonte oficial para monitorar adendos e atualizações de regulamento.
            </Text>
          </View>
        ) : null}

        {!loading &&
          isAdmin &&
          sources.map((source) => (
            <View
              key={source.id}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: 14,
                gap: 10,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>
                    {source.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{source.sourceUrl}</Text>
                </View>
                <View
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>
                    {source.authority}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Intervalo: {source.checkIntervalHours}h
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {source.enabled ? "Ativa" : "Pausada"}
                  </Text>
                  <Switch value={source.enabled} onValueChange={() => void handleToggle(source)} />
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={() => void handleSyncNow(source)}
                  disabled={syncingSourceId === source.id}
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.primaryBg,
                    backgroundColor: colors.primaryBg,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    opacity: syncingSourceId === source.id ? 0.7 : 1,
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                    {syncingSourceId === source.id ? "Sincronizando..." : "Sincronizar agora"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => openEdit(source)}
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Editar</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleDelete(source)}
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.dangerBg,
                    backgroundColor: colors.secondaryBg,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>Remover</Text>
                </Pressable>
              </View>
            </View>
          ))}
      </ScrollView>

      <ModalSheet
        visible={sheetVisible}
        onClose={closeSheet}
        cardStyle={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 14,
          gap: 10,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {editingSource ? "Editar fonte" : "Nova fonte"}
        </Text>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Nome da fonte</Text>
          <TextInput
            value={form.label}
            onChangeText={(value) => setForm((prev) => ({ ...prev, label: value }))}
            placeholder="Ex: Regulamento FIVB 2026"
            placeholderTextColor={colors.muted}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Autoridade</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {authorityOptions.map((authority) => {
              const active = authority === form.authority;
              return (
                <Pressable
                  key={authority}
                  onPress={() => setForm((prev) => ({ ...prev, authority }))}
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? colors.primaryBg : colors.border,
                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                  }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700", fontSize: 12 }}>
                    {authority}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>URL da fonte</Text>
          <TextInput
            value={form.sourceUrl}
            onChangeText={(value) => setForm((prev) => ({ ...prev, sourceUrl: value }))}
            placeholder="https://..."
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Tópicos sugeridos (separados por vírgula)</Text>
          <TextInput
            value={form.topicHintsText}
            onChangeText={(value) => setForm((prev) => ({ ...prev, topicHintsText: value }))}
            placeholder="Substituicoes, Libero, Disputa"
            placeholderTextColor={colors.muted}
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Esporte</Text>
            <TextInput
              value={form.sport}
              onChangeText={(value) => setForm((prev) => ({ ...prev, sport: value }))}
              placeholder="volleyball"
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />
          </View>
          <View style={{ width: 120, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Intervalo (h)</Text>
            <TextInput
              value={form.checkIntervalHours}
              onChangeText={(value) => setForm((prev) => ({ ...prev, checkIntervalHours: value }))}
              keyboardType="number-pad"
              placeholder="6"
              placeholderTextColor={colors.muted}
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                color: colors.inputText,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Fonte ativa</Text>
          <Switch
            value={form.enabled}
            onValueChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={closeSheet}
            style={{
              flex: 1,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              paddingVertical: 11,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            style={{
              flex: 1,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.primaryBg,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
              paddingVertical: 11,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
              {saving ? "Salvando..." : "Salvar"}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}
