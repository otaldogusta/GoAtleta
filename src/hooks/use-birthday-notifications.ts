import { useEffect, useRef } from "react";

import { getSessionIdentity, isSessionIdentityCurrent } from "../auth/session";
import type { EffectiveProfile } from "../core/effective-profile";
import { isStudentBirthdayToday } from "../core/students/student-birthday";
import { getStudentBirthdayCandidates } from "../db/seed";
import { notifyBirthdays } from "../notifications";
import { notificationScopeForEffectiveProfile } from "../notifications/inbox-scope";
import { usePersistedState } from "../ui/use-persisted-state";

type BirthdayNotificationParams = {
  enabled: boolean;
  organizationId?: string | null;
  effectiveProfile: EffectiveProfile;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function useBirthdayNotifications({
  enabled,
  organizationId,
  effectiveProfile,
}: BirthdayNotificationParams) {
  const [lastCheckByOrganization, setLastCheckByOrganization, storageLoaded] =
    usePersistedState<Record<string, string>>(
      "students_birthday_notice_by_org_v1",
      {},
    );
  const inFlightKeyRef = useRef("");

  useEffect(() => {
    if (
      !enabled ||
      !storageLoaded ||
      !organizationId ||
      effectiveProfile === "student" ||
      effectiveProfile === "family"
    ) {
      return undefined;
    }

    const today = new Date();
    const todayKey = formatLocalDate(today);
    const checkKey = `${organizationId}:${todayKey}`;
    if (
      lastCheckByOrganization[organizationId] === todayKey ||
      inFlightKeyRef.current === checkKey
    ) {
      return undefined;
    }

    let active = true;
    const identity = getSessionIdentity();
    const isCurrent = () => active && isSessionIdentityCurrent(identity);
    inFlightKeyRef.current = checkKey;

    void (async () => {
      const students = await getStudentBirthdayCandidates({ organizationId });
      if (!isCurrent()) return;

      const birthdayStudents = students.filter((student) =>
        isStudentBirthdayToday(student.birthDate, today),
      );

      if (birthdayStudents.length > 0) {
        await notifyBirthdays(
          birthdayStudents.map((student) => student.name),
          {
            inboxScope: notificationScopeForEffectiveProfile(effectiveProfile),
            actionUrl:
              effectiveProfile === "admin"
                ? "/coord/students"
                : "/prof/students",
            sourceType: "students",
            sourceId: `birthday:${organizationId}:${todayKey}`,
            dedupe: true,
            metadata: {
              studentIds: birthdayStudents.map((student) => student.id),
              date: todayKey,
            },
          },
        );
      }

      if (isCurrent()) {
        setLastCheckByOrganization((current) => ({
          ...current,
          [organizationId]: todayKey,
        }));
      }
    })()
      .catch(() => {
        // A verificação é silenciosa e tenta novamente na próxima inicialização.
      })
      .finally(() => {
        if (inFlightKeyRef.current === checkKey) {
          inFlightKeyRef.current = "";
        }
      });

    return () => {
      active = false;
    };
  }, [
    effectiveProfile,
    enabled,
    lastCheckByOrganization,
    organizationId,
    setLastCheckByOrganization,
    storageLoaded,
  ]);
}
