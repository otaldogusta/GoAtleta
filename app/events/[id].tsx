import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    useWindowDimensions,
    View,
} from "react-native";
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
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { formatDateTimeInputPtBr, parseDateTimeInput } from "../../src/utils/date-time";

const eventTypes: EventType[] = ["torneio", "amistoso", "treino", "reuniao", "outro"];
const sportTypes: EventSport[] = ["geral", "volei_quadra", "volei_praia", "futebol"];
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
type DropdownLayout = { x: number; y: number; width: number; height: number };
type DropdownPoint = { x: number; y: number };
type EventFormSnapshot = {
  title: string;
  description: string;
  eventType: EventType;
  sport: EventSport;
  startDateInput: string;
  startTimeInput: string;
  endDateInput: string;
  endTimeInput: string;
  locationLabel: string;
  classIds: string[];
};

const splitDateTimeInput = (value: string) => {
  const [datePart = "", timePart = ""] = value.trim().split(" ");
  return { datePart, timePart };
};

const toInputDate = (iso: string) => {
  const date = new Date(iso);
  return formatDateTimeInputPtBr(date);
};

const parseInputDate = (value: string) => {
  return parseDateTimeInput(value);
};

const buildSnapshot = (values: EventFormSnapshot) => {
  return JSON.stringify({
    ...values,
    title: values.title.trim(),
    description: values.description.trim(),
    locationLabel: values.locationLabel.trim(),
    classIds: [...values.classIds].sort(),
  });
};

export default function EventDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const eventId = params.id ?? "";
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { activeOrganization, isLoading: organizationLoading } = useOrganization();
  const { session } = useAuth();
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const isRowLayout = width >= 560;
  const sheetCardStyle = useModalCardStyle({
    maxHeight: "90%",
    maxWidth: 840,
    gap: 12,
    padding: 14,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; name: string; unitId: string }[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("treino");
  const [sport, setSport] = useState<EventSport>("geral");
  const [startDateInput, setStartDateInput] = useState("");
  const [startTimeInput, setStartTimeInput] = useState("");
  const [endDateInput, setEndDateInput] = useState("");
  const [endTimeInput, setEndTimeInput] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showEventTypeDropdown, setShowEventTypeDropdown] = useState(false);
  const [showSportDropdown, setShowSportDropdown] = useState(false);
  const [eventTypeTriggerLayout, setEventTypeTriggerLayout] = useState<DropdownLayout | null>(null);
  const [sportTriggerLayout, setSportTriggerLayout] = useState<DropdownLayout | null>(null);
  const [dropdownContainer, setDropdownContainer] = useState<DropdownPoint | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState("");

  const modalBodyRef = useRef<View | null>(null);
  const eventTypeTriggerRef = useRef<View | null>(null);
  const sportTriggerRef = useRef<View | null>(null);

  const startLabel = useMemo(() => {
    const parsed = parseInputDate(`${startDateInput} ${startTimeInput}`);
    return parsed ? parsed.toLocaleString("pt-BR") : "-";
  }, [startDateInput, startTimeInput]);

  const currentSnapshot = useMemo(
    () =>
      buildSnapshot({
        title,
        description,
        eventType,
        sport,
        startDateInput,
        startTimeInput,
        endDateInput,
        endTimeInput,
        locationLabel,
        classIds,
      }),
    [
      classIds,
      description,
      endDateInput,
      endTimeInput,
      eventType,
      locationLabel,
      sport,
      startDateInput,
      startTimeInput,
      title,
    ]
  );
  const hasChanges = currentSnapshot !== initialSnapshot;

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
        router.replace("/events");
        return;
      }
      setClasses(classRows.map((item) => ({ id: item.id, name: item.name, unitId: item.unitId })));
      setTitle(event.title);
      setDescription(event.description);
      setEventType(event.eventType);
      setSport(event.sport);
      const startValue = splitDateTimeInput(toInputDate(event.startsAt));
      const endValue = splitDateTimeInput(toInputDate(event.endsAt));
      setStartDateInput(startValue.datePart);
      setStartTimeInput(startValue.timePart);
      setEndDateInput(endValue.datePart);
      setEndTimeInput(endValue.timePart);
      setLocationLabel(event.locationLabel || "");
      setClassIds(event.classIds);
      setInitialSnapshot(
        buildSnapshot({
          title: event.title,
          description: event.description,
          eventType: event.eventType,
          sport: event.sport,
          startDateInput: startValue.datePart,
          startTimeInput: startValue.timePart,
          endDateInput: endValue.datePart,
          endTimeInput: endValue.timePart,
          locationLabel: event.locationLabel || "",
          classIds: event.classIds,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar evento.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?.id, eventId, router, session?.user?.id]);

  useEffect(() => {
    if (!eventId) {
      router.replace("/events");
      return;
    }
  }, [eventId, router]);

  useEffect(() => {
    if (organizationLoading) return;
    if (activeOrganization?.id) return;
    router.replace("/events");
  }, [activeOrganization?.id, organizationLoading, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitUpdate = async () => {
    if (!activeOrganization?.id || !isAdmin) return;
    if (!hasChanges) return;
    const startsAt = parseInputDate(`${startDateInput} ${startTimeInput}`);
    const endsAt = parseInputDate(`${endDateInput} ${endTimeInput}`);
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      Alert.alert("Validação", "Datas inválidas. Use Data (DD/MM/AAAA) e Horário (HH:mm).");
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
      const nav = router as unknown as { replace: (path: string) => void };
      nav.replace("/events");
    } catch (err) {
      Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!activeOrganization?.id || !isAdmin) return;
    confirmDialog({
      title: "Excluir evento",
      message: "Deseja realmente excluir este evento? Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: async () => {
        try {
          await deleteEvent(eventId, activeOrganization.id);
          router.replace("/events");
        } catch (err) {
          Alert.alert("Erro", err instanceof Error ? err.message : "Falha ao excluir.");
        }
      },
    });
  };

  const closeDetailDropdowns = () => {
    setShowEventTypeDropdown(false);
    setShowSportDropdown(false);
  };

  const openEventTypeDropdown = () => {
    if (!isAdmin) return;
    const next = !showEventTypeDropdown;
    closeDetailDropdowns();
    if (!next) return;
    requestAnimationFrame(() => {
      if (!eventTypeTriggerRef.current || !modalBodyRef.current) return;
      modalBodyRef.current.measureInWindow((containerX, containerY) => {
        setDropdownContainer({ x: containerX, y: containerY });
        eventTypeTriggerRef.current?.measureInWindow((x, y, widthValue, height) => {
          setEventTypeTriggerLayout({ x, y, width: widthValue, height });
          setShowEventTypeDropdown(true);
        });
      });
    });
  };

  const openSportDropdown = () => {
    if (!isAdmin) return;
    const next = !showSportDropdown;
    closeDetailDropdowns();
    if (!next) return;
    requestAnimationFrame(() => {
      if (!sportTriggerRef.current || !modalBodyRef.current) return;
      modalBodyRef.current.measureInWindow((containerX, containerY) => {
        setDropdownContainer({ x: containerX, y: containerY });
        sportTriggerRef.current?.measureInWindow((x, y, widthValue, height) => {
          setSportTriggerLayout({ x, y, width: widthValue, height });
          setShowSportDropdown(true);
        });
      });
    });
  };

  const closeDetails = () => {
    closeDetailDropdowns();
    const nav = router as unknown as { canGoBack?: () => boolean; back: () => void; replace: (path: string) => void };
    if (typeof nav.canGoBack === "function" && nav.canGoBack()) {
      nav.back();
      return;
    }
    nav.replace("/events");
  };

  useEffect(() => {
    closeDetailDropdowns();
  }, [width]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }}>
      <ModalSheet
        visible
        onClose={closeDetails}
        cardStyle={[sheetCardStyle, { overflow: "hidden" }]}
        position="center"
      >
        <View ref={modalBodyRef} style={{ width: "100%", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <View style={{ gap: 2, flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>Detalhes do evento</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Início: {startLabel}</Text>
          </View>
          <Pressable
            onPress={closeDetails}
            style={{
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Fechar</Text>
          </Pressable>
        </View>

        <ScrollView style={{ width: "100%" }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
          {error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}
          {loading ? (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: isRowLayout ? "row" : "column", gap: 8 }}>
                <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 10 }} />
                <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 10 }} />
              </View>
              <ShimmerBlock style={{ height: 84, borderRadius: 10 }} />
              <View style={{ flexDirection: isRowLayout ? "row" : "column", gap: 8 }}>
                <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 10 }} />
                <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 10 }} />
              </View>
              <View style={{ flexDirection: isRowLayout ? "row" : "column", gap: 8 }}>
                <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 10 }} />
                <ShimmerBlock style={{ flex: 1, height: 44, borderRadius: 10 }} />
              </View>
              <ShimmerBlock style={{ height: 40, borderRadius: 999 }} />
              <ShimmerBlock style={{ height: 44, borderRadius: 10 }} />
            </View>
          ) : (
            <>
              <View style={{ flexDirection: isRowLayout ? "row" : "column", gap: 8 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Título</Text>
                  <TextInput value={title} onChangeText={setTitle} editable={isAdmin} placeholder="Título" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Local</Text>
                  <TextInput value={locationLabel} onChangeText={setLocationLabel} editable={isAdmin} placeholder="Local" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>Descrição</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  editable={isAdmin}
                  placeholder="Descrição"
                  placeholderTextColor={colors.muted}
                  multiline
                  style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9, minHeight: 72, textAlignVertical: "top" }}
                />
              </View>

              <View style={{ flexDirection: isRowLayout ? "row" : "column", gap: 8 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Data início</Text>
                  <TextInput value={startDateInput} onChangeText={setStartDateInput} editable={isAdmin} placeholder="DD/MM/AAAA" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Horário início</Text>
                  <TextInput value={startTimeInput} onChangeText={setStartTimeInput} editable={isAdmin} placeholder="HH:mm" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
                </View>
              </View>

              <View style={{ flexDirection: isRowLayout ? "row" : "column", gap: 8 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Data fim</Text>
                  <TextInput value={endDateInput} onChangeText={setEndDateInput} editable={isAdmin} placeholder="DD/MM/AAAA" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Horário fim</Text>
                  <TextInput value={endTimeInput} onChangeText={setEndTimeInput} editable={isAdmin} placeholder="HH:mm" placeholderTextColor={colors.muted} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, color: colors.text, backgroundColor: colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 9 }} />
                </View>
              </View>

              <View style={{ flexDirection: isRowLayout ? "row" : "column", gap: 8 }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Categoria</Text>
                  <View ref={eventTypeTriggerRef}>
                    <Pressable
                      onPress={openEventTypeDropdown}
                      disabled={!isAdmin}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        opacity: isAdmin ? 1 : 0.7,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{eventTypeLabel[eventType]}</Text>
                      <Ionicons
                        name={showEventTypeDropdown ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Esporte</Text>
                  <View ref={sportTriggerRef}>
                    <Pressable
                      onPress={openSportDropdown}
                      disabled={!isAdmin}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        backgroundColor: colors.secondaryBg,
                        paddingHorizontal: 10,
                        paddingVertical: 10,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        opacity: isAdmin ? 1 : 0.7,
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>{sportTypeLabel[sport]}</Text>
                      <Ionicons
                        name={showSportDropdown ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.muted}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

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
                <Pressable
                  onPress={submitUpdate}
                  disabled={saving || !hasChanges}
                  style={{
                    borderRadius: 10,
                    paddingVertical: 11,
                    alignItems: "center",
                    backgroundColor: saving || !hasChanges ? colors.primaryDisabledBg : colors.primaryBg,
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                    {saving ? "Salvando..." : "Salvar alterações"}
                  </Text>
                </Pressable>
              ) : null}
              {isAdmin ? (
                <Pressable
                  onPress={handleDelete}
                  style={{
                    borderRadius: 12,
                    paddingVertical: 10,
                    alignItems: "center",
                    backgroundColor: colors.dangerSolidBg,
                  }}
                >
                  <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>Excluir evento</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>

        <AnchoredDropdown
          visible={showEventTypeDropdown}
          layout={eventTypeTriggerLayout}
          container={dropdownContainer}
          animationStyle={{ opacity: 1 }}
          zIndex={420}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeDetailDropdowns}
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
          container={dropdownContainer}
          animationStyle={{ opacity: 1 }}
          zIndex={420}
          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeDetailDropdowns}
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
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}
