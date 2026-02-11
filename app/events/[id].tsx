import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteEvent,
  EventSport,
  EventType,
  getEventById,
  setEventClasses,
  updateEvent,
} from "../../src/api/events";
import { useAuth } from "../../src/auth/auth";
import { getClasses } from "../../src/db/seed";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { useAppTheme } from "../../src/ui/app-theme";

const pad2 = (value: number) => String(value).padStart(2, "0");
const eventTypes: EventType[] = ["torneio", "amistoso", "treino", "reuniao", "outro"];
const sportTypes: EventSport[] = ["geral", "volei_quadra", "volei_praia", "futebol"];

const toInputDate = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
};

const parseInputDate = (value: string) => {
  const [datePart, timePart] = value.trim().replace("T", " ").split(" ");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  if ([y, m, d, h, min].some((n) => !Number.isFinite(n))) return null;
  const next = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
};

export default function EventDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = params.id ?? "";
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const { session } = useAuth();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string; unitId: string }[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("treino");
  const [sport, setSport] = useState<EventSport>("geral");
  const [startsInput, setStartsInput] = useState("");
  const [endsInput, setEndsInput] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const startLabel = useMemo(() => (startsInput ? new Date(parseInputDate(startsInput) ?? 0).toLocaleString("pt-BR") : "-"), [startsInput]);

  const loadData = useCallback(async () => {
    if (!activeOrganization?.id || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      const [event, classRows] = await Promise.all([
        getEventById({ id: eventId, organizationId: activeOrganization.id, userId: session?.user?.id }),
        getClasses({ organizationId: activeOrganization.id }),
      ]);
      if (!event) {
        setError("Evento não encontrado.");
        return;
      }
      setClasses(classRows.map((item) => ({ id: item.id, name: item.name, unitId: item.unitId })));
      setTitle(event.title);
      setDescription(event.description);
      setEventType(event.eventType);
      setSport(event.sport);
      setStartsInput(toInputDate(event.startsAt));
      setEndsInput(toInputDate(event.endsAt));
      setLocationLabel(event.locationLabel || "");
      setClassIds(event.classIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar evento.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, eventId, session?.user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitUpdate = async () => {
    if (!activeOrganization?.id || !isAdmin) return;
    const startsAt = parseInputDate(startsInput);
    const endsAt = parseInputDate(endsInput);
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      Alert.alert("Validação", "Datas inválidas. Use YYYY-MM-DD HH:mm.");
      return;
    }
    setSaving(true);
    try {
      const linkedUnitId =
        classIds
          .map((classId) => classes.find((cls) => cls.id === classId)?.unitId ?? "")
          .find((value) => Boolean(value)) ?? null;
      await updateEvent(eventId, {
        organizationId: activeOrganization.id,
        title: title.trim(),
        description: description.trim(),
        eventType,
        sport,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        unitId: linkedUnitId,
        locationLabel: locationLabel.trim(),
      });
      await setEventClasses(eventId, activeOrganization.id, classIds);
      await loadData();
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeOrganization?.id || !isAdmin) return;
    Alert.alert("Excluir", "Deseja excluir este evento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(eventId, activeOrganization.id);
            router.replace("/events");
          } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao excluir.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "800" }}>Detalhes do evento</Text>
        {loading ? <Text style={{ color: colors.muted }}>Carregando...</Text> : null}
        {error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}
        <Text style={{ color: colors.muted }}>Início: {startLabel}</Text>

        <View style={{ padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.card, gap: 8 }}>
          <TextInput value={title} onChangeText={setTitle} editable={isAdmin} placeholder="Título" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
          <TextInput value={description} onChangeText={setDescription} editable={isAdmin} placeholder="Descrição" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
          <TextInput value={startsInput} onChangeText={setStartsInput} editable={isAdmin} placeholder="Início (YYYY-MM-DD HH:mm)" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
          <TextInput value={endsInput} onChangeText={setEndsInput} editable={isAdmin} placeholder="Fim (YYYY-MM-DD HH:mm)" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
          <TextInput value={locationLabel} onChangeText={setLocationLabel} editable={isAdmin} placeholder="Local" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {eventTypes.map((option) => (
                <Pressable key={option} disabled={!isAdmin} onPress={() => setEventType(option)} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: eventType === option ? colors.primaryBg : colors.secondaryBg, opacity: isAdmin ? 1 : 0.7 }}>
                  <Text style={{ color: eventType === option ? colors.primaryText : colors.text, fontWeight: "700" }}>{option}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {sportTypes.map((option) => (
                <Pressable key={option} disabled={!isAdmin} onPress={() => setSport(option)} style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: sport === option ? colors.primaryBg : colors.secondaryBg, opacity: isAdmin ? 1 : 0.7 }}>
                  <Text style={{ color: sport === option ? colors.primaryText : colors.text, fontWeight: "700" }}>{option}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Turmas vinculadas</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {classes.map((cls) => {
              const active = classIds.includes(cls.id);
              return (
                <Pressable
                  key={cls.id}
                  disabled={!isAdmin}
                  onPress={() =>
                    setClassIds((prev) =>
                      prev.includes(cls.id) ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]
                    )
                  }
                  style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: active ? colors.primaryBg : colors.secondaryBg, opacity: isAdmin ? 1 : 0.7 }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>{cls.name}</Text>
                </Pressable>
              );
            })}
          </View>

          {isAdmin ? (
            <Pressable onPress={submitUpdate} disabled={saving} style={{ borderRadius: 10, paddingVertical: 11, alignItems: "center", backgroundColor: saving ? colors.primaryDisabledBg : colors.primaryBg }}>
              <Text style={{ color: colors.primaryText, fontWeight: "800" }}>{saving ? "Salvando..." : "Salvar alterações"}</Text>
            </Pressable>
          ) : null}
          {isAdmin ? (
            <Pressable onPress={handleDelete}>
              <Text style={{ color: colors.dangerText, fontWeight: "700" }}>Excluir evento</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
