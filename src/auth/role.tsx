import * as Sentry from "@sentry/react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import type { Student } from "../core/models";
import { getDevProfilePreview, type DevProfilePreview } from "../dev/profile-preview";
import { useAuth } from "./auth";
import { getSessionUserId, getValidAccessToken } from "./session";

export type UserRole = "trainer" | "student" | "pending";

type RoleState = {
  role: UserRole | null;
  devProfilePreview: DevProfilePreview;
  student: Student | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const RoleContext = createContext<RoleState | null>(null);

type StudentRow = {
  id: string;
  name: string;
  organization_id?: string | null;
  photo_url?: string | null;
  classid: string;
  age: number;
  phone: string;
  login_email: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relation: string | null;
  health_issue?: boolean | null;
  health_issue_notes?: string | null;
  medication_use?: boolean | null;
  medication_notes?: string | null;
  health_observations?: string | null;
  position_primary?: string | null;
  position_secondary?: string | null;
  athlete_objective?: string | null;
  learning_style?: string | null;
  birthdate: string | null;
  createdat: string;
};

const mapStudent = (row: StudentRow): Student => ({
  id: row.id,
  name: row.name,
  organizationId: row.organization_id ?? "",
  photoUrl: row.photo_url ?? undefined,
  classId: row.classid,
  age: row.age,
  phone: row.phone,
  loginEmail: row.login_email ?? undefined,
  guardianName: row.guardian_name ?? undefined,
  guardianPhone: row.guardian_phone ?? undefined,
  guardianRelation: row.guardian_relation ?? undefined,
  healthIssue: row.health_issue ?? false,
  healthIssueNotes: row.health_issue_notes ?? "",
  medicationUse: row.medication_use ?? false,
  medicationNotes: row.medication_notes ?? "",
  healthObservations: row.health_observations ?? "",
  positionPrimary: (row.position_primary as Student["positionPrimary"]) ?? "indefinido",
  positionSecondary: (row.position_secondary as Student["positionSecondary"]) ?? "indefinido",
  athleteObjective: (row.athlete_objective as Student["athleteObjective"]) ?? "base",
  learningStyle: (row.learning_style as Student["learningStyle"]) ?? "misto",
  birthDate: row.birthdate ?? "",
  createdAt: row.createdat,
});

const fetchIsTrainer = async (token: string) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(base + "/rest/v1/rpc/is_trainer", {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Falha ao checar role.");
  try {
    return Boolean(JSON.parse(text));
  } catch {
    return text.trim() === "true";
  }
};

const fetchStudentSelf = async (token: string, userId: string) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const res = await fetch(
    base +
      "/rest/v1/students?select=*&student_user_id=eq." +
      encodeURIComponent(userId) +
      "&limit=1",
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(text || "Falha ao buscar aluno.");
  const rows = text ? (JSON.parse(text) as StudentRow[]) : [];
  if (!rows.length) return null;
  return mapStudent(rows[0]);
};

const buildPreviewStudent = (userId: string | null): Student => ({
  id: userId ?? "preview-student",
  name: "Aluno (Preview)",
  organizationId: "preview",
  photoUrl: undefined,
  classId: "",
  age: 0,
  phone: "",
  loginEmail: "",
  guardianName: "",
  guardianPhone: "",
  guardianRelation: "",
  healthIssue: false,
  healthIssueNotes: "",
  medicationUse: false,
  medicationNotes: "",
  healthObservations: "",
  positionPrimary: "indefinido",
  positionSecondary: "indefinido",
  athleteObjective: "base",
  learningStyle: "misto",
  birthDate: "",
  createdAt: new Date().toISOString(),
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [devProfilePreview, setDevProfilePreviewState] = useState<DevProfilePreview>("auto");
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const preview = await getDevProfilePreview();
    setDevProfilePreviewState(preview);

    if (!session) {
      setRole(null);
      setStudent(null);
      return;
    }

    setLoading(true);
    try {
      if (preview === "professor" || preview === "admin") {
        setRole("trainer");
        setStudent(null);
        return;
      }

      if (preview === "student") {
        const token = await getValidAccessToken();
        const userId = await getSessionUserId();
        if (token && userId) {
          const studentRow = await fetchStudentSelf(token, userId);
          setRole("student");
          setStudent(studentRow ?? buildPreviewStudent(userId));
          return;
        }
        setRole("student");
        setStudent(buildPreviewStudent(userId));
        return;
      }

      const token = await getValidAccessToken();
      const userId = await getSessionUserId();
      if (!token || !userId) {
        setRole("pending");
        setStudent(null);
        return;
      }
      const isTrainer = await fetchIsTrainer(token);
      if (isTrainer) {
        setRole("trainer");
        setStudent(null);
        return;
      }
      const studentRow = await fetchStudentSelf(token, userId);
      if (studentRow) {
        setRole("student");
        setStudent(studentRow);
        return;
      }
      setRole("pending");
      setStudent(null);
    } catch (error) {
      Sentry.captureException(error);
      setRole("pending");
      setStudent(null);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ role, devProfilePreview, student, loading, refresh }),
    [devProfilePreview, loading, refresh, role, student]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      role: null,
      devProfilePreview: "auto",
      student: null,
      loading: false,
      refresh: async () => {},
    } as RoleState;
  }
  return ctx;
};
