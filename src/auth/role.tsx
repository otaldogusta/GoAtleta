import * as Sentry from "@sentry/react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import {
  getMyStudentContexts,
  isFamilyFoundationUnavailable,
  type FamilyStudentContext,
} from "../api/family-access";
import type { Student } from "../core/models";
import {
  getDevProfilePreview,
  type DevProfilePreview,
} from "../dev/profile-preview";
import {
  getActiveFamilyStudentPreference,
  getActiveRolePreference,
  setActiveFamilyStudentPreference,
  setActiveRolePreference,
} from "./active-role";
import { useAuth } from "./auth";
import type { SelectableUserRole, UserRole } from "./role-types";
import {
  resolveAvailableUserRoles,
  resolvePreferredActiveRole,
  resolveSelectedFamilyStudent,
} from "./role-resolution";
import { getSessionUserId, getValidAccessToken } from "./session";

export type { UserRole } from "./role-types";

type RoleState = {
  role: UserRole | null;
  availableRoles: SelectableUserRole[];
  devProfilePreview: DevProfilePreview;
  student: Student | null;
  familyContexts: FamilyStudentContext[];
  selectedFamilyStudent: FamilyStudentContext | null;
  loading: boolean;
  error: Error | null;
  refresh: (options?: { silent?: boolean } | boolean) => Promise<void>;
  retry: () => Promise<void>;
  setActiveRole: (role: SelectableUserRole) => Promise<boolean>;
  setActiveFamilyStudent: (studentId: string) => Promise<boolean>;
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
  membership_status?: string | null;
  inactivated_at?: string | null;
  inactivated_by?: string | null;
  inactivation_reason?: string | null;
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
  loginEmail: row.login_email ?? "",
  guardianName: row.guardian_name ?? "",
  guardianPhone: row.guardian_phone ?? "",
  guardianRelation: row.guardian_relation ?? "",
  healthIssue: row.health_issue ?? false,
  healthIssueNotes: row.health_issue_notes ?? "",
  medicationUse: row.medication_use ?? false,
  medicationNotes: row.medication_notes ?? "",
  healthObservations: row.health_observations ?? "",
  positionPrimary:
    (row.position_primary as Student["positionPrimary"]) ?? "indefinido",
  positionSecondary:
    (row.position_secondary as Student["positionSecondary"]) ?? "indefinido",
  athleteObjective:
    (row.athlete_objective as Student["athleteObjective"]) ?? "base",
  learningStyle: (row.learning_style as Student["learningStyle"]) ?? "misto",
  birthDate: row.birthdate ?? "",
  membershipStatus:
    row.membership_status === "inactive" ? "inactive" : "active",
  // Student self/role resolution never loads protected financial data.
  financialStatus: "unknown",
  inactivatedAt: row.inactivated_at ?? null,
  inactivatedBy: row.inactivated_by ?? null,
  inactivationReason: row.inactivation_reason ?? null,
  createdAt: row.createdat,
});

class RoleRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "RoleRequestError";
    this.status = status;
  }
}

export const ROLE_REQUEST_TIMEOUT_MS = 5000;

const fetchRoleResponse = async (
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(),
    ROLE_REQUEST_TIMEOUT_MS,
  );
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const text = await response.text();
    return { response, text };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new RoleRequestError("Tempo esgotado ao carregar o perfil.", 408);
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }
};

const fetchIsTrainer = async (token: string) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const { response, text } = await fetchRoleResponse(
    base + "/rest/v1/rpc/is_trainer",
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
  if (!response.ok) {
    throw new RoleRequestError(
      text || "Falha ao checar role.",
      response.status,
    );
  }
  try {
    return Boolean(JSON.parse(text));
  } catch {
    return text.trim() === "true";
  }
};

const fetchStudentSelf = async (token: string, userId: string) => {
  const base = SUPABASE_URL.replace(/\/$/, "");
  const { response, text } = await fetchRoleResponse(
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
    },
  );
  if (!response.ok) {
    throw new RoleRequestError(
      text || "Falha ao buscar aluno.",
      response.status,
    );
  }
  const rows = text ? (JSON.parse(text) as StudentRow[]) : [];
  if (!rows.length) return null;
  return mapStudent(rows[0]);
};

const fetchFamilyContexts = async (token: string) => {
  try {
    return await getMyStudentContexts(token);
  } catch (error) {
    if (isFamilyFoundationUnavailable(error)) return [];
    throw error;
  }
};

// Synthetic data is only valid for the explicit development preview.
const buildDevPreviewStudent = (userId: string | null): Student => ({
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
  membershipStatus: "active",
  financialStatus: "regular",
  inactivatedAt: null,
  createdAt: new Date().toISOString(),
});

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [role, setRole] = useState<UserRole | null>(null);
  const [availableRoles, setAvailableRoles] = useState<SelectableUserRole[]>(
    [],
  );
  const [devProfilePreview, setDevProfilePreviewState] =
    useState<DevProfilePreview>("auto");
  const [student, setStudent] = useState<Student | null>(null);
  const [familyContexts, setFamilyContexts] = useState<FamilyStudentContext[]>(
    [],
  );
  const [selectedFamilyStudent, setSelectedFamilyStudent] =
    useState<FamilyStudentContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const lastSessionUserIdRef = useRef<string | undefined>(session?.user?.id);
  const lastAutomaticRefreshKeyRef = useRef("");

  if (session?.user?.id !== lastSessionUserIdRef.current) {
    lastSessionUserIdRef.current = session?.user?.id;
    setLoading(true);
    setError(null);
    setRole(null);
    setAvailableRoles([]);
    setStudent(null);
    setFamilyContexts([]);
    setSelectedFamilyStudent(null);
  }

  const refresh = useCallback(
    async (options?: { silent?: boolean } | boolean) => {
      const isSilent =
        typeof options === "object" ? options?.silent : Boolean(options);
      if (!isSilent) {
        setLoading(true);
      }
      setError(null);
      try {
        const preview = await getDevProfilePreview();
        setDevProfilePreviewState(preview);

        if (!session) {
          setRole(null);
          setAvailableRoles([]);
          setStudent(null);
          setFamilyContexts([]);
          setSelectedFamilyStudent(null);
          return;
        }

        if (preview === "professor" || preview === "admin") {
          const token = await getValidAccessToken();
          const userId = await getSessionUserId();
          if (token && userId) {
            const [
              isTrainer,
              studentRow,
              familyRows,
              preferredFamilyStudentId,
            ] = await Promise.all([
              fetchIsTrainer(token),
              fetchStudentSelf(token, userId),
              fetchFamilyContexts(token),
              getActiveFamilyStudentPreference(userId),
            ]);
            const resolvedRoles = resolveAvailableUserRoles({
              isTrainer,
              hasStudent: Boolean(studentRow),
              familyContexts: familyRows,
            });
            const selectedFamily = resolveSelectedFamilyStudent({
              familyContexts: familyRows,
              preferredStudentId: preferredFamilyStudentId,
            });
            setAvailableRoles(resolvedRoles);
            setFamilyContexts(familyRows);
            setSelectedFamilyStudent(selectedFamily);
            if (!resolvedRoles.length) {
              setRole("pending");
              setStudent(null);
              return;
            }
          }
          setRole("trainer");
          setStudent(null);
          return;
        }

        if (preview === "student") {
          const token = await getValidAccessToken();
          const userId = await getSessionUserId();
          if (token && userId) {
            const [
              isTrainer,
              studentRow,
              familyRows,
              preferredFamilyStudentId,
            ] = await Promise.all([
              fetchIsTrainer(token),
              fetchStudentSelf(token, userId),
              fetchFamilyContexts(token),
              getActiveFamilyStudentPreference(userId),
            ]);
            setAvailableRoles(
              resolveAvailableUserRoles({
                isTrainer,
                hasStudent: Boolean(studentRow),
                familyContexts: familyRows,
              }),
            );
            setFamilyContexts(familyRows);
            setSelectedFamilyStudent(
              resolveSelectedFamilyStudent({
                familyContexts: familyRows,
                preferredStudentId: preferredFamilyStudentId,
              }),
            );
            setRole("student");
            setStudent(studentRow ?? buildDevPreviewStudent(userId));
            return;
          }
          setRole("student");
          setStudent(buildDevPreviewStudent(userId));
          setFamilyContexts([]);
          setSelectedFamilyStudent(null);
          return;
        }

        const token = await getValidAccessToken();
        const userId = await getSessionUserId();
        if (!token || !userId) {
          throw new RoleRequestError(
            "Sessão indisponível ao carregar o perfil.",
            401,
          );
        }
        const [
          isTrainer,
          studentRow,
          familyRows,
          preferredRole,
          preferredFamilyStudentId,
        ] = await Promise.all([
          fetchIsTrainer(token),
          fetchStudentSelf(token, userId),
          fetchFamilyContexts(token),
          getActiveRolePreference(userId),
          getActiveFamilyStudentPreference(userId),
        ]);
        const resolvedRoles = resolveAvailableUserRoles({
          isTrainer,
          hasStudent: Boolean(studentRow),
          familyContexts: familyRows,
        });
        const selectedFamily = resolveSelectedFamilyStudent({
          familyContexts: familyRows,
          preferredStudentId: preferredFamilyStudentId,
        });
        setAvailableRoles(resolvedRoles);
        setFamilyContexts(familyRows);
        setSelectedFamilyStudent(selectedFamily);
        if (resolvedRoles.length) {
          const resolvedRole = resolvePreferredActiveRole({
            availableRoles: resolvedRoles,
            preferredRole,
          });
          if (!resolvedRole) {
            setRole("pending");
            setStudent(null);
            return;
          }
          setRole(resolvedRole);
          setStudent(resolvedRole === "student" ? studentRow : null);
          return;
        }
        setRole("pending");
        setStudent(null);
      } catch (caughtError) {
        const parsedError =
          caughtError instanceof Error
            ? caughtError
            : new Error(String(caughtError));
        Sentry.captureException(parsedError);
        setError(parsedError);
        setRole(null);
        setAvailableRoles([]);
        setStudent(null);
        setFamilyContexts([]);
        setSelectedFamilyStudent(null);
      } finally {
        setLoading(false);
      }
    },
    [session],
  );

  const retry = useCallback(() => refresh(), [refresh]);

  useEffect(() => {
    const automaticRefreshKey = session
      ? `${session.user.id}:${session.access_token}`
      : "signed-out";
    if (lastAutomaticRefreshKeyRef.current === automaticRefreshKey) return;
    lastAutomaticRefreshKeyRef.current = automaticRefreshKey;

    Promise.resolve().then(() => {
      void refresh();
    });
  }, [refresh, session]);

  const setActiveRole = useCallback(
    async (nextRole: SelectableUserRole) => {
      const userId = await getSessionUserId();
      if (!userId || !availableRoles.includes(nextRole)) return false;
      await setActiveRolePreference(userId, nextRole);
      await refresh();
      return true;
    },
    [availableRoles, refresh],
  );

  const setActiveFamilyStudent = useCallback(
    async (studentId: string) => {
      const userId = await getSessionUserId();
      const selected = familyContexts.find(
        (context) => context.studentId === studentId.trim(),
      );
      if (!userId || !selected) return false;
      await setActiveFamilyStudentPreference(userId, selected.studentId);
      setSelectedFamilyStudent(selected);
      return true;
    },
    [familyContexts],
  );

  const value = useMemo(
    () => ({
      role,
      availableRoles,
      devProfilePreview,
      student,
      familyContexts,
      selectedFamilyStudent,
      loading,
      error,
      refresh,
      retry,
      setActiveRole,
      setActiveFamilyStudent,
    }),
    [
      availableRoles,
      devProfilePreview,
      familyContexts,
      loading,
      error,
      refresh,
      retry,
      role,
      selectedFamilyStudent,
      setActiveFamilyStudent,
      setActiveRole,
      student,
    ],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      role: null,
      availableRoles: [],
      devProfilePreview: "auto",
      student: null,
      familyContexts: [],
      selectedFamilyStudent: null,
      loading: false,
      error: null,
      refresh: async () => {},
      retry: async () => {},
      setActiveRole: async () => false,
      setActiveFamilyStudent: async () => false,
    } as RoleState;
  }
  return ctx;
};
