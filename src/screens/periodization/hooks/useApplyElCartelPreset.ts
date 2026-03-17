import { useCallback, type Dispatch, type SetStateAction } from "react";
import { Alert } from "react-native";

import {
  buildElCartelCalendarExceptions,
  buildElCartelClassPlans,
  buildElCartelCompetitiveProfile,
} from "../../../core/elcartel-periodization";
import type {
  ClassCalendarException,
  ClassCompetitiveProfile,
  ClassGroup,
  ClassPlan,
} from "../../../core/models";
import { cycleOptions, sessionsOptions } from "../../../core/periodization-basics";
import {
  deleteClassCalendarException,
  deleteClassPlansByClass,
  getClassCalendarExceptions,
  saveClassCalendarException,
  saveClassCompetitiveProfile,
  saveClassPlans,
} from "../../../db/seed";
import { measure } from "../../../observability/perf";
import { useConfirmDialog } from "../../../ui/confirm-dialog";

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export type UseApplyElCartelPresetParams = {
  selectedClass: ClassGroup | null;
  normalizeText: (value: string) => string;
  setClassPlans: (plans: ClassPlan[]) => void;
  setCycleLength: Dispatch<SetStateAction<(typeof cycleOptions)[number]>>;
  setSessionsPerWeek: Dispatch<SetStateAction<(typeof sessionsOptions)[number]>>;
  setCompetitiveProfile: (profile: ClassCompetitiveProfile | null) => void;
  setCalendarExceptions: (exceptions: ClassCalendarException[]) => void;
  setExceptionDateInput: (value: string) => void;
  setExceptionReasonInput: (value: string) => void;
  setShowPlanActionsModal: (value: boolean) => void;
  setIsSavingPlans: (value: boolean) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useApplyElCartelPreset({
  selectedClass,
  normalizeText,
  setClassPlans,
  setCycleLength,
  setSessionsPerWeek,
  setCompetitiveProfile,
  setCalendarExceptions,
  setExceptionDateInput,
  setExceptionReasonInput,
  setShowPlanActionsModal,
  setIsSavingPlans,
}: UseApplyElCartelPresetParams) {
  const { confirm: confirmDialog } = useConfirmDialog();

  const handleApplyElCartelPreset = useCallback(async () => {
    if (!selectedClass) return;
    confirmDialog({
      title: normalizeText("Aplicar preset ElCartel?"),
      message: normalizeText(
        "Isto vai substituir o ciclo atual por 18 semanas no modelo 2x/semana e configurar perfil competitivo com feriados de 21/04 e 04/06."
      ),
      confirmLabel: normalizeText("Aplicar preset"),
      cancelLabel: normalizeText("Cancelar"),
      tone: "default",
      onConfirm: async () => {
        setIsSavingPlans(true);
        try {
          const plans = buildElCartelClassPlans({
            classId: selectedClass.id,
            gender: selectedClass.gender,
          });
          await measure("deleteClassPlansByClass", () =>
            deleteClassPlansByClass(selectedClass.id)
          );
          await measure("saveClassPlans", () => saveClassPlans(plans));

          const profile = buildElCartelCompetitiveProfile({
            classId: selectedClass.id,
            organizationId: selectedClass.organizationId,
          });
          await saveClassCompetitiveProfile(profile);

          const existingExceptions = await getClassCalendarExceptions(selectedClass.id, {
            organizationId: selectedClass.organizationId,
          });
          await Promise.all(
            existingExceptions.map((item) => deleteClassCalendarException(item.id))
          );
          const exceptions = buildElCartelCalendarExceptions({
            classId: selectedClass.id,
            organizationId: selectedClass.organizationId,
          });
          await Promise.all(exceptions.map((item) => saveClassCalendarException(item)));

          setClassPlans(plans);
          setCycleLength(18);
          setSessionsPerWeek(2);
          setCompetitiveProfile(profile);
          setCalendarExceptions(exceptions);
          setExceptionDateInput("");
          setExceptionReasonInput("");
          setShowPlanActionsModal(false);

          Alert.alert(
            normalizeText("Periodização"),
            normalizeText("Preset ElCartel aplicado com sucesso para a turma.")
          );
        } catch (error) {
          Alert.alert(
            normalizeText("Periodização"),
            error instanceof Error
              ? error.message
              : normalizeText("Falha ao aplicar preset ElCartel.")
          );
        } finally {
          setIsSavingPlans(false);
        }
      },
    });
  }, [
    confirmDialog,
    normalizeText,
    selectedClass,
    setClassPlans,
    setCycleLength,
    setSessionsPerWeek,
    setCompetitiveProfile,
    setCalendarExceptions,
    setExceptionDateInput,
    setExceptionReasonInput,
    setShowPlanActionsModal,
    setIsSavingPlans,
  ]);

  return { handleApplyElCartelPreset };
}
