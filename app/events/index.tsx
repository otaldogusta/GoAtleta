import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
  useWindowDimensions,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    createEvent,
    deleteEvent,
    EventListItem,
    EventSport,
    EventType,
    listEvents,
    setEventClasses,
} from "../../src/api/events";
import { useAuth } from "../../src/auth/auth";
import { getClasses } from "../../src/db/seed";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { useAppTheme } from "../../src/ui/app-theme";

const eventTypes: EventType[] = ["torneio", "amistoso", "treino", "reuniao", "outro"];
const sportTypes: EventSport[] = ["geral", "volei_quadra", "volei_praia", "futebol"];

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatMonthLabel = (date: Date) =>
  date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

const parseInputDate = (value: string) => {
  const [datePart, timePart] = value.trim().replace("T", " ").split(" ");
  if (!datePart || !timePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, min] = timePart.split(":").map(Number);
  if ([y, m, d, h, min].some((n) => !Number.isFinite(n))) return null;
  const next = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
};

const toInputDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;

const eventTypeLabel: Record<EventType, string> = {
  torneio: "Torneio",
  amistoso: "Amistoso",
  treino: "Treino",
  reuniao: "Reunião",
  outro: "Outro",
};

const sportTypeLabel: Record<EventSport, string> = {
  geral: "Geral",
  volei_quadra: "Vôlei de quadra",
  volei_praia: "Vôlei de praia",
  futebol: "Futebol",
};

export default function EventsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { activeOrganization } = useOrganization();
  const { session } = useAuth();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const isWideLayout = width >= 980;

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; unitId: string }[]>([]);
  const [sportFilter, setSportFilter] = useState<"todos" | EventSport>("todos");
  const [typeFilter, setTypeFilter] = useState<"todos" | EventType>("todos");
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("treino");
  const [sport, setSport] = useState<EventSport>("geral");
  const [startsInput, setStartsInput] = useState(() => toInputDate(new Date()));
  const [endsInput, setEndsInput] = useState(() => {
    const next = new Date();
    next.setHours(next.getHours() + 1);
    return toInputDate(next);
  });
  const [locationLabel, setLocationLabel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const visibleEvents = useMemo(() => {
    return [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }, [events]);

  const loadData = useCallback(async () => {
    if (!activeOrganization?.id) {
      setEvents([]);
      setClasses([]);
      return;
    }
    setLoading(true);
    setError(null);
    const from = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 0, 0, 0, 0);
    const to = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    try {
      const [rows, classRows] = await Promise.all([
        listEvents({
          organizationId: activeOrganization.id,
          fromIso: from.toISOString(),
          toIso: to.toISOString(),
          sport: sportFilter === "todos" ? undefined : sportFilter,
          eventType: typeFilter === "todos" ? undefined : typeFilter,
          userId: session?.user?.id,
        }),
        getClasses({ organizationId: activeOrganization.id }),
      ]);
      setEvents(rows);
      setClasses(classRows.map((item) => ({ id: item.id, name: item.name, unitId: item.unitId })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar eventos.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, monthDate, session?.user?.id, sportFilter, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitCreate = async () => {
    if (!activeOrganization?.id || !session?.user?.id) return;
    if (!title.trim()) {
      Alert.alert("Validação", "Informe o título do evento.");
      return;
    }
    const startsAt = parseInputDate(startsInput);
    const endsAt = parseInputDate(endsInput);
    if (!startsAt || !endsAt) {
      Alert.alert("Validação", "Use formato YYYY-MM-DD HH:mm.");
      return;
    }
    if (endsAt <= startsAt) {
      Alert.alert("Validação", "A data final deve ser maior que a inicial.");
      return;
    }

    setSaving(true);
    try {
      const linkedUnitId =
        classIds
          .map((classId) => classes.find((cls) => cls.id === classId)?.unitId ?? "")
          .find((value) => Boolean(value)) ?? null;

      const created = await createEvent({
        organizationId: activeOrganization.id,
        title: title.trim(),
        description: description.trim(),
        eventType,
        sport,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        locationLabel: locationLabel.trim(),
        unitId: linkedUnitId,
        createdBy: session.user.id,
      });
      await setEventClasses(created.id, activeOrganization.id, classIds);
      setTitle("");
      setDescription("");
      setLocationLabel("");
      setClassIds([]);
      await loadData();
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao criar evento.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!activeOrganization?.id || !isAdmin) return;
    Alert.alert("Excluir evento", "Deseja realmente excluir este evento?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(eventId, activeOrganization.id);
            await loadData();
          } catch (err) {
            Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao excluir evento.");
          }
        },
      },
    ]);
  };

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setLocationLabel("");
    setClassIds([]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await loadData();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 30, fontWeight: "800" }}>Eventos</Text>
          <Text style={{ color: colors.muted }}>Agenda da organização, filtros e criação rápida</Text>
        </View>

        <View
          style={{
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Visão mensal</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable onPress={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{"<"}</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
              {formatMonthLabel(monthDate)}
            </Text>
            <Pressable onPress={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{">"}</Text>
            </Pressable>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Filtros da agenda</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setSportFilter("todos")}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: sportFilter === "todos" ? colors.primaryBg : colors.secondaryBg,
                }}
              >
                <Text style={{ color: sportFilter === "todos" ? colors.primaryText : colors.text, fontWeight: "700" }}>
                  Todos esportes
                </Text>
              </Pressable>
              {sportTypes.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setSportFilter(option)}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: sportFilter === option ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: sportFilter === option ? colors.primaryText : colors.text, fontWeight: "700" }}>
                    {sportTypeLabel[option]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setTypeFilter("todos")}
                style={{
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: typeFilter === "todos" ? colors.primaryBg : colors.secondaryBg,
                }}
              >
                <Text style={{ color: typeFilter === "todos" ? colors.primaryText : colors.text, fontWeight: "700" }}>
                  Todos tipos
                </Text>
              </Pressable>
              {eventTypes.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setTypeFilter(option)}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: typeFilter === option ? colors.primaryBg : colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: typeFilter === option ? colors.primaryText : colors.text, fontWeight: "700" }}>
                    {eventTypeLabel[option]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {isAdmin ? (
          <View
            style={{
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 12,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Novo evento
            </Text>
            <View style={{ flexDirection: isWideLayout ? "row" : "column", gap: 12 }}>
              <View style={{ flex: 1.2, gap: 10 }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Título</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Nome do evento"
                    placeholderTextColor={colors.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.secondaryBg,
                      color: colors.text,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Descrição</Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Detalhes para professores e turmas"
                    placeholderTextColor={colors.muted}
                    multiline
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.secondaryBg,
                      color: colors.text,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                      minHeight: 80,
                      textAlignVertical: "top",
                    }}
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Local</Text>
                  <TextInput
                    value={locationLabel}
                    onChangeText={setLocationLabel}
                    placeholder="Quadra, ginásio, online..."
                    placeholderTextColor={colors.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.secondaryBg,
                      color: colors.text,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                  />
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Turmas vinculadas</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {classes.map((cls) => {
                      const active = classIds.includes(cls.id);
                      return (
                        <Pressable
                          key={cls.id}
                          onPress={() =>
                            setClassIds((prev) =>
                              prev.includes(cls.id)
                                ? prev.filter((id) => id !== cls.id)
                                : [...prev, cls.id]
                            )
                          }
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                          }}
                        >
                          <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>
                            {cls.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>

              <View style={{ flex: 1, gap: 10 }}>
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Início</Text>
                  <TextInput
                    value={startsInput}
                    onChangeText={setStartsInput}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={colors.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.secondaryBg,
                      color: colors.text,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Fim</Text>
                  <TextInput
                    value={endsInput}
                    onChangeText={setEndsInput}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor={colors.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      backgroundColor: colors.secondaryBg,
                      color: colors.text,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                  />
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Categoria</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {eventTypes.map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => setEventType(option)}
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: eventType === option ? colors.primaryBg : colors.secondaryBg,
                          }}
                        >
                          <Text style={{ color: eventType === option ? colors.primaryText : colors.text, fontWeight: "700" }}>
                            {eventTypeLabel[option]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Esporte</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {sportTypes.map((option) => (
                        <Pressable
                          key={option}
                          onPress={() => setSport(option)}
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: sport === option ? colors.primaryBg : colors.secondaryBg,
                          }}
                        >
                          <Text style={{ color: sport === option ? colors.primaryText : colors.text, fontWeight: "700" }}>
                            {sportTypeLabel[option]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={submitCreate}
                    disabled={saving}
                    style={{
                      flex: 1,
                      borderRadius: 10,
                      paddingVertical: 11,
                      alignItems: "center",
                      backgroundColor: saving ? colors.primaryDisabledBg : colors.primaryBg,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                      {saving ? "Salvando..." : "Salvar evento"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={resetCreateForm}
                    style={{
                      borderRadius: 10,
                      paddingHorizontal: 14,
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Limpar</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
            Lista do mês
          </Text>
          {loading ? <Text style={{ color: colors.muted }}>Carregando...</Text> : null}
          {error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}
          {!loading && !error && visibleEvents.length === 0 ? (
            <Text style={{ color: colors.muted }}>Sem eventos no período.</Text>
          ) : null}
          {visibleEvents.map((event) => {
            const start = new Date(event.startsAt);
            const end = new Date(event.endsAt);
            return (
              <Pressable
                key={event.id}
                onPress={() => router.push({ pathname: "/events/[id]", params: { id: event.id } })}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  gap: 6,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
                  {event.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {start.toLocaleDateString("pt-BR")} •{" "}
                  {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <View style={{ borderRadius: 999, backgroundColor: colors.secondaryBg, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>{eventTypeLabel[event.eventType]}</Text>
                  </View>
                  <View style={{ borderRadius: 999, backgroundColor: colors.secondaryBg, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>{sportTypeLabel[event.sport]}</Text>
                  </View>
                  {event.hasMyClass ? (
                    <View style={{ borderRadius: 999, backgroundColor: colors.primaryBg, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 11 }}>Minhas turmas</Text>
                    </View>
                  ) : null}
                </View>
                {event.locationLabel ? (
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Local: {event.locationLabel}</Text>
                ) : null}
                {isAdmin ? (
                  <Pressable onPress={() => handleDelete(event.id)} style={{ marginTop: 4 }}>
                    <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>Excluir</Text>
                  </Pressable>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
