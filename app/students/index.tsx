import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState } from "react";
import {
  Animated,
  FlatList,
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
import { Ionicons } from "@expo/vector-icons";

import {
  getClasses,
  getStudents,
  saveStudent,
  updateStudent,
  deleteStudent,
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
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { logAction } from "../../src/observability/breadcrumbs";
import { measure } from "../../src/observability/perf";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";

export default function StudentsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm } = useConfirmUndo();
  const { confirm: confirmDialog } = useConfirmDialog();
  const selectFieldStyle = {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    gap: 8,
  };
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
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showEditUnitPicker, setShowEditUnitPicker] = useState(false);
  const [showEditClassPicker, setShowEditClassPicker] = useState(false);
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
    guardianName: string;
    guardianPhone: string;
  } | null>(null);
  const [lastBirthdayNotice, setLastBirthdayNotice] = usePersistedState<string>(
    "students_birthday_notice_v1",
    ""
  );
  const [containerWindow, setContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const [unitTriggerLayout, setUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [classTriggerLayout, setClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editContainerWindow, setEditContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const [editUnitTriggerLayout, setEditUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [editClassTriggerLayout, setEditClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const containerRef = useRef<View>(null);
  const unitTriggerRef = useRef<View>(null);
  const classTriggerRef = useRef<View>(null);
  const editContainerRef = useRef<View>(null);
  const editUnitTriggerRef = useRef<View>(null);
  const editClassTriggerRef = useRef<View>(null);
  const { animatedStyle: unitPickerAnimStyle, isVisible: showUnitPickerContent } =
    useCollapsibleAnimation(showUnitPicker);
  const { animatedStyle: classPickerAnimStyle, isVisible: showClassPickerContent } =
    useCollapsibleAnimation(showClassPicker);
  const { animatedStyle: editUnitPickerAnimStyle, isVisible: showEditUnitPickerContent } =
    useCollapsibleAnimation(showEditUnitPicker);
  const { animatedStyle: editClassPickerAnimStyle, isVisible: showEditClassPickerContent } =
    useCollapsibleAnimation(showEditClassPicker);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [classList, studentList] = await Promise.all([
        getClasses(),
        getStudents(),
      ]);
      if (!alive) return;
      setClasses(classList);
      setStudents(studentList);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const reload = async () => {
    const data = await getStudents();
    setStudents(data);
  };

  const unitLabel = useCallback(
    (value?: string) => (value && value.trim() ? value.trim() : "Sem unidade"),
    []
  );

  const closeAllPickers = useCallback(() => {
    setShowUnitPicker(false);
    setShowClassPicker(false);
  }, []);
  const closeAllEditPickers = useCallback(() => {
    setShowEditUnitPicker(false);
    setShowEditClassPicker(false);
  }, []);

  const toggleFormPicker = useCallback(
    (target: "unit" | "class") => {
      setShowUnitPicker((prev) => (target === "unit" ? !prev : false));
      setShowClassPicker((prev) => (target === "class" ? !prev : false));
    },
    []
  );
  const toggleEditPicker = useCallback(
    (target: "unit" | "class") => {
      setShowEditUnitPicker((prev) => (target === "unit" ? !prev : false));
      setShowEditClassPicker((prev) => (target === "class" ? !prev : false));
    },
    []
  );

  const handleSelectUnit = useCallback((value: string) => {
    setUnit(value);
    setShowUnitPicker(false);
  }, []);

  const handleSelectClass = useCallback((value: ClassGroup) => {
    setClassId(value.id);
    setUnit(unitLabel(value.unit));
    setAgeBand(value.ageBand);
    setCustomAgeBand("");
    setShowClassPicker(false);
  }, [unitLabel]);

  const handleSelectEditUnit = useCallback((value: string) => {
    setUnit(value);
    setShowEditUnitPicker(false);
  }, []);

  const handleSelectEditClass = useCallback((value: ClassGroup) => {
    setClassId(value.id);
    setUnit(unitLabel(value.unit));
    setAgeBand(value.ageBand);
    setCustomAgeBand("");
    setShowEditClassPicker(false);
  }, [unitLabel]);

  const syncPickerLayouts = useCallback(() => {
    const hasPickerOpen = showUnitPicker || showClassPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showUnitPicker) {
        unitTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showClassPicker) {
        classTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setClassTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current?.measureInWindow((x, y) => {
        setContainerWindow({ x, y });
      });
    });
  }, [showClassPicker, showUnitPicker]);

  const syncEditPickerLayouts = useCallback(() => {
    const hasPickerOpen = showEditUnitPicker || showEditClassPicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showEditUnitPicker) {
        editUnitTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditUnitTriggerLayout({ x, y, width, height });
        });
      }
      if (showEditClassPicker) {
        editClassTriggerRef.current?.measureInWindow((x, y, width, height) => {
          setEditClassTriggerLayout({ x, y, width, height });
        });
      }
      editContainerRef.current?.measureInWindow((x, y) => {
        setEditContainerWindow({ x, y });
      });
    });
  }, [showEditClassPicker, showEditUnitPicker]);

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
    syncPickerLayouts();
  }, [showUnitPicker, showClassPicker, syncPickerLayouts]);

  useEffect(() => {
    if (showEditModal) syncEditPickerLayouts();
  }, [showEditModal, showEditUnitPicker, showEditClassPicker, syncEditPickerLayouts]);

  useEffect(() => {
    if (!showForm) closeAllPickers();
  }, [closeAllPickers, showForm]);
  useEffect(() => {
    if (!showEditModal) closeAllEditPickers();
  }, [closeAllEditPickers, showEditModal]);

  useEffect(() => {
    if (!classes.length) return;
    if (!unit) {
      setClassId("");
      return;
    }
    const matching = classes
      .filter((item) => unitLabel(item.unit) === unit)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!matching.length) {
      setClassId("");
      return;
    }
    if (matching.some((item) => item.id === classId)) return;
    setClassId(matching[0].id);
  }, [classes, unit, unitLabel]);

  useEffect(() => {
    if (!birthDate) {
      setAgeNumber(null);
      return;
    }
    setAgeNumber(calculateAge(birthDate));
  }, [birthDate]);


  const onSave = async () => {
    const wasEditing = !!editingId;
    if (!unit || !classId) {
      setStudentFormError("Selecione a unidade e a turma.");
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
      guardianName: guardianName.trim(),
      guardianPhone: guardianPhone.trim(),
      birthDate: birthDate || undefined,
      createdAt: editingCreatedAt ?? nowIso,
    };

    if (editingId) {
      await measure("updateStudent", () => updateStudent(student));
    } else {
      await measure("saveStudent", () => saveStudent(student));
    }
    logAction(wasEditing ? "Editar aluno" : "Cadastrar aluno", {
      studentId: student.id,
      classId,
    });

    resetForm();
    await reload();
    showSaveNotice(wasEditing ? "Alteracoes salvas." : "Aluno cadastrado.");
    return true;
  };

  const isFormDirty =
    unit.trim() ||
    classId.trim() ||
    name.trim() ||
    birthDate.trim() ||
    phone.trim() ||
    guardianName.trim() ||
    guardianPhone.trim() ||
    editingId;

  const canSaveStudent =
    !!unit &&
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
      editSnapshot.phone !== phone ||
      editSnapshot.guardianName !== guardianName ||
      editSnapshot.guardianPhone !== guardianPhone
    );
  }, [
    ageBand,
    birthDate,
    classId,
    customAgeBand,
    editSnapshot,
    editingId,
    guardianName,
    guardianPhone,
    name,
    phone,
    unit,
  ]);

  const resetForm = () => {
    closeAllPickers();
    setShowForm(false);
    setEditingId(null);
    setEditingCreatedAt(null);
    setName("");
    setBirthDate("");
    setAgeNumber(null);
    setPhone("");
    setGuardianName("");
    setGuardianPhone("");
    setCustomAgeBand("");
    setUnit("");
    setAgeBand("");
    setClassId("");
    setStudentFormError("");
    setEditSnapshot(null);
  };

  const resetCreateForm = () => {
    closeAllPickers();
    setUnit("");
    setAgeBand("");
    setClassId("");
    setCustomAgeBand("");
    setStudentFormError("");
    setName("");
    setBirthDate("");
    setAgeNumber(null);
    setPhone("");
    setGuardianName("");
    setGuardianPhone("");
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
    closeAllEditPickers();
    resetForm();
  };

  const requestCloseEditModal = () => {
    if (isEditDirty) {
      setShowEditCloseConfirm(true);
      return;
    }
    closeEditModal();
  };

  const onEdit = useCallback((student: Student) => {
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
      guardianName: student.guardianName ?? "",
      guardianPhone: student.guardianPhone ?? "",
    });
    if (student.birthDate) {
      setBirthDate(student.birthDate);
      setAgeNumber(calculateAge(student.birthDate));
    } else {
      setBirthDate("");
      setAgeNumber(student.age);
    }
    setPhone(student.phone);
    setGuardianName(student.guardianName ?? "");
    setGuardianPhone(student.guardianPhone ?? "");
    closeAllPickers();
    setShowEditModal(true);
    setStudentFormError("");
  }, [ageBandOptions, classes, closeAllPickers, unitLabel]);

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
        await measure("deleteStudent", () => deleteStudent(student.id));
        await reload();
        logAction("Excluir aluno", {
          studentId: student.id,
          classId: student.classId,
        });
      },
      onUndo: async () => {
        await reload();
      },
    });
  };

  const deleteEditingStudent = useCallback(() => {
    if (!editingId) return;
    const student = students.find((item) => item.id === editingId);
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
        closeEditModal();
      },
      onConfirm: async () => {
        await measure("deleteStudent", () => deleteStudent(student.id));
        await reload();
        logAction("Excluir aluno", {
          studentId: student.id,
          classId: student.classId,
        });
      },
      onUndo: async () => {
        await reload();
      },
    });
  }, [confirm, editingId, closeEditModal, logAction, reload, students]);

  const getClassName = useCallback(
    (id: string) =>
      classes.find((item) => item.id === id)?.name ?? "Selecione a turma",
    [classes]
  );
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

  const parseTime = (value: string) => {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    return { hour, minute };
  };

  const formatTime = (hour: number, minute: number) => {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const formatTimeRange = (startTime: string, durationMinutes: number) => {
    const parsed = parseTime(startTime);
    if (!parsed) return "";
    const total = parsed.hour * 60 + parsed.minute + durationMinutes;
    const endHour = Math.floor(total / 60) % 24;
    const endMinute = total % 60;
    return `${formatTime(parsed.hour, parsed.minute)} - ${formatTime(
      endHour,
      endMinute
    )}`;
  };

  const classOptions = useMemo(() => {
    if (!classes.length) return [];
    const byTimeThenName = (a: ClassGroup, b: ClassGroup) => {
      const timeOrder = (a.startTime || "").localeCompare(b.startTime || "");
      if (timeOrder !== 0) return timeOrder;
      return a.name.localeCompare(b.name);
    };
    if (unit) {
      return classes
        .filter((item) => unitLabel(item.unit) === unit)
        .sort(byTimeThenName);
    }
    return classes.slice().sort(byTimeThenName);
  }, [classes, unit, unitLabel]);

  const getClassLabel = (cls: ClassGroup) => {
    const start = cls.startTime || "";
    const duration = cls.durationMinutes || 60;
    const timeRange = start ? formatTimeRange(start, duration) : "";
    if (timeRange) return `${timeRange} - ${cls.name}`;
    return cls.name;
  };

  const renderClassPicker = () => {
    if (!unit) return null;
    if (!classOptions.length) {
      return (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted }}>Turma</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Nenhuma turma disponivel para essa unidade.
          </Text>
        </View>
      );
    }
    return (
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.muted }}>Turma</Text>
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
        >
          {classOptions.map((item, index) => {
            const active = item.id === classId;
            return (
              <Pressable
                key={item.id}
                onPress={() => setClassId(active ? "" : item.id)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  margin: index === 0 ? 6 : 2,
                  backgroundColor: active ? colors.primaryBg : "transparent",
                }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <Text
                    style={{
                      color: active ? colors.primaryText : colors.text,
                      fontSize: 12,
                      fontWeight: active ? "700" : "500",
                    }}
                  >
                    {getClassLabel(item)}
                  </Text>
                  <ClassGenderBadge gender={item.gender} />
                </View>
                <Text
                  style={{
                    color: active ? colors.primaryText : colors.muted,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                >
                  {unitLabel(item.unit)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedClassName ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Turma selecionada: {selectedClassName}
          </Text>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Selecione uma turma.
          </Text>
        )}
      </View>
    );
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

  const StudentRow = useMemo(
    () =>
      memo(function StudentRowItem({
        item,
        onPress,
        className,
      }: {
        item: Student;
        onPress: (student: Student) => void;
        className: string;
      }) {
        return (
          <Pressable
            onPress={() => onPress(item)}
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
              {item.name + " - " + className}
            </Text>
            <Text style={{ color: colors.muted }}>
              {"Idade: " + item.age + " | Telefone: " + item.phone}
            </Text>
          </Pressable>
        );
      }),
    [colors]
  );

  const SelectOption = useMemo(
    () =>
      memo(function SelectOptionItem({
        label,
        value,
        active,
        onSelect,
        isFirst,
      }: {
        label: string;
        value: string;
        active: boolean;
        onSelect: (value: string) => void;
        isFirst?: boolean;
      }) {
        return (
          <Pressable
            onPress={() => onSelect(value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              margin: isFirst ? 6 : 2,
              backgroundColor: active ? colors.primaryBg : "transparent",
            }}
          >
            <Text
              style={{
                color: active ? colors.primaryText : colors.text,
                fontSize: 12,
                fontWeight: active ? "700" : "500",
              }}
            >
              {label}
            </Text>
          </Pressable>
        );
      }),
    [colors]
  );

  const ClassOption = useMemo(
    () =>
      memo(function ClassOptionItem({
        item,
        active,
        onSelect,
        isFirst,
      }: {
        item: ClassGroup;
        active: boolean;
        onSelect: (value: ClassGroup) => void;
        isFirst?: boolean;
      }) {
        return (
          <Pressable
            onPress={() => onSelect(item)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              margin: isFirst ? 6 : 2,
              backgroundColor: active ? colors.primaryBg : "transparent",
            }}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Text
                style={{
                  color: active ? colors.primaryText : colors.text,
                  fontSize: 12,
                  fontWeight: active ? "700" : "500",
                }}
              >
                {getClassLabel(item)}
              </Text>
              <ClassGenderBadge gender={item.gender} />
            </View>
            <Text
              style={{
                color: active ? colors.primaryText : colors.muted,
                fontSize: 11,
                marginTop: 2,
              }}
            >
              {unitLabel(item.unit)}
            </Text>
          </Pressable>
        );
      }),
    [colors, getClassLabel, unitLabel]
  );

  const renderStudentItem = useCallback(
    ({ item }: { item: Student }) => (
      <StudentRow
        item={item}
        onPress={onEdit}
        className={getClassName(item.classId)}
      />
    ),
    [StudentRow, getClassName, onEdit]
  );

  const studentKeyExtractor = useCallback(
    (item: Student) => String(item.id),
    []
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View ref={containerRef} style={{ flex: 1, position: "relative", overflow: "visible" }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        onScroll={syncPickerLayouts}
        scrollEventThrottle={16}
      >
        <ScreenHeader title="Alunos" subtitle="Lista de chamada por turma" />

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
            <Animated.View style={[formAnimStyle, { gap: 12, marginTop: 12 }]}>
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
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Unidade</Text>
                  <View ref={unitTriggerRef}>
                    <Pressable
                      onPress={() => toggleFormPicker("unit")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {unit || "Selecione a unidade"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{ transform: [{ rotate: showUnitPicker ? "180deg" : "0deg" }] }}
                      />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Turma</Text>
                  <View ref={classTriggerRef}>
                    <Pressable
                      onPress={() => toggleFormPicker("class")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {selectedClassName || "Selecione a turma"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{ transform: [{ rotate: showClassPicker ? "180deg" : "0deg" }] }}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
              {studentFormError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                  {studentFormError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
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
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
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
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <TextInput
                    placeholder="Nome do responsavel"
                    value={guardianName}
                    onChangeText={setGuardianName}
                    onBlur={() => setGuardianName(formatName(guardianName))}
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
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <TextInput
                    placeholder="Telefone do responsavel"
                    value={guardianPhone}
                    onChangeText={(value) => setGuardianPhone(formatPhone(value))}
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
                </View>
              </View>

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
          <FlatList
            data={students}
            keyExtractor={studentKeyExtractor}
            renderItem={renderStudentItem}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            initialNumToRender={12}
            windowSize={7}
            maxToRenderPerBatch={12}
            removeClippedSubviews
          />
        </View>
      </ScrollView>

        <AnchoredDropdown
          visible={showUnitPickerContent}
          layout={unitTriggerLayout}
          container={containerWindow}
          animationStyle={unitPickerAnimStyle}
          zIndex={320}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {unitOptions.length ? (
            unitOptions.map((item, index) => (
              <SelectOption
                key={item}
                label={item}
                value={item}
                active={item === unit}
                onSelect={handleSelectUnit}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma unidade cadastrada.
            </Text>
          )}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showClassPickerContent}
          layout={classTriggerLayout}
          container={containerWindow}
          animationStyle={classPickerAnimStyle}
          zIndex={320}
          maxHeight={240}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {classOptions.length ? (
            classOptions.map((item, index) => (
              <ClassOption
                key={item.id}
                item={item}
                active={item.id === classId}
                onSelect={handleSelectClass}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma turma encontrada.
            </Text>
          )}
        </AnchoredDropdown>
      </View>
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
        cardStyle={[editModalCardStyle, { paddingBottom: 20 }]}
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
        <View ref={editContainerRef} style={{ position: "relative" }}>
        <ScrollView
          contentContainerStyle={{ gap: 10, paddingBottom: 32 }}
          style={{ maxHeight: "94%" }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
          onScroll={syncEditPickerLayouts}
          scrollEventThrottle={16}
        >
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
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Unidade</Text>
                  <View ref={editUnitTriggerRef}>
                    <Pressable
                      onPress={() => toggleEditPicker("unit")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {unit || "Selecione a unidade"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{ transform: [{ rotate: showEditUnitPicker ? "180deg" : "0deg" }] }}
                      />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <Text style={{ color: colors.muted }}>Turma</Text>
                  <View ref={editClassTriggerRef}>
                    <Pressable
                      onPress={() => toggleEditPicker("class")}
                      style={selectFieldStyle}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                        {selectedClassName || "Selecione a turma"}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={16}
                        color={colors.muted}
                        style={{ transform: [{ rotate: showEditClassPicker ? "180deg" : "0deg" }] }}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
              {studentFormError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                  {studentFormError}
                </Text>
              ) : null}
              {studentFormError ? (
                <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                  {studentFormError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
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
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
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
                </View>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <TextInput
                    placeholder="Nome do responsavel"
                    value={guardianName}
                    onChangeText={setGuardianName}
                    onBlur={() => setGuardianName(formatName(guardianName))}
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
                </View>
                <View style={{ flex: 1, minWidth: 160, gap: 6 }}>
                  <TextInput
                    placeholder="Telefone do responsavel"
                    value={guardianPhone}
                    onChangeText={(value) => setGuardianPhone(formatPhone(value))}
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
                </View>
              </View>
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
              {editingId ? (
                <Pressable
                  onPress={deleteEditingStudent}
                  style={{
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.dangerSolidBg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>
                    Excluir aluno
                  </Text>
                </Pressable>
              ) : null}
        </ScrollView>
        <AnchoredDropdown
          visible={showEditUnitPickerContent}
          layout={editUnitTriggerLayout}
          container={editContainerWindow}
          animationStyle={editUnitPickerAnimStyle}
          zIndex={420}
          maxHeight={220}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {unitOptions.length ? (
            unitOptions.map((item, index) => (
              <SelectOption
                key={item}
                label={item}
                value={item}
                active={item === unit}
                onSelect={handleSelectEditUnit}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma unidade cadastrada.
            </Text>
          )}
        </AnchoredDropdown>

        <AnchoredDropdown
          visible={showEditClassPickerContent}
          layout={editClassTriggerLayout}
          container={editContainerWindow}
          animationStyle={editClassPickerAnimStyle}
          zIndex={420}
          maxHeight={240}
          nestedScrollEnabled
          panelStyle={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.inputBg,
          }}
          scrollContentStyle={{ padding: 4 }}
        >
          {classOptions.length ? (
            classOptions.map((item, index) => (
              <ClassOption
                key={item.id}
                item={item}
                active={item.id === classId}
                onSelect={handleSelectEditClass}
                isFirst={index === 0}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma turma encontrada.
            </Text>
          )}
        </AnchoredDropdown>
        </View>
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




