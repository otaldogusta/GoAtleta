import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";

import { getCachedAttendanceEditor } from "../db/students";
import { useEmbeddedClassAttendance } from "../screens/attendance/use-embedded-class-attendance";
import { ClassAttendanceWorkspacePanel } from "../screens/classes/components/ClassAttendanceWorkspacePanel";
import { spacing } from "../theme/tokens";
import { OperationalText as Text } from "../ui/OperationalText";
import { useAppTheme } from "../ui/app-theme";
import { useResponsiveLayout } from "../ui/use-responsive-layout";

type Snapshot = NonNullable<Awaited<ReturnType<typeof getCachedAttendanceEditor>>>;
const unavailable = () => undefined;

function LocalAttendance({ classId, snapshot, expiresAt }: { classId: string; snapshot: Snapshot; expiresAt: number }) {
  const { colors } = useAppTheme();
  const { isMobile, density } = useResponsiveLayout();
  const dateLabel = snapshot.date.split("-").reverse().join("/");
  const attendance = useEmbeddedClassAttendance({ classId, date: snapshot.date, enabled: true, localSnapshot: snapshot });

  useEffect(() => {
    if (!attendance.hasChanges || attendance.isDraftDurable) return;
    const preventLoss = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [attendance.hasChanges, attendance.isDraftDurable]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} keyboardShouldPersistTaps="handled">
      <View style={{ width: "100%", maxWidth: 860, alignSelf: "center", padding: spacing.md, gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: density.pageTitleFontSize, fontWeight: "700" }}>Chamada</Text>
          <Text style={{ color: colors.muted }}>{dateLabel} · Sem conexão</Text>
        </View>
        <ClassAttendanceWorkspacePanel
          {...attendance}
          colors={colors}
          compact={isMobile}
          mobile={isMobile}
          dense={false}
          dateLabel={dateLabel}
          localDraftOnly
          draftStatus={attendance.hasChanges && attendance.isDraftDurable ? "Rascunho salvo neste dispositivo. Sincroniza ao reconectar." : undefined}
          onPrevious={unavailable}
          onNext={unavailable}
          onOpenCalendar={unavailable}
          onOpenReport={unavailable}
          onSetStatus={(studentId, status) => {
            if (Date.now() < expiresAt * 1000) attendance.setStudentStatus(studentId, status);
          }}
          onSetDetails={unavailable}
          onSave={unavailable}
        />
      </View>
    </ScrollView>
  );
}

export default function OfflineAttendanceEditor({ classId, date, expiresAt, fallback }: {
  classId: string;
  date?: string;
  expiresAt: number;
  fallback: ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ classId: string; date?: string; expiresAt: number; snapshot: Snapshot } | null>(null);

  useEffect(() => {
    let active = true;
    const remainingMs = expiresAt * 1000 - Date.now();
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return;

    const expire = () => {
      active = false;
      setLoaded(null);
    };
    const checkExpiry = () => {
      if (Date.now() >= expiresAt * 1000) expire();
    };
    const expiry = setTimeout(expire, remainingMs);
    // Suspended tabs can resume before their timers run.
    document.addEventListener("visibilitychange", checkExpiry);
    window.addEventListener("pageshow", checkExpiry);
    void getCachedAttendanceEditor(classId, date).then((cached) => {
      if (active && cached && Date.now() < expiresAt * 1000) {
        setLoaded({ classId, date, expiresAt, snapshot: cached });
      }
    }).catch(() => undefined);

    return () => {
      active = false;
      clearTimeout(expiry);
      document.removeEventListener("visibilitychange", checkExpiry);
      window.removeEventListener("pageshow", checkExpiry);
    };
  }, [classId, date, expiresAt]);

  if (!loaded || loaded.classId !== classId || loaded.date !== date || loaded.expiresAt !== expiresAt) {
    return <>{fallback}</>;
  }
  return <LocalAttendance classId={classId} snapshot={loaded.snapshot} expiresAt={expiresAt} />;
}
