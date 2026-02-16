import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";
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

const parseDurationMinutes = (value: string) => {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  const hhmm = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const hours = Number(hhmm[1]);
    const minutes = Number(hhmm[2]);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return Math.max(0, hours * 60 + minutes);
    }
  }

  const withHourMinute = normalized.match(/^(\d+)h(?:\s*(\d{1,2})m?)?$/);
  if (withHourMinute) {
    const hours = Number(withHourMinute[1] ?? 0);
    const minutes = Number(withHourMinute[2] ?? 0);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return Math.max(0, hours * 60 + minutes);
    }
  }

  const minuteOnly = normalized.match(/^(\d+)m?$/);
  if (minuteOnly) {
    const minutes = Number(minuteOnly[1]);
    return Number.isFinite(minutes) ? Math.max(0, minutes) : null;
  }

  return null;
};

const formatDurationMinutes = (value: number) => {
  const safe = Math.max(0, Math.round(value));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${pad2(minutes)}m`;
};

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

const reminderOptions = ["15m antes", "1h antes", "1 dia antes"];
type DropdownLayout = { x: number; y: number; width: number; height: number };
type ContainerPoint = { x: number; y: number };

export default function EventsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { activeOrganization } = useOrganization();
  const { session } = useAuth();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const isWideLayout = width >= 980;
  const isFormRowLayout = width >= 760;

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
  const [startsInput, setStartsInput] = useState(() => {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    return toInputDate(next);
  });
  const [endsInput, setEndsInput] = useState(() => {
    const next = new Date();
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    return toInputDate(next);
  });
  const [startDateInput, setStartDateInput] = useState(() => startsInput.split(" ")[0] ?? "");
  const [startTimeInput, setStartTimeInput] = useState(() => startsInput.split(" ")[1] ?? "");
  const [durationInput, setDurationInput] = useState(() => {
    const start = parseInputDate(startsInput);
    const end = parseInputDate(endsInput);
    if (!start || !end) return "1h";
    const minutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    return formatDurationMinutes(minutes);
  });
  const [showDescription, setShowDescription] = useState(false);
  const [guestEmailInput, setGuestEmailInput] = useState("");
  const [guestEmails, setGuestEmails] = useState<string[]>([]);
  const [notificationChannel, setNotificationChannel] = useState<"email" | "whatsapp">("email");
  const [reminderValue, setReminderValue] = useState("1h antes");
  const [showEventTypeDropdown, setShowEventTypeDropdown] = useState(false);
  const [showSportDropdown, setShowSportDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showReminderDropdown, setShowReminderDropdown] = useState(false);
  const [dropdownContainerWindow, setDropdownContainerWindow] = useState<ContainerPoint | null>(null);
  const [eventTypeTriggerLayout, setEventTypeTriggerLayout] = useState<DropdownLayout | null>(null);
  const [sportTriggerLayout, setSportTriggerLayout] = useState<DropdownLayout | null>(null);
  const [notificationTriggerLayout, setNotificationTriggerLayout] = useState<DropdownLayout | null>(null);
  const [reminderTriggerLayout, setReminderTriggerLayout] = useState<DropdownLayout | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const dropdownContainerRef = useRef<View | null>(null);
  const eventTypeTriggerRef = useRef<View | null>(null);
  const sportTriggerRef = useRef<View | null>(null);
  const notificationTriggerRef = useRef<View | null>(null);
  const reminderTriggerRef = useRef<View | null>(null);

  const closeCreateDropdowns = () => {
    setShowEventTypeDropdown(false);
    setShowSportDropdown(false);
    setShowNotificationDropdown(false);
    setShowReminderDropdown(false);
  };

  const syncDropdownContainerWindow = useCallback(() => {
    if (!dropdownContainerRef.current) return;
    dropdownContainerRef.current.measureInWindow((x, y) => {
      setDropdownContainerWindow({ x, y });
    });
  }, []);

  const measureTriggerLayout = useCallback(
    (trigger: View | null, setter: (layout: DropdownLayout | null) => void) => {
      if (!trigger) {
        setter(null);
        return;
      }
      trigger.measureInWindow((x, y, width, height) => {
        setter({ x, y, width, height });
      });
    },
    []
  );

  const openEventTypeDropdown = () => {
    const next = !showEventTypeDropdown;
    closeCreateDropdowns();
    if (!next) return;
    setShowEventTypeDropdown(true);
    requestAnimationFrame(() => {
      syncDropdownContainerWindow();
      measureTriggerLayout(eventTypeTriggerRef.current, setEventTypeTriggerLayout);
    });
  };

  const openSportDropdown = () => {
    const next = !showSportDropdown;
    closeCreateDropdowns();
    if (!next) return;
    setShowSportDropdown(true);
    requestAnimationFrame(() => {
      syncDropdownContainerWindow();
      measureTriggerLayout(sportTriggerRef.current, setSportTriggerLayout);
    });
  };

  const openNotificationDropdown = () => {
    const next = !showNotificationDropdown;
    closeCreateDropdowns();
    if (!next) return;
    setShowNotificationDropdown(true);
    requestAnimationFrame(() => {
      syncDropdownContainerWindow();
      measureTriggerLayout(notificationTriggerRef.current, setNotificationTriggerLayout);
    });
  };

  const openReminderDropdown = () => {
    const next = !showReminderDropdown;
    closeCreateDropdowns();
    if (!next) return;
    setShowReminderDropdown(true);
    requestAnimationFrame(() => {
      syncDropdownContainerWindow();
      measureTriggerLayout(reminderTriggerRef.current, setReminderTriggerLayout);
    });
  };

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
    const nextStart = new Date();
    nextStart.setMinutes(0, 0, 0);
    const nextEnd = new Date(nextStart.getTime() + 60 * 60000);

    setTitle("");
    setDescription("");
    setShowDescription(false);
    setLocationLabel("");
    setStartsInput(toInputDate(nextStart));
    setEndsInput(toInputDate(nextEnd));
    setStartDateInput(toInputDate(nextStart).split(" ")[0] ?? "");
    setStartTimeInput(toInputDate(nextStart).split(" ")[1] ?? "");
    setDurationInput("1h");
    setGuestEmailInput("");
    setGuestEmails([]);
    setNotificationChannel("email");
    setReminderValue("1h antes");
    closeCreateDropdowns();
    setClassIds([]);
  };

  const addGuestEmail = () => {
    const value = guestEmailInput.trim();
    if (!value) return;
    if (guestEmails.includes(value.toLowerCase())) {
      setGuestEmailInput("");
      return;
    }
    setGuestEmails((prev) => [...prev, value.toLowerCase()]);
    setGuestEmailInput("");
  };

  const removeGuestEmail = (email: string) => {
    setGuestEmails((prev) => prev.filter((item) => item !== email));
  };

  useEffect(() => {
    const durationMinutes = parseDurationMinutes(durationInput) ?? 60;
    const start = parseInputDate(`${startDateInput} ${startTimeInput}`);
    if (!start) return;

    const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60000);
    setStartsInput(toInputDate(start));
    setEndsInput(toInputDate(end));
  }, [startDateInput, startTimeInput, durationInput]);

  useEffect(() => {
    requestAnimationFrame(() => {
      syncDropdownContainerWindow();
      measureTriggerLayout(eventTypeTriggerRef.current, setEventTypeTriggerLayout);
      measureTriggerLayout(sportTriggerRef.current, setSportTriggerLayout);
      measureTriggerLayout(notificationTriggerRef.current, setNotificationTriggerLayout);
      measureTriggerLayout(reminderTriggerRef.current, setReminderTriggerLayout);
    });
  }, [width, syncDropdownContainerWindow, measureTriggerLayout]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View ref={dropdownContainerRef} style={{ flex: 1 }} onLayout={syncDropdownContainerWindow}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
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
        <View style={{ gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>Eventos</Text>
          <Text style={{ color: colors.muted }}>Agenda mensal da organização</Text>
        </View>

        <View
          style={{
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            gap: 12,
          }}
        >
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>Visão mensal</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Navegue por mês e refine a lista com filtros.</Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable
              onPress={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>{"<"}</Text>
            </Pressable>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
              {formatMonthLabel(monthDate)}
            </Text>
            <Pressable
              onPress={() => setMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800" }}>{">"}</Text>
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Esporte</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setSportFilter("todos")}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: sportFilter === "todos" ? colors.primaryBg : colors.border,
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
                      borderWidth: 1,
                      borderColor: sportFilter === option ? colors.primaryBg : colors.border,
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
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Tipo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setTypeFilter("todos")}
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderWidth: 1,
                    borderColor: typeFilter === "todos" ? colors.primaryBg : colors.border,
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
                      borderWidth: 1,
                      borderColor: typeFilter === option ? colors.primaryBg : colors.border,
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
        </View>

        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Lista do mês
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {visibleEvents.length} {visibleEvents.length === 1 ? "evento encontrado" : "eventos encontrados"}
            </Text>
          </View>
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
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  gap: 8,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 }}>
                    {event.title}
                  </Text>
                  {event.hasMyClass ? (
                    <View style={{ borderRadius: 999, backgroundColor: colors.primaryBg, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 11 }}>Minhas turmas</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {start.toLocaleDateString("pt-BR")} •{" "}
                  {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <View
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>{eventTypeLabel[event.eventType]}</Text>
                  </View>
                  <View
                    style={{
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>{sportTypeLabel[event.sport]}</Text>
                  </View>
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

        {isAdmin ? (
          <View
            style={{
              padding: 16,
              borderRadius: 18,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 14,
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                Criar evento
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Formulário rápido para publicar na agenda
              </Text>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, opacity: 0.8 }} />

            <View style={{ flexDirection: "column", gap: 10 }}>
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Título</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Título do evento"
                        placeholderTextColor={colors.muted}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          color: colors.text,
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                        }}
                      />
                    </View>
                    <Pressable
                      onPress={() => setShowDescription((prev) => !prev)}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 12,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {showDescription ? "Ocultar descrição" : "+ Adicionar descrição"}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {showDescription ? (
                  <View style={{ gap: 6 }}>
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
                        borderRadius: 12,
                        backgroundColor: colors.secondaryBg,
                        color: colors.text,
                        paddingHorizontal: 10,
                        paddingVertical: 9,
                        minHeight: 80,
                        textAlignVertical: "top",
                      }}
                    />
                  </View>
                ) : null}

                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: isFormRowLayout ? "row" : "column", gap: 8 }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>Data</Text>
                      <TextInput
                        value={startDateInput}
                        onChangeText={setStartDateInput}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor={colors.muted}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          color: colors.text,
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                        }}
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>Hora</Text>
                      <TextInput
                        value={startTimeInput}
                        onChangeText={setStartTimeInput}
                        placeholder="HH:mm"
                        placeholderTextColor={colors.muted}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          color: colors.text,
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                        }}
                      />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>Duração</Text>
                      <TextInput
                        value={durationInput}
                        onChangeText={setDurationInput}
                        placeholder="1h 45m"
                        placeholderTextColor={colors.muted}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          color: colors.text,
                          paddingHorizontal: 10,
                          paddingVertical: 9,
                        }}
                      />
                    </View>
                  </View>

                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Este evento acontecerá em {startDateInput || "--"} às {startTimeInput || "--"} e termina em {endsInput.split(" ")[1] ?? "--"}.
                  </Text>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Local</Text>
                  <TextInput
                    value={locationLabel}
                    onChangeText={setLocationLabel}
                    placeholder="Quadra, ginásio, online..."
                    placeholderTextColor={colors.muted}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      backgroundColor: colors.secondaryBg,
                      color: colors.text,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                  />
                </View>

                <View style={{ flexDirection: isFormRowLayout ? "row" : "column", gap: 8 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Categoria</Text>
                    <View ref={eventTypeTriggerRef}>
                      <Pressable
                        onPress={openEventTypeDropdown}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 10,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{eventTypeLabel[eventType]}</Text>
                        <Text style={{ color: colors.muted, fontWeight: "700" }}>{showEventTypeDropdown ? "▴" : "▾"}</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Esporte</Text>
                    <View ref={sportTriggerRef}>
                      <Pressable
                        onPress={openSportDropdown}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 10,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{sportTypeLabel[sport]}</Text>
                        <Text style={{ color: colors.muted, fontWeight: "700" }}>{showSportDropdown ? "▴" : "▾"}</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Convidados</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={guestEmailInput}
                      onChangeText={setGuestEmailInput}
                      placeholder="Email do convidado"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="none"
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 12,
                        backgroundColor: colors.secondaryBg,
                        color: colors.text,
                        paddingHorizontal: 10,
                        paddingVertical: 9,
                      }}
                    />
                    <Pressable
                      onPress={addGuestEmail}
                      style={{
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        paddingHorizontal: 16,
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>Adicionar</Text>
                    </Pressable>
                  </View>

                  {guestEmails.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {guestEmails.map((email) => {
                        const initials = (email[0] ?? "?").toUpperCase();
                        return (
                          <View
                            key={email}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.secondaryBg,
                              paddingVertical: 4,
                              paddingLeft: 4,
                              paddingRight: 8,
                            }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: colors.primaryBg,
                              }}
                            >
                              <Text style={{ color: colors.primaryText, fontSize: 11, fontWeight: "800" }}>{initials}</Text>
                            </View>
                            <Text style={{ color: colors.text, fontSize: 12 }}>{email}</Text>
                            <Pressable onPress={() => removeGuestEmail(email)}>
                              <Text style={{ color: colors.muted, fontWeight: "700" }}>×</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>

                <View style={{ flexDirection: isFormRowLayout ? "row" : "column", gap: 8 }}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Notificação</Text>
                    <View ref={notificationTriggerRef}>
                      <Pressable
                        onPress={openNotificationDropdown}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 10,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>
                          {notificationChannel === "email" ? "Email" : "WhatsApp"}
                        </Text>
                        <Text style={{ color: colors.muted, fontWeight: "700" }}>{showNotificationDropdown ? "▴" : "▾"}</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: "700" }}>Lembrete</Text>
                    <View ref={reminderTriggerRef}>
                      <Pressable
                        onPress={openReminderDropdown}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 12,
                          backgroundColor: colors.secondaryBg,
                          paddingHorizontal: 10,
                          paddingVertical: 10,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{reminderValue}</Text>
                        <Text style={{ color: colors.muted, fontWeight: "700" }}>{showReminderDropdown ? "▴" : "▾"}</Text>
                      </Pressable>
                    </View>
                  </View>
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
                            borderWidth: 1,
                            borderColor: active ? colors.primaryBg : colors.border,
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

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={submitCreate}
                disabled={saving}
                style={{
                  flex: 1,
                  borderRadius: 12,
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
                  borderRadius: 12,
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
        ) : null}

      </ScrollView>

      <AnchoredDropdown
        visible={showEventTypeDropdown}
        layout={eventTypeTriggerLayout}
        container={dropdownContainerWindow}
        animationStyle={{ opacity: 1 }}
        zIndex={340}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={closeCreateDropdowns}
        panelStyle={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
        scrollContentStyle={{ padding: 4 }}
      >
        {eventTypes.map((option, index) => {
          const active = eventType === option;
          return (
            <Pressable
              key={option}
              onPress={() => {
                setEventType(option);
                setShowEventTypeDropdown(false);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                borderRadius: 8,
                backgroundColor: active ? colors.primaryBg : colors.background,
              }}
            >
              <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>
                {eventTypeLabel[option]}
              </Text>
            </Pressable>
          );
        })}
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={showSportDropdown}
        layout={sportTriggerLayout}
        container={dropdownContainerWindow}
        animationStyle={{ opacity: 1 }}
        zIndex={340}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={closeCreateDropdowns}
        panelStyle={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
        scrollContentStyle={{ padding: 4 }}
      >
        {sportTypes.map((option, index) => {
          const active = sport === option;
          return (
            <Pressable
              key={option}
              onPress={() => {
                setSport(option);
                setShowSportDropdown(false);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                borderRadius: 8,
                backgroundColor: active ? colors.primaryBg : colors.background,
              }}
            >
              <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>
                {sportTypeLabel[option]}
              </Text>
            </Pressable>
          );
        })}
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={showNotificationDropdown}
        layout={notificationTriggerLayout}
        container={dropdownContainerWindow}
        animationStyle={{ opacity: 1 }}
        zIndex={340}
        maxHeight={200}
        nestedScrollEnabled
        onRequestClose={closeCreateDropdowns}
        panelStyle={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
        scrollContentStyle={{ padding: 4 }}
      >
        {[
          { key: "email" as const, label: "Email" },
          { key: "whatsapp" as const, label: "WhatsApp" },
        ].map((option, index) => {
          const active = notificationChannel === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => {
                setNotificationChannel(option.key);
                setShowNotificationDropdown(false);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                borderRadius: 8,
                backgroundColor: active ? colors.primaryBg : colors.background,
              }}
            >
              <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </AnchoredDropdown>

      <AnchoredDropdown
        visible={showReminderDropdown}
        layout={reminderTriggerLayout}
        container={dropdownContainerWindow}
        animationStyle={{ opacity: 1 }}
        zIndex={340}
        maxHeight={220}
        nestedScrollEnabled
        onRequestClose={closeCreateDropdowns}
        panelStyle={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background }}
        scrollContentStyle={{ padding: 4 }}
      >
        {reminderOptions.map((option, index) => {
          const active = reminderValue === option;
          return (
            <Pressable
              key={option}
              onPress={() => {
                setReminderValue(option);
                setShowReminderDropdown(false);
              }}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 10,
                borderTopWidth: index === 0 ? 0 : 1,
                borderTopColor: colors.border,
                borderRadius: 8,
                backgroundColor: active ? colors.primaryBg : colors.background,
              }}
            >
              <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>
                {option}
              </Text>
            </Pressable>
          );
        })}
      </AnchoredDropdown>
      </View>
    </SafeAreaView>
  );
}
