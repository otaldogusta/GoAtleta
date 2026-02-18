import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../src/auth/auth";
import type { ClassGroup, Student } from "../src/core/models";
import { createCheckin } from "../src/data/attendance-checkins";
import { createBinding, getBinding } from "../src/data/nfc-tag-bindings";
import { getClasses, getStudents } from "../src/db/seed";
import { isNfcSupported } from "../src/nfc/nfc";
import { useNfcScanner } from "../src/nfc/nfc-hooks";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

type LiveCheckin = {
  id: string;
  studentName: string;
  className: string;
  checkedInAt: string;
  tagUid: string;
};

const formatTime = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export default function NfcAttendanceScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { activeOrganization } = useOrganization();
  const { session } = useAuth();
  const { scanning, scanOnce } = useNfcScanner();

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

  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
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

  useEffect(() => {
    if (Platform.OS === "web") {
      setSupportMessage("NFC não é suportado no web.");
      return;
    }
    let alive = true;
    (async () => {
      const support = await isNfcSupported();
      if (!alive) return;
      if (!support.available || !support.enabled) {
        setSupportMessage(support.reason ?? "NFC indisponível neste aparelho.");
      } else {
        setSupportMessage("");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const orgId = activeOrganization?.id ?? "";
    if (!orgId) {
      setClasses([]);
      setStudents([]);
      return;
    }
    (async () => {
      const [classRows, studentRows] = await Promise.all([
        getClasses({ organizationId: orgId }),
        getStudents({ organizationId: orgId }),
      ]);
      if (!alive) return;
      setClasses(classRows);
      setStudents(studentRows);
      if (!selectedClassId && classRows.length) {
        setSelectedClassId(classRows[0].id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id, selectedClassId]);

  const registerCheckin = useCallback(
    async (params: { studentId: string; tagUid: string }) => {
      const orgId = activeOrganization?.id ?? "";
      if (!orgId) {
        setFeedback("Selecione uma organização ativa.");
        return;
      }
      const student = studentsById.get(params.studentId);
      if (!student) {
        setFeedback("Aluno não encontrado para esta tag.");
        return;
      }
      const resolvedClassId = selectedClassId || student.classId || null;
      const checkin = await createCheckin({
        organizationId: orgId,
        classId: resolvedClassId,
        studentId: params.studentId,
        tagUid: params.tagUid,
      });
      const className = classesById.get(resolvedClassId ?? "")?.name ?? "Sem turma";
      setLiveCheckins((prev) => [
        {
          id: checkin.id,
          studentName: student.name,
          className,
          checkedInAt: checkin.checkedInAt,
          tagUid: params.tagUid,
        },
        ...prev,
      ]);
      setFeedback(`Presença registrada: ${student.name}`);
      console.log("[NFC] checkin OK", { uid: params.tagUid, studentId: params.studentId });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [activeOrganization?.id, classesById, selectedClassId, studentsById]
  );

  const handleScan = useCallback(async () => {
    if (supportMessage) {
      setFeedback(supportMessage);
      return;
    }
    setFeedback("");
    try {
      const result = await scanOnce();
      if (!result) return;
      const uid = result.uid;
      console.log("[NFC] UID scanned", uid, result.rawTag);
      const orgId = activeOrganization?.id ?? "";
      if (!orgId) {
        setFeedback("Selecione uma organização ativa.");
        return;
      }
      const binding = await getBinding(orgId, uid);
      if (binding) {
        await registerCheckin({ studentId: binding.studentId, tagUid: uid });
        return;
      }
      if (!isAdmin) {
        setFeedback("Tag sem vínculo. Um admin precisa vincular este UID.");
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }
      setPendingUid(uid);
      setBindingStudentId("");
      setShowBindModal(true);
      setFeedback(`Tag ${uid} sem vínculo. Escolha um aluno para vincular.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ler tag NFC.";
      setFeedback(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [activeOrganization?.id, isAdmin, registerCheckin, scanOnce, supportMessage]);

  const confirmBind = useCallback(async () => {
    if (!pendingUid || !bindingStudentId) return;
    if (!activeOrganization?.id) return;
    if (!session?.user?.id) {
      Alert.alert("Sessão inválida", "Faça login novamente para vincular tags.");
      return;
    }
    setSavingBinding(true);
    try {
      const binding = await createBinding({
        organizationId: activeOrganization.id,
        tagUid: pendingUid,
        studentId: bindingStudentId,
        createdBy: session.user.id,
      });
      console.log("[NFC] binding created", binding);
      setShowBindModal(false);
      await registerCheckin({ studentId: bindingStudentId, tagUid: pendingUid });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao vincular tag.";
      setFeedback(message);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSavingBinding(false);
    }
  }, [activeOrganization?.id, bindingStudentId, pendingUid, registerCheckin, session?.user?.id]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 24 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>
            Presença NFC
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
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
            borderRadius: 14,
            padding: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Organização: {activeOrganization?.name ?? "Nenhuma"}
          </Text>
          <Text style={{ color: colors.muted }}>
            Encoste a tag para registrar presença por UID.
          </Text>
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

        <Pressable
          onPress={() => {
            void handleScan();
          }}
          style={{
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: "center",
            backgroundColor: colors.primaryBg,
            opacity: scanning ? 0.7 : 1,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            {scanning ? "Lendo tag..." : "Iniciar leitura NFC"}
          </Text>
        </Pressable>

        {supportMessage ? (
          <Text style={{ color: colors.muted }}>{supportMessage}</Text>
        ) : null}
        {feedback ? <Text style={{ color: colors.text }}>{feedback}</Text> : null}

        <View style={{ gap: 8 }}>
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
                  {formatTime(item.checkedInAt)} • UID {item.tagUid}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.muted }}>Nenhuma presença registrada ainda.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={showBindModal} transparent animationType="fade" onRequestClose={() => setShowBindModal(false)}>
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
              maxHeight: "80%",
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>Vincular tag NFC</Text>
            <Text style={{ color: colors.muted }}>UID: {pendingUid}</Text>
            <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ gap: 8 }}>
              {bindCandidates.map((student) => {
                const selected = bindingStudentId === student.id;
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
                    }}
                  >
                    <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>
                      {student.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setShowBindModal(false)}
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
                  void confirmBind();
                }}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  paddingVertical: 10,
                  alignItems: "center",
                  backgroundColor: colors.primaryBg,
                  opacity: bindingStudentId && !savingBinding ? 1 : 0.6,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  {savingBinding ? "Salvando..." : "Vincular + Check-in"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
