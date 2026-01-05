import {
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { DatePickerModal } from "../../src/ui/DatePickerModal";

import {
  getClasses,
  getStudents,
  saveStudent,
  updateStudent,
  deleteStudent,
  seedStudentsIfEmpty,
} from "../../src/db/seed";
import type { ClassGroup, Student } from "../../src/core/models";
import { Button } from "../../src/ui/Button";
import { animateLayout } from "../../src/ui/animate-layout";
import { useAppTheme } from "../../src/ui/app-theme";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";
import { notifyBirthdays } from "../../src/notifications";
import { ConfirmCloseOverlay } from "../../src/ui/ConfirmCloseOverlay";
import { DateInput } from "../../src/ui/DateInput";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { ModalSheet } from "../../src/ui/ModalSheet";

export default function StudentsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const editModalCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classId, setClassId] = useState("");
  const [showForm, setShowForm] = usePersistedState<boolean>(
    "students_show_form_v1",
    false
  );
  const {
    animatedStyle: formAnimStyle,
    isVisible: showFormContent,
  } = useCollapsibleAnimation(showForm);
  const [unit, setUnit] = useState("");
  const [ageBand, setAgeBand] = useState<ClassGroup["ageBand"]>("");
  const [customAgeBand, setCustomAgeBand] = useState("");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [ageNumber, setAgeNumber] = useState<number | null>(null);
  const [phone, setPhone] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditCloseConfirm, setShowEditCloseConfirm] = useState(false);
  const [studentFormError, setStudentFormError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const saveNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNoticeAnim = useRef(new Animated.Value(0)).current;
  const [editSnapshot, setEditSnapshot] = useState<{
    unit: string;
    ageBand: string;
    customAgeBand: string;
    classId: string;
    name: string;
    birthDate: string;
    phone: string;
  } | null>(null);
  const [lastBirthdayNotice, setLastBirthdayNotice] = usePersistedState<string>(
    "students_birthday_notice_v1",
    ""
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const [classList, studentList] = await Promise.all([
        getClasses(),
        getStudents(),
      ]);
      let nextStudents = studentList;
      if (studentList.length === 0) {
        await seedStudentsIfEmpty();
        nextStudents = await getStudents();
      }
      if (!alive) return;
      setClasses(classList);
      setStudents(nextStudents);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reload = async () => {
    const data = await getStudents();
    setStudents(data);
  };

  const unitLabel = (value?: string) =>
    value && value.trim() ? value.trim() : "Sem unidade";

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((item) => {
      set.add(unitLabel(item.unit));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [classes]);

  const ageBandOptions = useMemo(() => {
    const set = new Set<ClassGroup["ageBand"]>();
    classes.forEach((item) => {
      if (item.ageBand) set.add(item.ageBand);
    });
    const parse = (value: string) => {
      const [startRaw, endRaw] = value.split("-");
      const start = Number(startRaw);
      const end = Number(endRaw);
      return {
        start: Number.isFinite(start) ? start : Number.POSITIVE_INFINITY,
        end: Number.isFinite(end) ? end : Number.POSITIVE_INFINITY,
        label: value,
      };
    };
    return Array.from(set).sort((a, b) => {
      const aParsed = parse(a);
      const bParsed = parse(b);
      if (aParsed.start !== bParsed.start) return aParsed.start - bParsed.start;
      if (aParsed.end !== bParsed.end) return aParsed.end - bParsed.end;
      return aParsed.label.localeCompare(bParsed.label);
    });
  }, [classes]);

  useEffect(() => {
    if (!classes.length) return;
    if (!showForm) return;
    if (!unit) return;
    if (!ageBand) return;
  }, [ageBand, ageBandOptions, classes.length, unit, unitOptions]);

  useEffect(() => {
    if (!classes.length) return;
    if (!unit || !ageBand) {
      setClassId("");
      return;
    }
    const matching = classes
      .filter(
        (item) => unitLabel(item.unit) === unit && item.ageBand === ageBand
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    if (matching.length) {
      setClassId(matching[0].id);
      return;
    }
    const byUnit = classes
      .filter((item) => unitLabel(item.unit) === unit)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (byUnit.length) {
      setClassId(byUnit[0].id);
      return;
    }
    setClassId(classes[0].id);
  }, [ageBand, classes, unit]);

  useEffect(() => {
    if (!birthDate) {
      setAgeNumber(null);
      return;
    }
    setAgeNumber(calculateAge(birthDate));
  }, [birthDate]);


  const onSave = async () => {
    const wasEditing = !!editingId;
    if (!unit || !ageBand || !classId) {
      setStudentFormError("Selecione a unidade e a faixa etaria.");
      return false;
    }
    if (!classId || !name.trim()) return false;
    setStudentFormError("");
    const resolvedAge =
      ageNumber ?? (birthDate ? calculateAge(birthDate) : null);
    if (resolvedAge === null || Number.isNaN(resolvedAge)) return false;
    const nowIso = new Date().toISOString();
    const student: Student = {
      id: editingId ?? "s_" + Date.now(),
      name: name.trim(),
      classId,
      age: resolvedAge,
      phone: phone.trim(),
      birthDate: birthDate || undefined,
      createdAt: editingCreatedAt ?? nowIso,
    };

    if (editingId) {
      await updateStudent(student);
    } else {
      await saveStudent(student);
    }

    resetForm();
    await reload();
    showSaveNotice(wasEditing ? "Alteracoes salvas." : "Aluno cadastrado.");
    return true;
  };

  const isFormDirty =
    unit.trim() ||
    ageBand.trim() ||
    customAgeBand.trim() ||
    name.trim() ||
    birthDate.trim() ||
    phone.trim() ||
    editingId;

  const canSaveStudent =
    !!unit &&
    !!ageBand &&
    !!classId &&
    !!name.trim() &&
    !!birthDate.trim() &&
    ageNumber !== null;

  const isEditDirty = useMemo(() => {
    if (!editingId || !editSnapshot) return false;
    return (
      editSnapshot.unit !== unit ||
      editSnapshot.ageBand !== ageBand ||
      editSnapshot.customAgeBand !== customAgeBand ||
      editSnapshot.classId !== classId ||
      editSnapshot.name !== name ||
      editSnapshot.birthDate !== birthDate ||
      editSnapshot.phone !== phone
    );
  }, [
    ageBand,
    birthDate,
    classId,
    customAgeBand,
    editSnapshot,
    editingId,
    name,
    phone,
    unit,
  ]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setEditingCreatedAt(null);
    setName("");
    setBirthDate("");
    setAgeNumber(null);
    setPhone("");
    setCustomAgeBand("");
    setUnit("");
    setAgeBand("");
    setClassId("");
    setStudentFormError("");
    setEditSnapshot(null);
  };

  const resetCreateForm = () => {
    setUnit("");
    setAgeBand("");
    setClassId("");
    setCustomAgeBand("");
    setStudentFormError("");
    setName("");
    setBirthDate("");
    setAgeNumber(null);
    setPhone("");
  };

  const showSaveNotice = (message: string) => {
    setSaveNotice(message);
    if (saveNoticeTimer.current) {
      clearTimeout(saveNoticeTimer.current);
    }
    saveNoticeAnim.setValue(0);
    Animated.timing(saveNoticeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    saveNoticeTimer.current = setTimeout(() => {
      Animated.timing(saveNoticeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setSaveNotice("");
        saveNoticeTimer.current = null;
      });
    }, 2200);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setShowEditCloseConfirm(false);
    resetForm();
  };

  const requestCloseEditModal = () => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  };

  const onEdit = (student: Student) => {
    const cls = classes.find((item) => item.id === student.classId);
    let nextUnit = "";
    let nextAgeBand = "";
    let nextCustomAgeBand = "";
    let nextClassId = "";
    if (cls) {
      nextUnit = unitLabel(cls.unit);
      nextAgeBand = cls.ageBand;
      if (!ageBandOptions.includes(cls.ageBand)) {
        nextCustomAgeBand = cls.ageBand;
      }
      nextClassId = cls.id;
    } else {
      nextUnit = "";
      nextAgeBand = "";
      nextCustomAgeBand = "";
      nextClassId = "";
    }
    setUnit(nextUnit);
    setAgeBand(nextAgeBand);
    setCustomAgeBand(nextCustomAgeBand);
    setClassId(nextClassId);
    setShowForm(false);
    setEditingId(student.id);
    setEditingCreatedAt(student.createdAt);
    setName(student.name);
    setEditSnapshot({
      unit: nextUnit,
      ageBand: nextAgeBand,
      customAgeBand: nextCustomAgeBand,
      classId: nextClassId,
      name: student.name,
      birthDate: student.birthDate ?? "",
      phone: student.phone,
    });
    if (student.birthDate) {
      setBirthDate(student.birthDate);
      setAgeNumber(calculateAge(student.birthDate));
    } else {
      setBirthDate("");
      setAgeNumber(student.age);
    }
    setPhone(student.phone);
    setShowEditModal(true);
    setStudentFormError("");
  };

  const onDelete = (id: string) => {
    const student = students.find((item) => item.id === id);
    if (!student) return;
    confirm({
      title: "Excluir aluno?",
      message: student.name
        ? `Tem certeza que deseja excluir ${student.name}?`
        : "Tem certeza que deseja excluir este aluno?",
      confirmLabel: "Excluir",
      undoMessage: "Aluno excluido. Deseja desfazer?",
      onOptimistic: () => {
        setStudents((prev) => prev.filter((item) => item.id !== student.id));
        if (editingId === student.id) {
          setEditingId(null);
          setEditingCreatedAt(null);
        }
      },
      onConfirm: async () => {
        await deleteStudent(student.id);
        await reload();
      },
      onUndo: async () => {
        await reload();
      },
    });
  };

  const getClassName = (id: string) =>
    classes.find((item) => item.id === id)?.name ?? "Selecione a turma";
  const selectedClassName = useMemo(
    () => classes.find((item) => item.id === classId)?.name ?? "",
    [classId, classes]
  );

  const formatShortDate = (value?: string) => {
    if (!value) return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  };

  const formatIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseIsoDate = (value?: string) => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const local = new Date(year, month - 1, day);
      return Number.isNaN(local.getTime()) ? null : local;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const calculateAge = (iso: string) => {
    const date = parseIsoDate(iso);
    if (!date) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < date.getDate())
    ) {
      age -= 1;
    }
    return age;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const formatAgeBand = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  };

  const formatName = (value: string) => {
    const particles = new Set([
      "da",
      "de",
      "do",
      "das",
      "dos",
      "e",
    ]);
    const hasTrailingSpace = /\s$/.test(value);
    const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const formatted = words
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (index > 0 && particles.has(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join(" ");
    return hasTrailingSpace ? formatted + " " : formatted;
  };

  const today = useMemo(() => new Date(), []);
  const birthdayStudents = useMemo(() => {
    return students.filter((student) => {
      if (!student.birthDate) return false;
      const date = parseIsoDate(student.birthDate);
      if (!date) return false;
      return (
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });
  }, [students, today]);

  const monthGroups = useMemo(() => {
    const byMonth = new Map();
    students.forEach((student) => {
      if (!student.birthDate) return;
      const date = parseIsoDate(student.birthDate);
      if (!date) return;
      const month = date.getMonth();
      const cls = classes.find((item) => item.id === student.classId);
      const unitName = unitLabel(cls?.unit);
      if (!byMonth.has(month)) byMonth.set(month, new Map());
      const monthMap = byMonth.get(month);
      if (!monthMap.has(unitName)) monthMap.set(unitName, []);
      monthMap.get(unitName).push({ student, date, unitName });
    });
    return Array.from(byMonth.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([month, unitMap]) => [
        month,
        Array.from(unitMap.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      ]);
  }, [classes, students]);

  useEffect(() => {
    if (!birthdayStudents.length) return;
    const todayKey = formatIsoDate(today);
    if (lastBirthdayNotice === todayKey) return;
    const names = birthdayStudents.map((student) => student.name);
    void notifyBirthdays(names);
    setLastBirthdayNotice(todayKey);
  }, [birthdayStudents, lastBirthdayNotice, setLastBirthdayNotice, today]);

  useEffect(() => {
    return () => {
      if (saveNoticeTimer.current) {
        clearTimeout(saveNoticeTimer.current);
      }
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Alunos
          </Text>
          <Text style={{ color: colors.muted }}>Lista de chamada por turma</Text>
        </View>

        <View
          style={[
            getSectionCardStyle(colors, "success", { padding: 16, radius: 20 }),
            { borderLeftWidth: 3, borderLeftColor: "#ffffff" },
          ]}
        >
            <Pressable
            onPress={() => {
              animateLayout();
              if (showForm && isFormDirty) {
                confirmDialog({
                  title: "Sair sem salvar?",
                  message: "Voce tem alteracoes nao salvas.",
                  confirmLabel: "Descartar",
                  cancelLabel: "Continuar",
                  onConfirm: () => {
                    resetForm();
                  },
                });
                return;
              }
              setShowForm((prev) => {
                const next = !prev;
                if (next && !editingId) {
                  resetCreateForm();
                }
                return next;
              });
            }}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: showForm ? colors.secondaryBg : colors.primaryBg,
              borderWidth: showForm ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  color: showForm ? colors.text : colors.primaryText,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                {showForm ? "Fechar cadastro" : "+ Cadastrar aluno"}
              </Text>
              <Text style={{ color: showForm ? colors.muted : colors.primaryText, fontSize: 12 }}>
                {showForm ? "Ocultar formulario" : "Adicionar um novo aluno"}
              </Text>
            </View>
          </Pressable>
          {showFormContent ? (
            <Animated.View style={formAnimStyle}>
              <Text style={{ color: colors.muted }}>Unidade</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {unitOptions.map((item) => {
                  const active = item === unit;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setUnit(active ? "" : item)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                      }}
                    >
                      <Text style={{ color: active ? colors.primaryText : colors.text }}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: colors.muted }}>Faixa etaria</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ageBandOptions.map((item) => {
                  const active = item === ageBand;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        if (active) {
                          setAgeBand("");
                          return;
                        }
                        setAgeBand(item);
                        setCustomAgeBand("");
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                      }}
                    >
                      <Text style={{ color: active ? colors.primaryText : colors.text }}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                placeholder="Outra faixa (ex: 19-21)"
                value={customAgeBand}
                onChangeText={(value) => {
                  const next = formatAgeBand(value);
                  setCustomAgeBand(next);
                  if (next.includes("-")) {
                    setAgeBand(next.trim());
                  }
                }}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              {selectedClassName ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Turma selecionada: {selectedClassName}
                </Text>
              ) : null}
              {studentFormError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                  {studentFormError}
                </Text>
              ) : null}

          <TextInput
            placeholder="Nome do aluno"
            value={name}
            onChangeText={setName}
            onBlur={() => setName(formatName(name))}
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
            }}
          />
          <DateInput
            value={birthDate}
            onChange={setBirthDate}
            placeholder="Data de nascimento"
            onOpenCalendar={() => setShowCalendar(true)}
          />
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {ageNumber !== null ? `Idade: ${ageNumber} anos` : "Idade calculada automaticamente"}
          </Text>
          <TextInput
            placeholder="Telefone"
            value={phone}
            onChangeText={(value) => setPhone(formatPhone(value))}
            keyboardType="phone-pad"
            placeholderTextColor={colors.placeholder}
            style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />

              <Button
                label={editingId ? "Salvar alteracoes" : "Adicionar aluno"}
                onPress={onSave}
                disabled={!canSaveStudent}
              />
              {editingId ? (
                <Button
                  label="Cancelar edicao"
                  variant="secondary"
                  onPress={() => {
                    if (isFormDirty) {
                      confirmDialog({
                        title: "Sair sem salvar?",
                        message: "Voce tem alteracoes nao salvas.",
                        confirmLabel: "Descartar",
                        cancelLabel: "Continuar",
                        onConfirm: () => {
                          resetForm();
                        },
                      });
                      return;
                    }
                    resetForm();
                  }}
                />
              ) : null}
            </Animated.View>
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          {monthGroups.length ? (
            <Pressable
              onPress={() => router.push({ pathname: "/students/birthdays" })}
              style={[
                getSectionCardStyle(colors, "info"),
                {
                  gap: 6,
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
                },
              ]}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                Aniversariantes
              </Text>
              <Text style={{ color: colors.muted }}>
                Ver aniversarios por mes e unidade
              </Text>
            </Pressable>
          ) : null}
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Lista de alunos
          </Text>
          {students.map((student) => (
            <Pressable
              key={student.id}
              onPress={() => onEdit(student)}
              style={[
                getSectionCardStyle(colors, "neutral"),
                {
                  gap: 6,
                  shadowOpacity: 0.04,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 2,
                },
              ]}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                {student.name + " - " + getClassName(student.classId)}
              </Text>
              <Text style={{ color: colors.muted }}>
                {"Idade: " + student.age + " | Telefone: " + student.phone}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      {saveNotice ? (
        <Animated.View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 24,
            paddingVertical: 12,
            paddingHorizontal: 14,
            borderRadius: 14,
            backgroundColor: colors.successBg,
            borderWidth: 1,
            borderColor: colors.successBg,
            shadowColor: "#000",
            shadowOpacity: 0.12,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 4,
            alignItems: "center",
            opacity: saveNoticeAnim,
            transform: [
              {
                translateY: saveNoticeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
        >
          <Text style={{ color: colors.successText, fontWeight: "700" }}>
            {saveNotice}
          </Text>
        </Animated.View>
      ) : null}
      <ModalSheet
        visible={showEditModal}
        onClose={requestCloseEditModal}
        cardStyle={[editModalCardStyle, { paddingBottom: 12 }]}
        position="center"
      >
        <ConfirmCloseOverlay
          visible={showEditCloseConfirm}
          onCancel={() => setShowEditCloseConfirm(false)}
          onConfirm={() => {
            setShowEditCloseConfirm(false);
            closeEditModal();
          }}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            Editar aluno
          </Text>
          <Pressable
            onPress={requestCloseEditModal}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
              Fechar
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
          style={{ maxHeight: "94%" }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
              <Text style={{ color: colors.muted }}>Unidade</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {unitOptions.map((item) => {
                  const active = item === unit;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => setUnit(active ? "" : item)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                      }}
                    >
                      <Text style={{ color: active ? colors.primaryText : colors.text }}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={{ color: colors.muted }}>Faixa etaria</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ageBandOptions.map((item) => {
                  const active = item === ageBand;
                  return (
                    <Pressable
                      key={item}
                      onPress={() => {
                        if (active) {
                          setAgeBand("");
                          return;
                        }
                        setAgeBand(item);
                        setCustomAgeBand("");
                      }}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                      }}
                    >
                      <Text style={{ color: active ? colors.primaryText : colors.text }}>
                        {item}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                placeholder="Outra faixa (ex: 19-21)"
                value={customAgeBand}
                onChangeText={(value) => {
                  const next = formatAgeBand(value);
                  setCustomAgeBand(next);
                  if (next.includes("-")) {
                    setAgeBand(next.trim());
                  }
                }}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              {selectedClassName ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  Turma selecionada: {selectedClassName}
                </Text>
              ) : null}
              {studentFormError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                  {studentFormError}
                </Text>
              ) : null}
              <TextInput
                placeholder="Nome do aluno"
                value={name}
                onChangeText={setName}
                onBlur={() => setName(formatName(name))}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              <DateInput
                value={birthDate}
                onChange={setBirthDate}
                placeholder="Data de nascimento"
                onOpenCalendar={() => setShowCalendar(true)}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {ageNumber !== null
                  ? `Idade: ${ageNumber} anos`
                  : "Idade calculada automaticamente"}
              </Text>
              <TextInput
                placeholder="Telefone"
                value={phone}
                onChangeText={(value) => setPhone(formatPhone(value))}
                keyboardType="phone-pad"
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={async () => {
                    const didSave = await onSave();
                    if (didSave) {
                      closeEditModal();
                    }
                  }}
                  disabled={!isEditDirty}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: isEditDirty
                      ? colors.primaryBg
                      : colors.primaryDisabledBg,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: isEditDirty ? colors.primaryText : colors.secondaryText,
                      fontWeight: "700",
                    }}
                  >
                    Salvar alteracoes
                  </Text>
                </Pressable>
                <Pressable
                  onPress={requestCloseEditModal}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Cancelar
                  </Text>
                </Pressable>
              </View>
        </ScrollView>
      </ModalSheet>
      <DatePickerModal
        visible={showCalendar}
        value={birthDate}
        onChange={setBirthDate}
        onClose={() => setShowCalendar(false)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}




