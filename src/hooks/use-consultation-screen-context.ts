import { useCallback, useRef, useSyncExternalStore } from "react";

import { getSessionIdentity, isSessionIdentityCurrent, subscribeSession } from "../auth/session";
import { isOrganizationAsyncIdentityCurrent } from "../core/organization-async-identity";
import {
  assertConsultationContext,
  captureConsultationContext,
  captureStudentConsultationContext,
  getConsultationLocalState,
  isConsultationContextCurrent,
  type ConsultationContext,
} from "../db/consultation";
import { getStudents } from "../db/seed";
import { useOrganization } from "../providers/organization-context";
import { useOrganizationAsyncIdentity } from "./use-organization-async-identity";

const sessionKey = () => {
  const identity = getSessionIdentity();
  return `${identity.userId}:${identity.generation}`;
};

export function useConsultationScreenIdentity() {
  const session = useSyncExternalStore(subscribeSession, sessionKey, sessionKey);
  const { activeOrganizationId } = useOrganization();
  const organizationId = activeOrganizationId ?? "";
  const { identity } = useOrganizationAsyncIdentity(organizationId);
  return { organizationId, key: `${session}:${organizationId}:${identity.generation}` };
}

export type ConsultationStudentScope = { studentId: string; organizationId: string };

export function useConsultationScreenContext(organizationId: string, studentScope?: ConsultationStudentScope) {
  const studentId = studentScope?.studentId;
  const studentOrganizationId = studentScope?.organizationId;
  const session = useRef(getSessionIdentity()).current;
  const { identity, identityRef } = useOrganizationAsyncIdentity(organizationId);
  const contextRef = useRef<ConsultationContext | null>(null);
  const loadSequence = useRef(0);

  const isActive = useCallback(() =>
    isSessionIdentityCurrent(session) && isOrganizationAsyncIdentityCurrent(identityRef.current, identity),
  [identity, identityRef, session]);
  const isCurrent = useCallback((context: ConsultationContext) =>
    isActive() && context.organizationId === organizationId && isConsultationContextCurrent(context),
  [isActive, organizationId]);
  const getContext = useCallback(() => {
    const context = contextRef.current;
    return context && isCurrent(context) ? context : null;
  }, [isCurrent]);

  const load = useCallback(async (includeStudents: boolean) => {
    if (!isActive()) return null;
    const sequence = ++loadSequence.current;
    const isLatest = () => isActive() && sequence === loadSequence.current;
    const previousContext = contextRef.current;
    try {
      if (previousContext && !isCurrent(previousContext)) {
        throw new Error("O contexto mudou. Abra novamente a consultoria.");
      }
      const verifiedStudentContext = previousContext?.student?.id === studentId &&
        previousContext?.organizationId === studentOrganizationId ? previousContext : null;
      const context = verifiedStudentContext ?? (studentId && studentOrganizationId
        ? await captureStudentConsultationContext(studentId, studentOrganizationId)
        : await captureConsultationContext(organizationId));
      await assertConsultationContext(context);
      if (!isLatest() || !isCurrent(context)) return null;
      const [snapshot, students] = await Promise.all([
        getConsultationLocalState(context),
        includeStudents ? getStudents() : Promise.resolve([]),
      ]);
      await assertConsultationContext(context);
      if (!isLatest() || !isCurrent(context)) return null;
      contextRef.current = snapshot.context;
      return { snapshot, students };
    } catch (error) {
      if (!isLatest()) return null;
      // Keep an expired context blocked until the scoped screen is reopened.
      if (!previousContext || isCurrent(previousContext)) contextRef.current = null;
      throw error;
    }
  }, [isActive, isCurrent, organizationId, studentId, studentOrganizationId]);

  return { load, getContext, isCurrent, isActive };
}
