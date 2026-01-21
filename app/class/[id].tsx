import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  Text,
  TextInput,
  Vibration,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ClassGroup, ScoutingLog } from "../../src/core/models";
import {
  countsFromLog,
  getFocusSuggestion,
  getSkillMetrics,
  scoutingSkills,
} from "../../src/core/scouting";
import {
  deleteClassCascade,
  duplicateClass,
  getClassById,
  getClasses,
  getLatestScoutingLog,
  getStudentsByClass,
  updateClass,
} from "../../src/db/seed";
import { logAction } from "../../src/observability/breadcrumbs";
import { measure } from "../../src/observability/perf";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { animateLayout } from "../../src/ui/animate-layout";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { useWhatsAppSettings } from "../../src/ui/whatsapp-settings-context";
import { buildWaMeLink, getContactPhone, getDefaultMessage, openWhatsApp } from "../../src/utils/whatsapp";
import {
  WHATSAPP_TEMPLATES,
  WhatsAppTemplateId,
  calculateNextClassDate,
  formatNextClassDate,
  getSuggestedTemplate,
  renderTemplate
} from "../../src/utils/whatsapp-templates";

export default function ClassDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm } = useConfirmUndo();
  const { defaultMessageEnabled, setDefaultMessageEnabled, coachName, groupInviteLinks } = useWhatsAppSettings();
  const whatsappModalCardStyle = useModalCardStyle({ maxHeight: "75%", maxWidth: 360 });
  const contactListHeightAnim = useMemo(() => new Animated.Value(0), []);
  const [showWhatsAppSettingsModal, setShowWhatsAppSettingsModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<WhatsAppTemplateId | null>(null);
  const [customWhatsAppMessage, setCustomWhatsAppMessage] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [availableContacts, setAvailableContacts] = useState<Array<{ studentName: string; phone: string; source: "guardian" | "student" }>>([]);
  const [selectedContactIndex, setSelectedContactIndex] = useState(-1);
  const [showContactList, setShowContactList] = useState(false);
  const [cls, setCls] = useState<ClassGroup | null>(null);
  
  // Animate contact list opening/closing
  useEffect(() => {
    if (showContactList) {
      Animated.timing(contactListHeightAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(contactListHeightAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [showContactList, contactListHeightAnim]);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [ageBand, setAgeBand] = useState<ClassGroup["ageBand"]>("08-09");
  const [gender, setGender] = useState<ClassGroup["gender"]>("misto");
  const [startTime, setStartTime] = useState("14:00");
  const [duration, setDuration] = useState("60");
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [latestScouting, setLatestScouting] = useState<ScoutingLog | null>(null);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [goal, setGoal] = useState<ClassGroup["goal"]>("Fundamentos");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showDetails, setShowDetails] = usePersistedState<boolean>(
    "class_details_show_info_v1",
    true
  );
  const {
    animatedStyle: detailsAnimStyle,
    isVisible: showDetailsContent,
  } = useCollapsibleAnimation(showDetails);
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const ageBandOptions = [
    "06-08",
    "08-09",
    "08-11",
    "09-11",
    "10-12",
    "12-14",
    "13-15",
    "16-18",
  ];
  const goals: ClassGroup["goal"][] = [
    "Fundamentos",
    "Forca Geral",
    "Potencia/Agilidade",
    "Forca+Potencia",
    "Velocidade",
    "Agilidade",
    "Resistencia",
    "Potencia",
    "Mobilidade",
    "Coordenacao",
    "Prevencao de lesoes",
  ];
  const durationOptions = ["60", "75", "90"];
  const formatDays = (days: number[]) =>
    days.length ? days.map((day) => dayNames[day]).join(", ") : "-";
  const getChipStyle = (active: boolean, palette?: { bg: string; text: string }) => ({
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: active ? palette?.bg ?? colors.primaryBg : colors.secondaryBg,
  });
  const getChipTextStyle = (active: boolean, palette?: { bg: string; text: string }) => ({
    color: active ? palette?.text ?? colors.primaryText : colors.text,
    fontWeight: "600" as const,
    fontSize: 12,
  });
  const normalizeTimeInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
  };
  const isValidTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return false;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  };
  const parseDuration = (value: string) => {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return null;
    return minutes >= 30 && minutes <= 180 ? minutes : null;
  };
  const parseTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };
  const formatTimeRange = (hour: number, minute: number, durationMinutes: number) => {
    const start = hour * 60 + minute;
    const end = start + durationMinutes;
    const endHour = Math.floor(end / 60) % 24;
    const endMinute = end % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(hour)}:${pad(minute)} - ${pad(endHour)}:${pad(endMinute)}`;
  };
  const safeFileName = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "turma";
  const escapeCsv = (value: string | number | null | undefined) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const formatShortDate = (value: string) =>
    value.includes("-") ? value.split("-").reverse().join("/") : value;
  const toMinutes = (value: string) => {
    if (!isValidTime(value)) return null;
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const clsId = cls?.id ?? "";
  const clsUnit = cls?.unit ?? "";
  const currentUnit = unit.trim() || clsUnit || "Sem unidade";
  const unitLabel = clsUnit || "Sem unidade";
  const className = cls?.name || "Turma";
  const classAgeBand = cls?.ageBand || ageBand;
  const classGender = cls?.gender || gender;
  const classDays = cls?.daysOfWeek ?? [];
  const classStartTime = cls?.startTime || "-";
  const classDuration = cls?.durationMinutes ?? 60;
  const classGoal = cls?.goal || goal;
  const unitPalette = getUnitPalette(unitLabel, colors);
  const conflictSummary = useMemo(() => {
    if (!clsId) return [];
    const start = toMinutes(startTime.trim());
    const durationValue = parseDuration(duration.trim());
    if (start === null || !durationValue) return [];
    const end = start + durationValue;
    return allClasses
      .filter((item) => item.id !== clsId)
      .filter((item) => (item.unit || "Sem unidade") === currentUnit)
      .filter((item) => item.daysOfWeek.some((day) => daysOfWeek.includes(day)))
      .filter((item) => {
        const otherStart = toMinutes(item.startTime || "");
        if (otherStart === null) return false;
        const otherEnd = otherStart + (item.durationMinutes || 60);
        return start < otherEnd && otherStart < end;
      })
      .map((item) => {
        const sharedDays = item.daysOfWeek.filter((day) =>
          daysOfWeek.includes(day)
        );
        return `${item.name} (${sharedDays.map((day) => dayNames[day]).join(", ")})`;
      });
  }, [allClasses, clsId, currentUnit, daysOfWeek, duration, startTime]);
  const goalSuggestions = useMemo(() => {
    if (!clsUnit) return [];
    const matches = allClasses.filter((item) => item.unit === clsUnit);
    const counts = new Map<string, number>();
    matches.forEach((item) => {
      counts.set(item.goal, (counts.get(item.goal) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([goal]) => goal)
      .filter((goal) => goal && !goals.includes(goal))
      .slice(0, 4);
  }, [allClasses, clsUnit, goals]);

  const scoutingCounts = useMemo(() => {
    if (!latestScouting) return null;
    return countsFromLog(latestScouting);
  }, [latestScouting]);

  const scoutingFocus = useMemo(() => {
    if (!scoutingCounts) return null;
    return getFocusSuggestion(scoutingCounts, 10);
  }, [scoutingCounts]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClassById(id);
      const list = await getClasses();
      const scouting = data ? await getLatestScoutingLog(data.id) : null;
      if (alive) {
        setCls(data);
        setAllClasses(list);
        setLatestScouting(scouting);
        setName(data?.name ?? "");
        setUnit(data?.unit ?? "");
        setAgeBand(data?.ageBand ?? "08-09");
        setGender(data?.gender ?? "misto");
        setStartTime(data?.startTime ?? "14:00");
        setDuration(String(data?.durationMinutes ?? 60));
        setDaysOfWeek(data?.daysOfWeek ?? []);
        setGoal(data?.goal ?? "Fundamentos");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!cls) {
    return (
      <SafeAreaView
        style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          Turma nao encontrada
        </Text>
      </SafeAreaView>
    );
  }

  const toggleDay = (value: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]
    );
  };

  const saveUnit = async () => {
    if (!cls) return;
    const timeValue = startTime.trim();
    if (!isValidTime(timeValue)) {
      setFormError("Horario invalido. Use HH:MM.");
      Vibration.vibrate(40);
      return;
    }
    const durationValue = parseDuration(duration.trim());
    if (!durationValue) {
      setFormError("Duracao invalida. Use minutos entre 30 e 180.");
      Vibration.vibrate(40);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      await updateClass(cls.id, {
        name: name.trim() || cls.name,
        unit: unit.trim() || "Rede Esperanca",
        daysOfWeek,
        goal,
        ageBand: ageBand.trim() || cls.ageBand,
        gender,
        startTime: timeValue,
        durationMinutes: durationValue,
      });
      Vibration.vibrate(60);
      const fresh = await getClassById(cls.id);
      setCls(fresh);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onDuplicate = () => {
    if (!cls) return;
    Alert.alert(
      "Duplicar turma",
      "Deseja criar uma copia desta turma?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Duplicar",
          onPress: async () => {
            await duplicateClass(cls);
            router.replace("/classes");
          },
        },
      ]
    );
  };

  const onDelete = () => {
    if (!cls) return;
    Vibration.vibrate([0, 80, 60, 80]);
    confirm({
      title: "Excluir turma?",
      message:
        "Isso remove planejamentos, chamadas e alunos da turma. Deseja excluir?",
      confirmLabel: "Excluir",
      undoMessage: "Turma excluida. Deseja desfazer?",
      onConfirm: async () => {
        await measure("deleteClassCascade", () => deleteClassCascade(cls.id));
        logAction("Excluir turma", { classId: cls.id });
        router.replace("/classes");
      },
    });
  };

  const buildRosterCsv = (students: Awaited<ReturnType<typeof getStudentsByClass>>) => {
    const exportDate = new Date().toISOString().slice(0, 10);
    const classTitle = `${classAgeBand} ${classStartTime}`;
    const header = [
      "unit",
      "class_id",
      "class_name",
      "class_title",
      "age_band",
      "days_of_week",
      "start_time",
      "export_date",
      "participant_name",
      "age",
      "phone",
      "guardian_name",
      "guardian_phone",
      "contact_phone",
      "contact_source",
      "whatsapp_link",
      "phone_status",
    ];
    const rows = students.map((student) => {
      const contact = getContactPhone(student);
      return [
        unitLabel,
        cls.id,
        className,
        classTitle,
        classAgeBand,
        formatDays(classDays),
        classStartTime,
        exportDate,
        student.name,
        student.age,
        student.phone,
        student.guardianName ?? "",
        student.guardianPhone ?? "",
        contact.status === "ok" ? contact.phoneDigits.slice(2) : "",
        contact.source ?? "",
        contact.status === "ok" ? buildWaMeLink(contact.phoneDigits) : "",
        contact.status,
      ];
    });
    return [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
  };

  const handleExportRoster = async () => {
    if (!cls) return;
    
    // Ask user what type of CSV they want
    Alert.alert(
      "Tipo de exportação",
      "Escolha o tipo de lista:",
      [
        {
          text: "Lista completa",
          onPress: () => exportCsv(false),
        },
        {
          text: "Apenas WhatsApp",
          onPress: () => exportCsv(true),
          style: "default",
        },
        {
          text: "Cancelar",
          style: "cancel",
        },
      ]
    );
  };

  const exportCsv = async (whatsappOnly: boolean) => {
    if (Platform.OS !== "web") {
      // Mobile: Use Share API
      const list = await getStudentsByClass(cls?.id || "");
      const csv = whatsappOnly ? buildWhatsAppCsv(list) : buildRosterCsv(list);
      const className = cls?.name || "Turma";
      await Share.share({
        title: `Lista de chamada - ${className}`,
        message: csv,
      });
      return;
    }
    
    // Web: Export as file
    const list = await getStudentsByClass(cls?.id || "");
    const csv = whatsappOnly ? buildWhatsAppCsv(list) : buildRosterCsv(list);
    const suffix = whatsappOnly ? "_whatsapp" : "_completa";
    const fileName = `lista_chamada_${safeFileName(unitLabel)}_${safeFileName(cls?.id || "")}${suffix}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const buildWhatsAppCsv = (students: Awaited<ReturnType<typeof getStudentsByClass>>) => {
    const exportDate = new Date().toISOString().slice(0, 10);
    const header = [
      "unit",
      "class_name",
      "participant_name",
      "contact_source",
      "contact_phone",
      "whatsapp_link",
      "phone_status",
      "export_date",
    ];
    const rows = students.map((student) => {
      const contact = getContactPhone(student);
      return [
        unitLabel,
        className,
        student.name,
        contact.source ?? "",
        contact.status === "ok" ? contact.phoneDigits.slice(2) : "",
        contact.status === "ok" ? buildWaMeLink(contact.phoneDigits) : "",
        contact.status,
        exportDate,
      ];
    });
    return [header, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
  };

  const handleWhatsAppGroup = async () => {
    if (!cls) return;
    const list = await getStudentsByClass(cls.id);
    const validContacts = list
      .map((student) => {
        const contact = getContactPhone(student);
        return { student, contact };
      })
      .filter((item) => item.contact.status === "ok")
      .map((item) => ({
        studentName: item.student.name,
        phone: item.contact.phoneDigits,
        source: item.contact.source as "guardian" | "student",
      }));

    if (validContacts.length === 0) {
      Alert.alert(
        "Nenhum telefone válido encontrado",
        "Adicione telefones dos responsáveis ou alunos (com DDD) para usar o WhatsApp."
      );
      return;
    }

    setAvailableContacts(validContacts);
    setSelectedContactIndex(-1);
    
    // Suggest template based on context
    const suggestedTemplate = getSuggestedTemplate({ screen: "class" });
    setSelectedTemplateId(suggestedTemplate);
    
    // Generate template message if enabled
    if (defaultMessageEnabled) {
      const nextClassDate = calculateNextClassDate(daysOfWeek);
      const message = renderTemplate(suggestedTemplate, {
        coachName,
        className: name || cls.name,
        unitLabel,
        dateLabel: new Date().toLocaleDateString("pt-BR"),
        nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
        nextClassTime: startTime,
        groupInviteLink: groupInviteLinks[cls.id] || "",
      });
      setCustomWhatsAppMessage(message);
    } else {
      setCustomWhatsAppMessage("");
    }
    
    setCustomFields({});
    setShowWhatsAppSettingsModal(true);
  };

  const sendWhatsAppMessage = async () => {
    if (availableContacts.length === 0 || selectedContactIndex < 0) {
      Alert.alert("Selecione um contato", "Por favor, escolha um contato para enviar a mensagem.");
      return;
    }
    const selectedContact = availableContacts[selectedContactIndex];
    if (!selectedContact) return;
    
    // Usar mensagem customizada se fornecida, senão usar padrão
    let messageText = customWhatsAppMessage.trim();
    if (!messageText) {
      messageText = getDefaultMessage("global", { className, unitLabel, enabledOverride: defaultMessageEnabled });
    }
    
    const url = buildWaMeLink(selectedContact.phone, messageText);
    await openWhatsApp(url);
    setShowWhatsAppSettingsModal(false);
    setCustomWhatsAppMessage(""); // Limpar a mensagem customizada após envio
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            {className}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={getChipStyle(true, unitPalette)}>
              <Text style={getChipTextStyle(true, unitPalette)}>{unitLabel}</Text>
            </View>
            <View style={getChipStyle(true, { bg: colors.secondaryBg, text: colors.text })}>
              <Text style={getChipTextStyle(true, { bg: colors.secondaryBg, text: colors.text })}>
                {"Faixa " + classAgeBand}
              </Text>
            </View>
            <ClassGenderBadge gender={classGender} size="md" />
          </View>
        </View>

        <View
          style={[
            getSectionCardStyle(colors, "neutral", { radius: 16, padding: 12 }),
            { borderLeftWidth: 3, borderLeftColor: unitPalette.bg },
          ]}
        >
          <Pressable
            onPress={() => {
              animateLayout();
              setShowDetails((prev) => !prev);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: colors.inputBg,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Informacoes
            </Text>
            <MaterialCommunityIcons
              name={showDetails ? "chevron-down" : "chevron-right"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          {showDetailsContent ? (
            <Animated.View style={detailsAnimStyle}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: unitPalette.bg,
                  }}
                />
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                  {(() => {
                    const parsed = parseTime(classStartTime);
                    if (!parsed) return className;
                    return `${formatTimeRange(parsed.hour, parsed.minute, classDuration)} - ${className}`;
                  })()}
                </Text>
              </View>
              <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                {"Faixa: " + classAgeBand}
              </Text>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 6, alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Genero:</Text>
                <ClassGenderBadge gender={classGender} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Dias</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {formatDays(classDays)}
                  </Text>
                </View>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Horario</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {classStartTime}
                  </Text>
                </View>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Duracao</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {classDuration + " min"}
                  </Text>
                </View>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {classGoal}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ) : null}
        </View>

        <View style={getSectionCardStyle(colors, "primary", { radius: 18 })}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Acoes rapidas
          </Text>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/class/[id]/session", params: { id } })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.primaryBg,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 15 }}>
                Ver aula do dia
              </Text>
              <Text style={{ color: colors.primaryText, marginTop: 6, opacity: 0.85 }}>
                Plano e cronometro
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/attendance",
                  params: { id },
                })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.successBg,
              }}
            >
              <Text style={{ color: colors.successText, fontWeight: "700", fontSize: 15 }}>
                Fazer chamada
              </Text>
              <Text style={{ color: colors.successText, marginTop: 6, opacity: 0.7 }}>
                Presenca rapida
              </Text>
            </Pressable>
            <Pressable
              onPress={handleExportRoster}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>
                Exportar lista da turma
              </Text>
              <Text style={{ color: colors.muted, marginTop: 6 }}>
                Completa ou apenas WhatsApp
              </Text>
            </Pressable>
            <Pressable
              onPress={handleWhatsAppGroup}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: "#25D366",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                WhatsApp
              </Text>
              <Text style={{ color: "white", marginTop: 6, opacity: 0.9 }}>
                Contato responsável
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={getSectionCardStyle(colors, "neutral", { radius: 18 })}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Scouting recente
          </Text>
          {latestScouting && scoutingCounts ? (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {formatShortDate(latestScouting.date)}
                </Text>
                <View
                  style={{
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                    {latestScouting.mode === "jogo" ? "Jogo" : "Treino"}
                  </Text>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                {scoutingSkills.map((skill) => {
                  const metrics = getSkillMetrics(scoutingCounts[skill.id]);
                  const goodPct = Math.round(metrics.goodPct * 100);
                  return (
                    <View key={skill.id} style={{ flexDirection: "row", gap: 10 }}>
                      <Text style={{ color: colors.text, fontWeight: "700", minWidth: 90 }}>
                        {skill.label}
                      </Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {metrics.total} acoes | media {metrics.avg.toFixed(2)} | boas {goodPct}%
                      </Text>
                    </View>
                  );
                })}
              </View>
              {scoutingFocus ? (
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Foco sugerido: {scoutingFocus.label}
                  </Text>
                  <Text style={{ color: colors.muted }}>{scoutingFocus.text}</Text>
                </View>
              ) : (
                <Text style={{ color: colors.muted }}>
                  Registre pelo menos 10 acoes para sugerir foco.
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ color: colors.muted }}>
              Nenhum scouting registrado ainda.
            </Text>
          )}
        </View>

      </ScrollView>
      </KeyboardAvoidingView>

      <ModalSheet
        visible={showWhatsAppSettingsModal}
        onClose={() => setShowWhatsAppSettingsModal(false)}
        cardStyle={whatsappModalCardStyle}
        position="center"
      >
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Configurar WhatsApp
          </Text>

          {/* Template Selector */}
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
              Modelo de mensagem:
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                onPress={() => {
                  const scrollView = document.querySelector('[data-template-scroll-class]');
                  if (scrollView) scrollView.scrollBy({ left: -200, behavior: 'smooth' });
                }}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: colors.text }}>‹</Text>
              </Pressable>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ flex: 1 }}
                {...(Platform.OS === 'web' ? { 'data-template-scroll-class': true } : {})}
              >
              {Object.values(WHATSAPP_TEMPLATES)
                .filter((template) => template.id !== "student_invite")
                .map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const nextClassDate = calculateNextClassDate(daysOfWeek);
                
                let canUse = true;
                let missingRequirement = "";
                
                if (template.requires) {
                  for (const req of template.requires) {
                    if ((req === "nextClassDate" || req === "nextClassTime") && !nextClassDate) {
                      canUse = false;
                      missingRequirement = "Dias da semana não configurados";
                      break;
                    }
                    if (req === "groupInviteLink" && !groupInviteLinks[cls?.id || ""]) {
                      canUse = false;
                      missingRequirement = "Link do grupo não configurado";
                      break;
                    }
                  }
                }
                
                return (
                  <Pressable
                    key={template.id}
                    disabled={!canUse}
                    onPress={() => {
                      if (!canUse) {
                        alert(missingRequirement);
                        return;
                      }
                      setSelectedTemplateId(template.id);
                      if (defaultMessageEnabled) {
                        const message = renderTemplate(template.id, {
                          coachName,
                          className: name || cls?.name || "",
                          unitLabel,
                          dateLabel: new Date().toLocaleDateString("pt-BR"),
                          studentName: selectedContactIndex >= 0 ? availableContacts[selectedContactIndex]?.studentName : "",
                          nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
                          nextClassTime: startTime,
                          groupInviteLink: groupInviteLinks[cls?.id || ""] || "",
                          ...customFields,
                        });
                        setCustomWhatsAppMessage(message);
                      }
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      backgroundColor: isSelected ? "#E8F5E9" : colors.inputBg,
                      borderWidth: 1,
                      borderColor: isSelected ? "#25D366" : colors.border,
                      marginRight: 6,
                      opacity: canUse ? 1 : 0.4,
                    }}
                  >
                    <Text style={{ 
                      fontSize: 12, 
                      fontWeight: "600", 
                      color: isSelected ? "#1a7a3d" : colors.text 
                    }}>
                      {template.title}
                    </Text>
                    {!canUse && (
                      <Text style={{ fontSize: 9, color: colors.dangerText, marginTop: 2 }}>
                        ⚠️ {missingRequirement}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
              </ScrollView>
              <Pressable
                onPress={() => {
                  const scrollView = document.querySelector('[data-template-scroll-class]');
                  if (scrollView) scrollView.scrollBy({ left: 200, behavior: 'smooth' });
                }}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: colors.text }}>›</Text>
              </Pressable>
            </View>
          </View>

          {/* Custom Fields for Templates */}
          {selectedTemplateId && WHATSAPP_TEMPLATES[selectedTemplateId].requires && (
            <View style={{ gap: 6 }}>
              {WHATSAPP_TEMPLATES[selectedTemplateId].requires?.map((field) => {
                if (field === "nextClassDate" || field === "nextClassTime" || field === "groupInviteLink") return null;
                
                const labels: Record<string, string> = {
                  highlightNote: "Destaque (opcional):",
                  customText: "Mensagem do aviso:",
                };
                
                return (
                  <View key={field}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>
                      {labels[field] || field}
                    </Text>
                    <TextInput
                      placeholder={field === "highlightNote" ? "Ex.: evolução na técnica" : "Digite sua mensagem..."}
                      placeholderTextColor={colors.muted}
                      value={customFields[field] || ""}
                      onChangeText={(text) => {
                        const updated = { ...customFields, [field]: text };
                        setCustomFields(updated);
                        if (defaultMessageEnabled && selectedTemplateId) {
                          const nextClassDate = calculateNextClassDate(daysOfWeek);
                          const message = renderTemplate(selectedTemplateId, {
                            coachName,
                            className: name || cls?.name || "",
                            unitLabel,
                            dateLabel: new Date().toLocaleDateString("pt-BR"),
                            studentName: selectedContactIndex >= 0 ? availableContacts[selectedContactIndex]?.studentName : "",
                            nextClassDate: nextClassDate ? formatNextClassDate(nextClassDate) : "",
                            nextClassTime: startTime,
                            groupInviteLink: groupInviteLinks[cls?.id || ""] || "",
                            ...updated,
                          });
                          setCustomWhatsAppMessage(message);
                        }
                      }}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        backgroundColor: colors.inputBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        color: colors.text,
                        fontSize: 12,
                      }}
                    />
                  </View>
                );
              })}
            </View>
          )}

          {/* Contact Selector */}
          {availableContacts.length > 0 && (
            <View style={{ gap: 6, position: "relative", zIndex: 100 }}>
              <Pressable
                onPress={() => setShowContactList(!showContactList)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 10,
                  borderRadius: 8,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
                    Enviar para:
                  </Text>
                  {selectedContactIndex >= 0 ? (
                    <>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 2 }}>
                        {availableContacts[selectedContactIndex]?.studentName}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.muted }}>
                        {availableContacts[selectedContactIndex]?.source === "guardian" ? "Responsável" : "Aluno"} • {availableContacts[selectedContactIndex]?.phone.replace(/^55/, "").replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: 2 }}>
                      Selecione um contato...
                    </Text>
                  )}
                </View>
                <MaterialCommunityIcons
                  name={showContactList ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.muted}
                />
              </Pressable>
              
              <Animated.View
                pointerEvents={showContactList ? "auto" : "none"}
                style={{
                  position: "absolute",
                  top: 75,
                  left: 0,
                  right: 0,
                  maxHeight: 300,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 12,
                  elevation: 10,
                  zIndex: 9999,
                  overflow: "hidden",
                  transform: [
                    {
                      translateY: contactListHeightAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-20, 0],
                      }),
                    },
                  ],
                  opacity: contactListHeightAnim,
                }}
                >
                  <ScrollView
                    style={{ maxHeight: 300 }}
                    contentContainerStyle={{ padding: 4 }}
                    showsVerticalScrollIndicator
                  >
                    {availableContacts.map((contact, index) => {
                      const isSelected = selectedContactIndex === index;
                      return (
                        <Pressable
                          key={index}
                          onPress={() => {
                            setSelectedContactIndex(index);
                            setShowContactList(false);
                          }}
                          style={{
                            padding: 10,
                            borderRadius: 8,
                            backgroundColor: isSelected 
                              ? "#E8F5E9" 
                              : colors.inputBg,
                            borderWidth: isSelected ? 1 : 0,
                            borderColor: "#25D366",
                            margin: 2,
                          }}
                        >
                          <Text style={{ 
                            fontSize: 13, 
                            fontWeight: "600", 
                            color: isSelected ? "#1a7a3d" : colors.text 
                          }}>
                            {contact.studentName}
                          </Text>
                          <Text style={{ 
                            fontSize: 11, 
                            color: isSelected ? "#2d6b45" : colors.muted, 
                            marginTop: 2 
                          }}>
                            {contact.source === "guardian" ? "Responsável" : "Aluno"} • {contact.phone.replace(/^55/, "").replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
            </View>
          )}

          {/* Toggle */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>
                Mensagem padrão
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {defaultMessageEnabled ? "Ativada" : "Desativada"}
              </Text>
            </View>
            <Pressable
              onPress={() => setDefaultMessageEnabled(!defaultMessageEnabled)}
              style={{
                width: 50,
                height: 28,
                borderRadius: 14,
                backgroundColor: defaultMessageEnabled ? "#25D366" : colors.secondaryBg,
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "white",
                  marginLeft: defaultMessageEnabled ? 22 : 2,
                  position: "absolute",
                }}
              />
            </Pressable>
          </View>

          {/* Message Input */}
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>
              {defaultMessageEnabled ? "Mensagem (deixe em branco para usar padrão):" : "Mensagem personalizada:"}
            </Text>
            <TextInput
              placeholder={defaultMessageEnabled ? `Exemplo: Olá! Sou o professor Gustavo da turma ${className} (${unitLabel}).` : "Digite sua mensagem..."}
              placeholderTextColor={colors.muted}
              value={customWhatsAppMessage}
              onChangeText={setCustomWhatsAppMessage}
              multiline
              numberOfLines={3}
              style={{
                padding: 10,
                borderRadius: 8,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
                color: colors.text,
                fontSize: 12,
                textAlignVertical: "top",
              }}
            />
            {defaultMessageEnabled && !customWhatsAppMessage.trim() && (
              <Text style={{ fontSize: 10, color: colors.muted, fontStyle: "italic" }}>
                Mensagem padrão: "Olá! Sou o professor Gustavo da turma {className} ({unitLabel})."
              </Text>
            )}
          </View>

          {/* Send Button */}
          <Pressable
            onPress={selectedContactIndex >= 0 ? sendWhatsAppMessage : undefined}
            disabled={selectedContactIndex < 0}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 14,
              borderRadius: 12,
              backgroundColor: selectedContactIndex >= 0 ? "#25D366" : "#ccc",
              alignItems: "center",
              marginTop: 8,
              opacity: selectedContactIndex >= 0 ? 1 : 0.6,
            }}
          >
            <Text style={{ color: selectedContactIndex >= 0 ? "white" : "#666", fontWeight: "700", fontSize: 14 }}>
              Enviar via WhatsApp
            </Text>
          </Pressable>

          {/* Close Button */}
          <Pressable
            onPress={() => setShowWhatsAppSettingsModal(false)}
            style={{
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "600", fontSize: 13 }}>
              Fechar
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}




