import { createContext, useContext, useEffect, useId, type Dispatch, type SetStateAction } from "react";
import type { TrainingPlan } from "../core/models";
import { useAuth } from "../auth/auth";
import { useOrganization } from "../providers/organization-context";
import type { LessonConversationScope } from "../screens/session/hooks/useLessonConversation";

export type CopilotLessonScope = LessonConversationScope & {
  className: string;
  currentPlanId: string | null;
  onApplied: (plan: TrainingPlan) => void;
  disabled?: boolean;
};
export type RegisteredCopilotLesson = { owner: string; userId: string; scope: CopilotLessonScope };
export const CopilotLessonContext = createContext<Dispatch<SetStateAction<RegisteredCopilotLesson | null>> | null>(null);

// Register the active lesson with the existing chatbot; render nothing in the class screen.
export function useCopilotLesson(scope: CopilotLessonScope | null) {
  const register = useContext(CopilotLessonContext);
  const owner = useId();
  const { session } = useAuth();
  const { activeOrganization, isLoading } = useOrganization();
  const userId = session?.user.id;
  const allowed = !isLoading && Boolean(userId && scope && activeOrganization?.id === scope.organizationId && activeOrganization.role_level >= 10);
  useEffect(() => {
    if (!register || !allowed || !scope || !userId) return;
    register({ owner, userId, scope });
    return () => register(current => current?.owner === owner ? null : current);
  }, [allowed, owner, register, scope, userId]);
}
