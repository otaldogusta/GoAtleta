import * as Haptics from "expo-haptics";
import * as IntentLauncher from "expo-intent-launcher";
import { LinearGradient } from "expo-linear-gradient";
import * as Network from "expo-network";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../src/auth/auth";
import { useSmartSync } from "../src/core/use-smart-sync";
import type { ClassGroup, Student } from "../src/core/models";
import {
  createCheckinWithFallback,
  type CheckinDeliveryStatus,
} from "../src/data/attendance-checkins";
import {
  type NfcTagBinding,
  createBinding,
  deleteBinding,
  getBinding,
  listBindings,
} from "../src/data/nfc-tag-bindings";
import { getClasses, getStudents } from "../src/db/seed";
import { NFC_ERRORS } from "../src/nfc/nfc-errors";
import {
  getNfcMetrics,
  incrementNfcMetric,
  type NfcMetricKey,
  type NfcMetrics,
} from "../src/nfc/metrics";
import { isNfcSupported } from "../src/nfc/nfc";
import { useNfcContinuousScan } from "../src/nfc/nfc-hooks";
import { logNfcError, logNfcEvent } from "../src/nfc/telemetry";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { useConfirmDialog } from "../src/ui/confirm-dialog";
import { getFriendlyErrorMessage } from "../src/ui/error-messages";
import { useSaveToast } from "../src/ui/save-toast";

type LiveCheckin = {
  id: string;
  studentName: string;
  className: string;
  checkedInAt: string;
  tagUid: string;
  syncStatus: CheckinDeliveryStatus | "error";
};

const emptyMetrics = (): NfcMetrics => ({
  totalScans: 0,
  duplicateScans: 0,
  checkinsSynced: 0,
  checkinsPending: 0,
  syncRuns: 0,
  syncFlushed: 0,
  syncErrors: 0,
  bindCreated: 0,
  bindDenied: 0,
  readErrors: 0,
  updatedAt: new Date().toISOString(),
});

const DUPLICATE_WINDOW_MS = 20_000;
const AUTO_SYNC_DEBOUNCE_MS = 1_500;
const SEARCH_SIGNAL_PATTERN = [0, 70, 120, 70];
const SEARCH_SIGNAL_INTERVAL_MS = 2_400;

const formatTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const getSyncLabel = (status: LiveCheckin["syncStatus"]) => {
  if (status === "synced") return "Sincronizado";
  if (status === "pending") return "Pendente";
  return "Erro";
};

export default function NfcAttendanceScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { activeOrganization } = useOrganization();
  const { session } = useAuth();
  const { showSaveToast } = useSaveToast();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { syncNow } = useSmartSync();

  const [supportMessage, setSupportMessage] = useState("");
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [liveCheckins, setLiveCheckins] = useState<LiveCheckin[]>([]);
  const [pendingUid, setPendingUid] = useState("");
  const [showBindModal, setShowBindModal] = useState(false);
  const [bindingStudentId, setBindingStudentId] = useState("");
  const [savingBinding, setSavingBinding] = useState(false);
  const [bindSearch, setBindSearch] = useState("");
  const [adminRequiredUid, setAdminRequiredUid] = useState("");
  const [metrics, setMetrics] = useState<NfcMetrics>(emptyMetrics());
  const [bindings, setBindings] = useState<NfcTagBinding[]>([]);
  const [removingBindingId, setRemovingBindingId] = useState("");

  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const recentScanByUidRef = useRef<Map<string, number>>(new Map());
  const shouldResumeAfterBindRef = useRef(false);
  const scanStateRef = useRef<"idle" | "scanning" | "paused">("idle");
  const syncBusyRef = useRef(false);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSignalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const studentsById = useMemo(
    () => new Map(students.map((item) => [item.id, item] as const)),
    [students]
  );
  const classesById = useMemo(
    () => new Map(classes.map((item) => [item.id, item] as const)),
    [classes]
  );
  const bindCandidates = useMemo(
    () =>
      students.filter((student) =>
        selectedClassId ? student.classId === selectedClassId : true
      ),
    [selectedClassId, students]
  );
  const bindingsByStudentId = useMemo(() => {
    const map = new Map<string, NfcTagBinding>();
    for (const item of bindings) {
      if (!map.has(item.studentId)) {
        map.set(item.studentId, item);
      }
    }
    return map;
  }, [bindings]);
  const classBindings = useMemo(
    () =>
      bindings.filter((binding) => {
        const student = studentsById.get(binding.studentId);
        if (!student) return false;
        return selectedClassId ? student.classId === selectedClassId : true;
      }),
    [bindings, selectedClassId, studentsById]
  );

  const filteredBindCandidates = useMemo(() => {
    const query = bindSearch.trim().toLowerCase();
    if (!query) return bindCandidates;
    return bindCandidates.filter((student) =>
      student.name.toLowerCase().includes(query)
    );
  }, [bindCandidates, bindSearch]);

  const loadBindings = useCallback(async (organizationId: string) => {
    if (!organizationId) {
      setBindings([]);
      return;
    }
    const rows = await listBindings(organizationId);
    setBindings(rows);
  }, []);

  const recordMetric = useCallback(
    async (key: NfcMetricKey, delta = 1) => {
      const orgId = activeOrganization?.id ?? "";
      if (!orgId) return;
      setMetrics((prev) => ({
        ...prev,
        [key]: Math.max(0, Number(prev[key]) + delta),
        updatedAt: new Date().toISOString(),
      }));
      try {
        await incrementNfcMetric(orgId, key, delta);
      } catch {
        // ignore metrics write failures
      }
    },
    [activeOrganization?.id]
  );

  const markTagRead = useCallback((orgId: string, tagUid: string, checkedInAt?: string) => {
    const key = `${orgId}:${tagUid}`;
    const parsed = Date.parse(checkedInAt ?? "");
    const base = Number.isFinite(parsed) ? parsed : Date.now();
    recentScanByUidRef.current.set(key, base);
  }, []);

  const isDuplicateRead = useCallback((orgId: string, tagUid: string) => {
    const key = `${orgId}:${tagUid}`;
    const last = recentScanByUidRef.current.get(key);
    if (!last) return false;
    return Date.now() - last < DUPLICATE_WINDOW_MS;
  }, []);

  const registerCheckin = useCallback(
    async (params: { studentId: string; tagUid: string }) => {
      const orgId = activeOrganization?.id ?? "";
      if (!orgId) {
        setFeedback("Selecione uma organizacao ativa.");
        return;
      }

      if (isDuplicateRead(orgId, params.tagUid)) {
        logNfcEvent("scan_duplicate_blocked", {
          organizationId: orgId,
          tagUid: params.tagUid,
        });
        void recordMetric("duplicateScans");
        setFeedback("Tag ja registrada ha instantes.");
        showSaveToast({
          variant: "warning",
          message: "Ja registrado ha menos de 20 segundos.",
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      const student = studentsById.get(params.studentId);
      if (!student) {
        logNfcEvent("scan_binding_missing_student", {
          organizationId: orgId,
          studentId: params.studentId,
          tagUid: params.tagUid,
        });
        setFeedback("Aluno nao encontrado para esta tag.");
        showSaveToast({ variant: "error", message: "Aluno da tag nao encontrado." });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const resolvedClassId = selectedClassId || student.classId || null;
      const result = await createCheckinWithFallback({
        organizationId: orgId,
        classId: resolvedClassId,
        studentId: params.studentId,
        tagUid: params.tagUid,
      });
      const checkin = result.checkin;
      const className = classesById.get(resolvedClassId ?? "")?.name ?? "Sem turma";
      setLiveCheckins((prev) => [
        {
          id: checkin.id,
          studentName: student.name,
          className,
          checkedInAt: checkin.checkedInAt,
          tagUid: params.tagUid,
          syncStatus: result.status,
        },
        ...prev,
      ]);
      markTagRead(orgId, params.tagUid, checkin.checkedInAt);

      if (result.status === "pending") {
        logNfcEvent("checkin_pending_offline", {
          organizationId: orgId,
          classId: resolvedClassId,
          studentId: params.studentId,
          tagUid: params.tagUid,
        });
        void recordMetric("checkinsPending");
        setFeedback(`Presenca salva offline: ${student.name}`);
        showSaveToast({
          variant: "warning",
          message: `Sem internet. Presenca pendente para ${student.name}.`,
        });
      } else {
        logNfcEvent("checkin_synced", {
          organizationId: orgId,
          classId: resolvedClassId,
          studentId: params.studentId,
          tagUid: params.tagUid,
        });
        void recordMetric("checkinsSynced");
        setFeedback(`Presenca registrada: ${student.name}`);
        showSaveToast({
          variant: "success",
          message: `Presenca registrada: ${student.name}`,
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [
      activeOrganization?.id,
      classesById,
      isDuplicateRead,
      markTagRead,
      recordMetric,
      selectedClassId,
      showSaveToast,
      studentsById,
    ]
  );

  const handleScanError = useCallback(
    (error: unknown) => {
      const code = (error as { code?: string } | null)?.code;
      if (code === NFC_ERRORS.CANCELLED) return;
      void recordMetric("readErrors");
      logNfcError(error, {
        organizationId: activeOrganization?.id ?? "",
        screen: "nfc-attendance",
      });
      const friendly = getFriendlyErrorMessage(error, "Falha ao ler tag NFC.");
      setFeedback(friendly);
      showSaveToast({ variant: "error", message: friendly });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
    [activeOrganization?.id, recordMetric, showSaveToast]
  );

  const handleTagDetected = useCallback(
    async (result: { uid: string }) => {
      const uid = result.uid;
      const orgId = activeOrganization?.id ?? "";
      if (!orgId) {
        setFeedback("Selecione uma organizacao ativa.");
        return;
      }
      void recordMetric("totalScans");
      logNfcEvent("tag_detected", { organizationId: orgId, tagUid: uid });
      setAdminRequiredUid("");

      const binding = await getBinding(orgId, uid);
      if (binding) {
        await registerCheckin({ studentId: binding.studentId, tagUid: uid });
        return;
      }

      if (!isAdmin) {
        void recordMetric("bindDenied");
        setAdminRequiredUid(uid);
        setFeedback("Somente admin pode vincular tags NFC.");
        showSaveToast({
          variant: "warning",
          message: "Tag sem vinculo. Solicite um admin para vincular.",
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      shouldResumeAfterBindRef.current = scanStateRef.current === "scanning";
      setPendingUid(uid);
      setBindingStudentId("");
      setBindSearch("");
      setShowBindModal(true);
      setFeedback(`Tag ${uid} sem vinculo. Selecione um aluno para vincular.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    [activeOrganization?.id, isAdmin, recordMetric, registerCheckin, showSaveToast]
  );

  const {
    state: scanState,
    isScanning,
    start: startScan,
    pause: pauseScan,
    resume: resumeScan,
    stop: stopScan,
  } = useNfcContinuousScan({
    onTag: handleTagDetected,
    onError: handleScanError,
    loopDelayMs: 120,
  });

  useEffect(() => {
    scanStateRef.current = scanState;
  }, [scanState]);

  const handleSyncNow = useCallback(
    async (origin: "manual" | "auto" | "mount" = "manual") => {
      if (syncBusyRef.current) return;
      syncBusyRef.current = true;
      void recordMetric("syncRuns");
      try {
        const result = await syncNow();
        if (result.flushed > 0) {
          void recordMetric("syncFlushed", result.flushed);
          setLiveCheckins((prev) =>
            prev.map((item) =>
              item.syncStatus === "pending" ? { ...item, syncStatus: "synced" } : item
            )
          );
          if (origin !== "auto") {
            showSaveToast({
              variant: "success",
              message: `Sincronizados ${result.flushed} check-ins pendentes.`,
            });
          }
        } else if (origin === "manual") {
          showSaveToast({ variant: "info", message: "Nao ha pendencias para sincronizar." });
        }
      } catch (error) {
        void recordMetric("syncErrors");
        logNfcError(error, {
          organizationId: activeOrganization?.id ?? "",
          origin,
          screen: "nfc-attendance",
        });
        if (origin === "manual") {
          const friendly = getFriendlyErrorMessage(error, "Falha ao sincronizar pendencias.");
          showSaveToast({ variant: "error", message: friendly });
        }
      } finally {
        syncBusyRef.current = false;
      }
    },
    [activeOrganization?.id, recordMetric, showSaveToast, syncNow]
  );

  const refreshNfcSupport = useCallback(async () => {
    if (Platform.OS === "web") {
      const reason = "NFC nao e suportado no web.";
      setSupportMessage(reason);
      return { ok: false as const, reason };
    }
    const support = await isNfcSupported();
    if (!support.available || !support.enabled) {
      const reason = support.reason ?? "NFC indisponivel neste aparelho.";
      setSupportMessage(reason);
      return { ok: false as const, reason };
    }
    setSupportMessage("");
    return { ok: true as const };
  }, []);

  const openNfcSettings = useCallback(async () => {
    if (Platform.OS !== "android") {
      setFeedback("Ative o NFC nas configuracoes do aparelho.");
      return;
    }
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.NFC_SETTINGS);
    } catch (error) {
      const friendly = getFriendlyErrorMessage(error, "Nao foi possivel abrir configuracoes NFC.");
      setFeedback(friendly);
      showSaveToast({ variant: "error", message: friendly });
    } finally {
      const support = await refreshNfcSupport();
      if (!support.ok) {
        setFeedback(support.reason);
      } else {
        setFeedback("NFC ativo. Pode iniciar a leitura.");
      }
    }
  }, [refreshNfcSupport, showSaveToast]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const support = await refreshNfcSupport();
      if (!alive) return;
      if (!support.ok) setFeedback(support.reason);
    })();
    return () => {
      alive = false;
    };
  }, [refreshNfcSupport]);

  useEffect(() => {
    let alive = true;
    const orgId = activeOrganization?.id ?? "";
    if (!orgId) {
      setClasses([]);
      setStudents([]);
      setBindings([]);
      return;
    }
    (async () => {
      try {
        const [classRows, studentRows, bindingRows] = await Promise.all([
          getClasses({ organizationId: orgId }),
          getStudents({ organizationId: orgId }),
          listBindings(orgId),
        ]);
        if (!alive) return;
        setClasses(classRows);
        setStudents(studentRows);
        setBindings(bindingRows);
        if (!selectedClassId && classRows.length) {
          setSelectedClassId(classRows[0].id);
        }
      } catch (error) {
        if (!alive) return;
        const friendly = getFriendlyErrorMessage(error, "Falha ao carregar dados NFC.");
        setFeedback(friendly);
        showSaveToast({ variant: "error", message: friendly });
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, selectedClassId, showSaveToast]);

  useEffect(() => {
    if (!showBindModal) return;
    if (scanState !== "scanning") return;
    void pauseScan();
  }, [pauseScan, scanState, showBindModal]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    if (scanState !== "scanning" || showBindModal || supportMessage) {
      if (searchSignalTimerRef.current) {
        clearInterval(searchSignalTimerRef.current);
        searchSignalTimerRef.current = null;
      }
      Vibration.cancel();
      return;
    }

    Vibration.vibrate(SEARCH_SIGNAL_PATTERN, false);
    searchSignalTimerRef.current = setInterval(() => {
      Vibration.vibrate(SEARCH_SIGNAL_PATTERN, false);
    }, SEARCH_SIGNAL_INTERVAL_MS);

    return () => {
      if (searchSignalTimerRef.current) {
        clearInterval(searchSignalTimerRef.current);
        searchSignalTimerRef.current = null;
      }
      Vibration.cancel();
    };
  }, [scanState, showBindModal, supportMessage]);

  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      if (searchSignalTimerRef.current) {
        clearInterval(searchSignalTimerRef.current);
        searchSignalTimerRef.current = null;
      }
      Vibration.cancel();
    };
  }, []);

  useEffect(() => {
    if (!activeOrganization?.id) return;
    void handleSyncNow("mount");
  }, [activeOrganization?.id, handleSyncNow]);

  useEffect(() => {
    let alive = true;
    const orgId = activeOrganization?.id ?? "";
    if (!orgId) {
      setMetrics(emptyMetrics());
      return;
    }
    (async () => {
      const stored = await getNfcMetrics(orgId);
      if (!alive) return;
      setMetrics(stored);
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const subscription = Network.addNetworkStateListener((state) => {
      if (!state.isConnected || state.isInternetReachable === false) return;
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      syncDebounceRef.current = setTimeout(() => {
        void handleSyncNow("auto");
      }, AUTO_SYNC_DEBOUNCE_MS);
    });
    return () => {
      subscription.remove();
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, [handleSyncNow]);

  const selectedStudentCurrentBinding = useMemo(() => {
    if (!bindingStudentId) return null;
    return bindingsByStudentId.get(bindingStudentId) ?? null;
  }, [bindingStudentId, bindingsByStudentId]);

  const removeBindingForStudent = useCallback(
    async (
      binding: NfcTagBinding,
      options?: {
        silent?: boolean;
      }
    ) => {
      if (!activeOrganization?.id) return false;
      setRemovingBindingId(binding.id);
      try {
        await deleteBinding({
          organizationId: activeOrganization.id,
          bindingId: binding.id,
        });
        await loadBindings(activeOrganization.id);
        logNfcEvent("binding_removed", {
          organizationId: activeOrganization.id,
          bindingId: binding.id,
          studentId: binding.studentId,
          tagUid: binding.tagUid,
        });
        if (!options?.silent) {
          const studentName = studentsById.get(binding.studentId)?.name ?? "Aluno";
          setFeedback(`Tag removida para ${studentName}.`);
          showSaveToast({ variant: "success", message: "Tag removida com sucesso." });
        }
        return true;
      } catch (error) {
        logNfcError(error, {
          organizationId: activeOrganization.id,
          bindingId: binding.id,
          studentId: binding.studentId,
          tagUid: binding.tagUid,
          screen: "nfc-attendance",
        });
        if (!options?.silent) {
          const friendly = getFriendlyErrorMessage(error, "Falha ao remover tag.");
          setFeedback(friendly);
          showSaveToast({ variant: "error", message: friendly });
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        return false;
      } finally {
        setRemovingBindingId("");
      }
    },
    [activeOrganization?.id, loadBindings, showSaveToast, studentsById]
  );

  const confirmRemoveBinding = useCallback(
    (binding: NfcTagBinding) => {
      if (!isAdmin) {
        setFeedback("Somente admin pode remover tags NFC.");
        return;
      }
      const studentName = studentsById.get(binding.studentId)?.name ?? "aluno";
      confirmDialog({
        title: "Remover tag",
        message: `Deseja remover a tag ${binding.tagUid} de ${studentName}?`,
        confirmLabel: "Remover",
        cancelLabel: "Cancelar",
        tone: "danger",
        onConfirm: async () => {
          await removeBindingForStudent(binding);
        },
      });
    },
    [confirmDialog, isAdmin, removeBindingForStudent, studentsById]
  );

  const closeBindModal = useCallback(() => {
    setShowBindModal(false);
    setPendingUid("");
    setBindingStudentId("");
    setBindSearch("");
    if (shouldResumeAfterBindRef.current) {
      shouldResumeAfterBindRef.current = false;
      resumeScan();
    }
  }, [resumeScan]);

  const confirmBind = useCallback(async () => {
    if (!pendingUid || !bindingStudentId) return;
    if (!activeOrganization?.id) return;
    if (!session?.user?.id) {
      const message = "Sessao invalida. Faca login novamente para vincular tags.";
      setFeedback(message);
      showSaveToast({ variant: "error", message });
      return;
    }
    setSavingBinding(true);
    try {
      const existingBinding = bindingsByStudentId.get(bindingStudentId);
      if (existingBinding && existingBinding.tagUid !== pendingUid) {
        const removed = await removeBindingForStudent(existingBinding, { silent: true });
        if (!removed) return;
      }
      const binding = await createBinding({
        organizationId: activeOrganization.id,
        tagUid: pendingUid,
        studentId: bindingStudentId,
        createdBy: session.user.id,
      });
      await loadBindings(activeOrganization.id);
      void recordMetric("bindCreated");
      logNfcEvent("binding_created", {
        organizationId: activeOrganization.id,
        tagUid: pendingUid,
        studentId: bindingStudentId,
      });
      showSaveToast({ variant: "success", message: "Tag vinculada com sucesso." });
      closeBindModal();
      await registerCheckin({ studentId: binding.studentId, tagUid: binding.tagUid });
    } catch (error) {
      logNfcError(error, {
        organizationId: activeOrganization.id,
        tagUid: pendingUid,
        studentId: bindingStudentId,
        screen: "nfc-attendance",
      });
      const friendly = getFriendlyErrorMessage(error, "Falha ao vincular tag.");
      setFeedback(friendly);
      showSaveToast({ variant: "error", message: friendly });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavingBinding(false);
    }
  }, [
    activeOrganization?.id,
    bindingStudentId,
    bindingsByStudentId,
    closeBindModal,
    loadBindings,
    pendingUid,
    recordMetric,
    removeBindingForStudent,
    registerCheckin,
    session?.user?.id,
    showSaveToast,
  ]);

  const toggleScanning = useCallback(async () => {
    if (scanState === "idle") {
      const support = await refreshNfcSupport();
      if (!support.ok) {
        setFeedback(support.reason);
        return;
      }
      startScan();
      setFeedback("Leitura continua iniciada.");
      return;
    }
    if (scanState === "scanning") {
      void pauseScan();
      setFeedback("Leitura pausada.");
      return;
    }
    const support = await refreshNfcSupport();
    if (!support.ok) {
      setFeedback(support.reason);
      return;
    }
    resumeScan();
    setFeedback("Leitura retomada.");
  }, [pauseScan, refreshNfcSupport, resumeScan, scanState, startScan]);

  const stopScanning = useCallback(async () => {
    await stopScan();
    shouldResumeAfterBindRef.current = false;
    setShowBindModal(false);
    setFeedback("Leitura parada.");
  }, [stopScan]);

  const scanStateLabel =
    scanState === "idle" ? "Pronto" : scanState === "scanning" ? "Lendo" : "Pausado";
  const scanStateTone =
    scanState === "scanning"
      ? colors.successText
      : scanState === "paused"
      ? colors.warningText
      : colors.muted;
  const scanGuideText = supportMessage
    ? "Ative o NFC no aparelho para iniciar."
    : scanState === "scanning"
    ? "Aproxime a tag da traseira do celular."
    : "Toque em Iniciar leitura para entrar no modo continuo.";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 30, fontWeight: "900" }}>Presenca NFC</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {activeOrganization?.name ?? "Organizacao nao selecionada"}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void stopScanning().finally(() => router.back());
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>

        <View
          style={{
            borderRadius: 22,
            padding: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 12,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: scanStateTone, fontWeight: "800", fontSize: 12 }}>
                Estado: {scanStateLabel}
              </Text>
            </View>
            {isScanning ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={colors.primaryBg} />
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Lendo</Text>
              </View>
            ) : null}
          </View>

          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
              padding: 14,
              gap: 12,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 320,
                aspectRatio: 1,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: 170,
                  height: 170,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20 }}>NFC</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Aproxime a tag</Text>
              </View>

              {scanState === "scanning" ? (
                <LinearGradient
                  colors={["transparent", colors.primaryBg, "transparent"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 3,
                    opacity: 0.55,
                  }}
                />
              ) : null}
            </View>

            <Text style={{ color: colors.muted, textAlign: "center", fontSize: 13 }}>{scanGuideText}</Text>

            {scanState === "scanning" && !supportMessage ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Vibracao de busca ativa (padrao Morse: _ . _ .)
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => {
                void toggleScanning();
              }}
              style={{
                flex: 1,
                borderRadius: 14,
                paddingVertical: 12,
                alignItems: "center",
                backgroundColor: colors.primaryBg,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                {scanState === "idle"
                  ? "Iniciar leitura"
                  : scanState === "scanning"
                  ? "Pausar leitura"
                  : "Retomar leitura"}
              </Text>
            </Pressable>
            {scanState !== "idle" ? (
              <Pressable
                onPress={() => {
                  void stopScanning();
                }}
                style={{
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  alignItems: "center",
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Parar</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={() => {
                void handleSyncNow("manual");
              }}
              style={{
                flex: 1,
                borderRadius: 12,
                paddingVertical: 10,
                alignItems: "center",
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Sincronizar agora</Text>
            </Pressable>

            {Platform.OS === "android" ? (
              <Pressable
                onPress={() => {
                  void openNfcSettings();
                }}
                style={{
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  alignItems: "center",
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Config NFC</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {supportMessage ? (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.warningBg,
              backgroundColor: colors.warningBg,
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.warningText, fontWeight: "800" }}>NFC indisponivel</Text>
            <Text style={{ color: colors.warningText }}>{supportMessage}</Text>
          </View>
        ) : null}

        {feedback ? (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: 12,
            }}
          >
            <Text style={{ color: colors.text }}>{feedback}</Text>
          </View>
        ) : null}

        {adminRequiredUid ? (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.warningBg,
              backgroundColor: colors.warningBg,
              padding: 12,
              gap: 4,
            }}
          >
            <Text style={{ color: colors.warningText, fontWeight: "800" }}>
              Somente admin pode vincular tags
            </Text>
            <Text style={{ color: colors.warningText }}>
              UID {adminRequiredUid} ainda nao vinculado. Solicite um admin para concluir o bind.
            </Text>
          </View>
        ) : null}

        <View
          style={{
            borderRadius: 18,
            padding: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>Indicadores NFC</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={{ width: "48%", borderRadius: 10, padding: 10, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Scans totais</Text>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{metrics.totalScans}</Text>
            </View>
            <View style={{ width: "48%", borderRadius: 10, padding: 10, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Duplicados</Text>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{metrics.duplicateScans}</Text>
            </View>
            <View style={{ width: "48%", borderRadius: 10, padding: 10, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Sincronizados</Text>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{metrics.checkinsSynced}</Text>
            </View>
            <View style={{ width: "48%", borderRadius: 10, padding: 10, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Pendentes</Text>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{metrics.checkinsPending}</Text>
            </View>
            <View style={{ width: "48%", borderRadius: 10, padding: 10, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Flush sync</Text>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{metrics.syncFlushed}</Text>
            </View>
            <View style={{ width: "48%", borderRadius: 10, padding: 10, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Erros sync</Text>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{metrics.syncErrors}</Text>
            </View>
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Turma ativa</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {classes.map((item) => {
              const active = selectedClassId === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedClassId(item.id)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700" }}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
            Tags vinculadas
          </Text>
          {classBindings.length ? (
            classBindings.map((binding) => {
              const student = studentsById.get(binding.studentId);
              if (!student) return null;
              return (
                <View
                  key={binding.id}
                  style={{
                    borderRadius: 12,
                    padding: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{student.name}</Text>
                  <Text style={{ color: colors.muted }}>UID {binding.tagUid}</Text>
                  {isAdmin ? (
                    <Pressable
                      onPress={() => confirmRemoveBinding(binding)}
                      style={{
                        borderRadius: 10,
                        paddingVertical: 8,
                        alignItems: "center",
                        backgroundColor: colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        opacity: removingBindingId === binding.id ? 0.6 : 1,
                      }}
                      disabled={removingBindingId === binding.id}
                    >
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        {removingBindingId === binding.id ? "Removendo..." : "Remover tag"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          ) : (
            <Text style={{ color: colors.muted }}>Nenhuma tag vinculada para esta turma.</Text>
          )}
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
            Presencas desta sessao
          </Text>
          {liveCheckins.length ? (
            liveCheckins.map((item) => (
              <View
                key={item.id}
                style={{
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.studentName}</Text>
                <Text style={{ color: colors.muted }}>{item.className}</Text>
                <Text style={{ color: colors.muted }}>
                  {formatTime(item.checkedInAt)} - UID {item.tagUid}
                </Text>
                <Text
                  style={{
                    color:
                      item.syncStatus === "synced"
                        ? colors.successText
                        : item.syncStatus === "pending"
                        ? colors.warningText
                        : colors.dangerText,
                    fontWeight: "700",
                  }}
                >
                  {getSyncLabel(item.syncStatus)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.muted }}>Nenhuma presenca registrada ainda.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={showBindModal} transparent animationType="fade" onRequestClose={closeBindModal}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.42)",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              padding: 14,
              gap: 10,
              maxHeight: "85%",
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>Vincular tag NFC</Text>
            <Text style={{ color: colors.muted }}>UID: {pendingUid}</Text>

            <TextInput
              value={bindSearch}
              onChangeText={setBindSearch}
              placeholder="Buscar aluno por nome"
              placeholderTextColor={colors.muted}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                color: colors.text,
                backgroundColor: colors.secondaryBg,
                paddingHorizontal: 10,
                paddingVertical: 9,
              }}
            />

            {selectedStudentCurrentBinding &&
            selectedStudentCurrentBinding.tagUid !== pendingUid ? (
              <View
                style={{
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: 10,
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Tag atual do aluno selecionado
                </Text>
                <Text style={{ color: colors.muted }}>UID {selectedStudentCurrentBinding.tagUid}</Text>
                <Pressable
                  onPress={() => {
                    void removeBindingForStudent(selectedStudentCurrentBinding);
                  }}
                  style={{
                    borderRadius: 10,
                    paddingVertical: 8,
                    alignItems: "center",
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: removingBindingId === selectedStudentCurrentBinding.id ? 0.6 : 1,
                  }}
                  disabled={removingBindingId === selectedStudentCurrentBinding.id}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {removingBindingId === selectedStudentCurrentBinding.id
                      ? "Removendo..."
                      : "Remover tag atual"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
              {filteredBindCandidates.map((student) => {
                const selected = bindingStudentId === student.id;
                const className = classesById.get(student.classId)?.name ?? "Sem turma";
                const position = student.positionPrimary ?? "indefinido";
                return (
                  <Pressable
                    key={student.id}
                    onPress={() => setBindingStudentId(student.id)}
                    style={{
                      borderRadius: 10,
                      padding: 10,
                      borderWidth: 1,
                      borderColor: selected ? colors.primaryBg : colors.border,
                      backgroundColor: selected ? colors.primaryBg : colors.card,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {student.photoUrl ? (
                      <Image
                        source={{ uri: student.photoUrl }}
                        style={{ width: 34, height: 34, borderRadius: 17 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: selected ? "rgba(255,255,255,0.24)" : colors.secondaryBg,
                        }}
                      >
                        <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "800" }}>
                          {student.name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>
                        {student.name}
                      </Text>
                      <Text style={{ color: selected ? colors.primaryText : colors.muted }}>
                        {className} - {position}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {!filteredBindCandidates.length ? (
                <Text style={{ color: colors.muted }}>Nenhum aluno encontrado.</Text>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={closeBindModal}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (removingBindingId) return;
                  void confirmBind();
                }}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: colors.primaryBg,
                  opacity: bindingStudentId && !savingBinding && !removingBindingId ? 1 : 0.6,
                }}
                disabled={!bindingStudentId || savingBinding || Boolean(removingBindingId)}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  {savingBinding ? "Salvando..." : "Vincular e registrar presenca"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
