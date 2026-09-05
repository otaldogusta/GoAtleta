import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState } from "react-native";
import type { Student } from "../core/models";
import { getStudentProfilePhoto } from "../api/student-self-photo";
import { getStudentPhotoAccessUrl } from "../api/student-photo-storage";

export function useStudentProfilePhoto(student: Student | null) {
  const [photo, setPhoto] = useState<{ studentId: string; uri: string | null } | null>(null);
  const id = student?.id;
  const organizationId = student?.organizationId;
  const source = student?.photoUrl;
  useFocusEffect(useCallback(() => {
    if (!id || !organizationId) return;
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (busy) return;
      busy = true;
      try {
        const current = await getStudentProfilePhoto(id, organizationId);
        const uri = await getStudentPhotoAccessUrl(current);
        if (active) setPhoto({ studentId: id, uri });
      } catch {
        // Do not fall back to an inaccessible public URL or another account's photo.
      } finally {
        busy = false;
      }
    };
    void refresh();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") void refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 60_000);
    return () => { active = false; subscription.remove(); clearInterval(timer); };
  }, [id, organizationId, source]));
  return photo && photo.studentId === id ? photo.uri : null;
}
