import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as IntentLauncher from "expo-intent-launcher";
import { LinearGradient } from "expo-linear-gradient";
import * as Network from "expo-network";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
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
import { useCopilotActions, useCopilotContext } from "../src/copilot/CopilotProvider";
import type { ClassGroup, Student } from "../src/core/models";
import { useSmartSync } from "../src/core/use-smart-sync";
import {
    createCheckinWithFallback,
    type CheckinDeliveryStatus,
} from "../src/data/attendance-checkins";
import {
    createBinding,
    deleteBinding,
    getBinding,
    listBindings,
    type NfcTagBinding,
} from "../src/data/nfc-tag-bindings";
import { getClasses, getStudents } from "../src/db/seed";
import {
    getNfcMetrics,
    incrementNfcMetric,
    type NfcMetricKey,
    type NfcMetrics,
} from "../src/nfc/metrics";
import { isNfcSupported } from "../src/nfc/nfc";
import { NFC_ERRORS } from "../src/nfc/nfc-errors";
import { useNfcContinuousScan } from "../src/nfc/nfc-hooks";
import { logNfcError, logNfcEvent } from "../src/nfc/telemetry";
import { markRender, measureAsync } from "../src/observability/perf";
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

const DUPLICATE_WINDOW_MS = 5_000; // Reduced from 20s: faster recovery for legitimate scans
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
  markRender("screen.nfc.render.root");

  const { colors } = useAppTheme();
  const router = useRouter();
  const { activeOrganization } = useOrganization();
  const { session } = useAuth();
  const { showSaveToast } = useSaveToast();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { syncNow } = useSmartSync();

  useCopilotContext(
    useMemo(
      () => ({
        screen: "nfc_attendance",
        title: "Presença NFC",
        subtitle: "Leitura e check-ins em tempo real",
      }),
      []
    )
  );

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
  const [webPreviewScanning, setWebPreviewScanning] = useState(false);

  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const shouldResumeAfterBindRef = useRef(false);
  const scanStateRef = useRef<"idle" | "scanning" | "paused">("idle");
  const syncBusyRef = useRef(false);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSignalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanPulseA = useRef(new Animated.Value(0)).current;
  const scanPulseB = useRef(new Animated.Value(0)).current;
  const scanVisualTransition = useRef(new Animated.Value(0)).current;
  const perfSnapshotRef = useRef<{ at: number; totalScans: number; duplicateScans: number }>({
    at: Date.now(),
    totalScans: 0,
    duplicateScans: 0,
  });

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

  const registerCheckin = useCallback(
    async (params: { studentId: string; tagUid: string }) => {
      const orgId = activeOrganization?.id ?? "";
      if (!orgId) {
        setFeedback("Selecione uma organizacao ativa.");
        return;
      }

      const student = studentsById.get(params.studentId);
      if (!student) {
        logNfcEvent("scan_binding_missing_student", {
          organizationId: orgId,
          studentId: params.studentId,
          tagUid: params.tagUid,
        });
        setFeedback("Aluno não encontrado para esta tag.");
        showSaveToast({ variant: "error", message: "Aluno da tag não encontrado." });
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

      if (result.status === "pending") {
        logNfcEvent("checkin_pending_offline", {
          organizationId: orgId,
          classId: resolvedClassId,
          studentId: params.studentId,
          tagUid: params.tagUid,
        });
        void recordMetric("checkinsPending");
        setFeedback(`Presença salva offline: ${student.name}`);
        showSaveToast({
          variant: "warning",
          message: `Sem internet. Presença pendente para ${student.name}.`,
        });
      } else {
        logNfcEvent("checkin_synced", {
          organizationId: orgId,
          classId: resolvedClassId,
          studentId: params.studentId,
          tagUid: params.tagUid,
        });
        void recordMetric("checkinsSynced");
        setFeedback(`Presença registrada: ${student.name}`);
        showSaveToast({
          variant: "success",
          message: `Presença registrada: ${student.name}`,
        });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [
      activeOrganization?.id,
      classesById,
      recordMetric,
      selectedClassId,
      showSaveToast,
      studentsById,
    ]
  );

  const handleDuplicateTag = useCallback(
    (result: { uid: string }) => {
      const orgId = activeOrganization?.id ?? "";
      if (!orgId) return;
      logNfcEvent("scan_duplicate_blocked", {
        organizationId: orgId,
        tagUid: result.uid,
      });
      void recordMetric("duplicateScans");
      setFeedback("Tag ja registrada ha instantes.");
      showSaveToast({
        variant: "warning",
        message: "Leitura repetida em poucos segundos.",
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    [activeOrganization?.id, recordMetric, showSaveToast]
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
    onDuplicateTag: handleDuplicateTag,
    onError: handleScanError,
    loopDelayMs: 120,
    duplicateWindowMs: DUPLICATE_WINDOW_MS,
    perUidDedup: true,
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
          showSaveToast({ variant: "info", message: "Não há pendências para sincronizar." });
        }
      } catch (error) {
        void recordMetric("syncErrors");
        logNfcError(error, {
          organizationId: activeOrganization?.id ?? "",
          origin,
          screen: "nfc-attendance",
        });
        if (origin === "manual") {
          const friendly = getFriendlyErrorMessage(error, "Falha ao sincronizar pendências.");
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
      const reason = "NFC não é suportado no navegador.";
      setSupportMessage(reason);
      setFeedback("");
      return { ok: false as const, reason };
    }
    const support = await isNfcSupported();
    if (!support.available || !support.enabled) {
      const reason = support.reason ?? "NFC indisponível neste aparelho.";
      setSupportMessage(reason);
      return { ok: false as const, reason };
    }
    setSupportMessage("");
    return { ok: true as const };
  }, []);

  const openNfcSettings = useCallback(async () => {
    if (Platform.OS !== "android") {
      setFeedback("Ative o NFC nas configurações do aparelho.");
      return;
    }
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.NFC_SETTINGS);
    } catch (error) {
      const friendly = getFriendlyErrorMessage(error, "Não foi possível abrir configurações NFC.");
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
      if (!support.ok && Platform.OS !== "web") setFeedback(support.reason);
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
        const [classRows, studentRows, bindingRows] = await measureAsync(
          "screen.nfc.load.initial",
          () =>
            Promise.all([
              getClasses({ organizationId: orgId }),
              getStudents({ organizationId: orgId }),
              listBindings(orgId),
            ]),
          { screen: "nfc", organizationId: orgId }
        );
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

  // Runtime diagnostics: emit loop snapshots every 60s for stress tests.
  useEffect(() => {
    try {
      (
        globalThis as unknown as {
          __nfcDiagnostics?: {
            getRecentScanCacheSize?: () => number;
          };
        }
      ).__nfcDiagnostics = {
        ...(
          (
            globalThis as unknown as {
              __nfcDiagnostics?: Record<string, unknown>;
            }
          ).__nfcDiagnostics ?? {}
        ),
        getRecentScanCacheSize: () => 0,
      };
    } catch (_e) {
      // ignore
    }

    const snapshotInterval = setInterval(() => {
      try {
        const orgId = activeOrganization?.id ?? "unknown";
        const now = Date.now();
        const elapsedMs = Math.max(1, now - perfSnapshotRef.current.at);
        const scansDelta = Math.max(0, metrics.totalScans - perfSnapshotRef.current.totalScans);
        const duplicatesDelta = Math.max(
          0,
          metrics.duplicateScans - perfSnapshotRef.current.duplicateScans
        );
        const scansPerMin = Math.round((scansDelta * 60_000) / elapsedMs);
        const duplicatesPerMin = Math.round((duplicatesDelta * 60_000) / elapsedMs);
        const diagnostics = (
          globalThis as unknown as {
            __nfcDiagnostics?: {
              getNfcLoopState?: () => Record<string, unknown>;
            };
          }
        ).__nfcDiagnostics;
        const loopSnapshot = diagnostics?.getNfcLoopState?.() ?? {};
        logNfcEvent("nfc_runtime_metrics", {
          organizationId: orgId,
          scansPerMin,
          duplicatesPerMin,
          checkinsPending: metrics.checkinsPending,
          syncErrors: metrics.syncErrors,
          cacheSize: 0,
          gcEventsPerMin: 0,
          ...loopSnapshot,
        });
        perfSnapshotRef.current = {
          at: now,
          totalScans: metrics.totalScans,
          duplicateScans: metrics.duplicateScans,
        };
      } catch (_e) {
        // ignore
      }
    }, 60_000);

    return () => clearInterval(snapshotInterval);
  }, [activeOrganization?.id, metrics.checkinsPending, metrics.duplicateScans, metrics.syncErrors, metrics.totalScans]);

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
      const stored = await measureAsync(
        "screen.nfc.load.metrics",
        () => getNfcMetrics(orgId),
        { screen: "nfc", organizationId: orgId }
      );
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
    if (Platform.OS === "web") {
      setWebPreviewScanning((prev) => {
        const next = !prev;
        return next;
      });
      return;
    }

    if (scanState === "scanning" || scanState === "paused") {
      await stopScan();
      shouldResumeAfterBindRef.current = false;
      setShowBindModal(false);
      setFeedback("Leitor NFC desligado.");
      return;
    }

    if (scanState === "idle") {
      const support = await refreshNfcSupport();
      if (!support.ok) {
        setFeedback(support.reason);
        return;
      }
      startScan();
      setFeedback("Leitor NFC ligado.");
    }
  }, [refreshNfcSupport, scanState, startScan, stopScan]);

  const stopScanning = useCallback(async () => {
    if (Platform.OS === "web") {
      setWebPreviewScanning(false);
      shouldResumeAfterBindRef.current = false;
      setShowBindModal(false);
      return;
    }
    await stopScan();
    shouldResumeAfterBindRef.current = false;
    setShowBindModal(false);
    setFeedback("Leitura parada.");
  }, [stopScan]);

  const uiScanState = Platform.OS === "web" ? (webPreviewScanning ? "scanning" : "idle") : scanState;
  const selectedClassName =
    classesById.get(selectedClassId)?.name ?? "turma ativa";
  const hasPendingSync = metrics.checkinsPending > 0;
  const organizationLabel =
    activeOrganization?.name ?? "Sem organização ativa";
  const effectiveSupportMessage = Platform.OS === "web" ? "" : supportMessage;
  const isScanLive =
    Platform.OS === "web"
      ? webPreviewScanning
      : uiScanState === "scanning" && !effectiveSupportMessage && !showBindModal;
  const isScannerOn = uiScanState === "scanning";
  const openAssistantFromNfc = useCallback(
    (prompt: string) => {
      router.push({
        pathname: "/assistant",
        params: {
          prompt,
          source: "nfc_attendance",
        },
      });
    },
    [router]
  );
  const assistantPromptChips = useMemo(
    () => [
      {
        id: "nfc_summary",
        label: "Resumo NFC",
        description: "Visão rápida da operação atual com foco no que já aconteceu.",
        prompt: `Gere um resumo operacional do NFC para ${selectedClassName} com base nos indicadores: scans ${metrics.totalScans}, duplicados ${metrics.duplicateScans}, pendentes ${metrics.checkinsPending}, erros de sync ${metrics.syncErrors}.`,
      },
      {
        id: "nfc_actions",
        label: "Próximas ações",
        description: "Próximos passos recomendados para destravar o fluxo agora.",
        prompt: `Quais ações rápidas devo executar agora no fluxo NFC da ${selectedClassName}? Considere pendências ${metrics.checkinsPending} e duplicados ${metrics.duplicateScans}.`,
      },
      {
        id: "nfc_duplicates",
        label: "Analisar duplicados",
        description: "Análise de risco de leituras repetidas e como reduzir retrabalho.",
        prompt: `Analise o risco de leituras duplicadas no NFC da ${selectedClassName} e recomende ajustes práticos de operação.`,
      },
    ],
    [
      metrics.checkinsPending,
      metrics.duplicateScans,
      metrics.syncErrors,
      metrics.totalScans,
      selectedClassName,
    ]
  );
  const nfcCopilotActions = useMemo(
    () =>
      assistantPromptChips.map((chip) => ({
        id: chip.id,
        title: chip.label,
        description: chip.description,
        run: () => {
          openAssistantFromNfc(chip.prompt);
          return "Abrindo assistente completo.";
        },
      })),
    [assistantPromptChips, openAssistantFromNfc]
  );
  useCopilotActions(nfcCopilotActions);

  useEffect(() => {
    Animated.timing(scanVisualTransition, {
      toValue: isScannerOn ? 1 : 0,
      duration: isScannerOn ? 420 : 280,
      easing: isScannerOn ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isScannerOn, scanVisualTransition]);

  useEffect(() => {
    if (!isScanLive) {
      scanPulseA.stopAnimation();
      scanPulseB.stopAnimation();
      scanPulseA.setValue(0);
      scanPulseB.setValue(0);
      return;
    }

    const pulseALoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPulseA, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanPulseA, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    const pulseBLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(scanPulseB, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanPulseB, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    pulseALoop.start();
    pulseBLoop.start();

    return () => {
      pulseALoop.stop();
      pulseBLoop.stop();
      scanPulseA.stopAnimation();
      scanPulseB.stopAnimation();
      scanPulseA.setValue(0);
      scanPulseB.setValue(0);
    };
  }, [isScanLive, scanPulseA, scanPulseB]);

  const pulseAStyle = {
    transform: [
      {
        scale: scanPulseA.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.9],
        }),
      },
    ],
    opacity: Animated.multiply(
      scanVisualTransition,
      scanPulseA.interpolate({
        inputRange: [0, 1],
        outputRange: [0.55, 0],
      })
    ),
  } as const;

  const pulseBStyle = {
    transform: [
      {
        scale: scanPulseB.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 2.8],
        }),
      },
    ],
    opacity: Animated.multiply(
      scanVisualTransition,
      scanPulseB.interpolate({
        inputRange: [0, 1],
        outputRange: [0.4, 0],
      })
    ),
  } as const;

  const scanIconTransitionStyle = {
    opacity: scanVisualTransition.interpolate({
      inputRange: [0, 1],
      outputRange: [0.82, 1],
    }),
    transform: [
      {
        scale: scanVisualTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1],
        }),
      },
    ],
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        <View style={{ width: "100%", maxWidth: 980, alignSelf: "center", gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => {
              void stopScanning().finally(() => router.back());
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900" }}>Presença NFC</Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 13, marginLeft: 26 }}>{organizationLabel}</Text>
        </View>

        <LinearGradient
          colors={
            uiScanState === "scanning"
              ? [colors.card, colors.secondaryBg, colors.card]
              : [colors.card, colors.card, colors.secondaryBg]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 24,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 14,
          }}
        >
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              padding: 16,
              gap: 12,
              alignItems: "center",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: 188,
                height: 188,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isScanLive ? (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: "absolute",
                        width: 96,
                        height: 96,
                        borderRadius: 48,
                        borderWidth: 2,
                        borderColor: colors.primaryBg,
                      },
                      pulseAStyle,
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: "absolute",
                        width: 96,
                        height: 96,
                        borderRadius: 48,
                        borderWidth: 2,
                        borderColor: colors.primaryBg,
                      },
                      pulseBStyle,
                    ]}
                  />
                </>
              ) : null}
              <Animated.View style={[{ alignItems: "center", justifyContent: "center", gap: 8 }, scanIconTransitionStyle]}>
                <Ionicons
                  name={uiScanState === "scanning" ? "radio" : "radio-outline"}
                  size={56}
                  color={
                    effectiveSupportMessage
                      ? colors.warningText
                      : uiScanState === "scanning"
                      ? colors.primaryBg
                      : colors.muted
                  }
                />
              </Animated.View>
            </View>

            <View style={{ flexDirection: "row", gap: 8, width: "100%" }}>
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
                  {!isScannerOn
                    ? Platform.OS === "web"
                      ? "Ativar"
                      : "Ligar leitor"
                    : Platform.OS === "web"
                    ? "Desativar"
                    : "Desligar leitor"}
                </Text>
              </Pressable>
            </View>
          </View>

          {Platform.OS !== "web" ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {hasPendingSync ? (
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
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Sincronizar pendências</Text>
                </Pressable>
              ) : null}

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
          ) : null}
        </LinearGradient>

        {feedback && feedback !== effectiveSupportMessage ? (
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
              UID {adminRequiredUid} ainda não vinculado. Solicite um admin para concluir o bind.
            </Text>
          </View>
        ) : null}

        <View
          style={{
            borderRadius: 16,
            padding: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
            display: "none",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>Assistente NFC</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Indicadores atuais: scans {metrics.totalScans} • duplicados {metrics.duplicateScans} • pendentes {metrics.checkinsPending}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {assistantPromptChips.map((chip) => (
              <Pressable
                key={chip.id}
                onPress={() => openAssistantFromNfc(chip.prompt)}
                style={{
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                }}
              >
                {/* perf-check: ignore-inline-row-style - chip curto e estatico */}
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                  {chip.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View
          style={{
            gap: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
          }}
        >
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

        <View
          style={{
            gap: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
          }}
        >
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

        <View
          style={{
            gap: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            padding: 12,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
            Presenças desta sessão
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
            <Text style={{ color: colors.muted }}>Nenhuma presença registrada ainda.</Text>
          )}
        </View>
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
                  {savingBinding ? "Salvando..." : "Vincular e registrar presença"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
