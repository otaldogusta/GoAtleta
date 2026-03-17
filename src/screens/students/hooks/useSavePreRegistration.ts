import { useCallback } from "react";
import type { StudentPreRegistration } from "../../../core/models";
import {
    saveStudentPreRegistration,
    updateStudentPreRegistration,
} from "../../../db/seed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Params = {
    activeOrganizationId: string | undefined;
    editingPreId: string | null;
    preChildName: string;
    preGuardianName: string;
    preGuardianPhone: string;
    preClassInterest: string;
    preUnitInterest: string;
    preTrialDate: string;
    preStatus: StudentPreRegistration["status"];
    preNotes: string;
    setPreRegistrationError: (v: string) => void;
    resetPreRegistrationForm: () => void;
    reload: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSavePreRegistration(params: Params) {
    const {
        activeOrganizationId,
        editingPreId,
        preChildName,
        preGuardianName,
        preGuardianPhone,
        preClassInterest,
        preUnitInterest,
        preTrialDate,
        preStatus,
        preNotes,
        setPreRegistrationError,
        resetPreRegistrationForm,
        reload,
    } = params;

    const savePreRegistration = useCallback(async () => {
        const organizationId = activeOrganizationId ?? "";
        if (!organizationId) {
            setPreRegistrationError("Selecione uma organização ativa.");
            return;
        }
        if (!preChildName.trim() || !preGuardianName.trim() || !preGuardianPhone.trim()) {
            setPreRegistrationError("Preencha nome da criança, responsável e telefone.");
            return;
        }
        setPreRegistrationError("");
        const payload: Omit<StudentPreRegistration, "createdAt" | "updatedAt"> = {
            id: editingPreId ?? `pr_${Date.now()}`,
            organizationId,
            childName: preChildName.trim(),
            guardianName: preGuardianName.trim(),
            guardianPhone: preGuardianPhone.trim(),
            ageOrBirth: null,
            classInterest: preClassInterest.trim() || null,
            unitInterest: preUnitInterest.trim() || null,
            trialDate: preTrialDate.trim() || null,
            status: preStatus,
            notes: preNotes.trim() || null,
            convertedStudentId: null,
        };

        if (editingPreId) {
            await updateStudentPreRegistration(payload);
        } else {
            await saveStudentPreRegistration(payload);
        }
        resetPreRegistrationForm();
        await reload();
    }, [
        activeOrganizationId,
        editingPreId,
        preChildName,
        preClassInterest,
        preGuardianName,
        preGuardianPhone,
        preNotes,
        preStatus,
        preTrialDate,
        preUnitInterest,
        reload,
        resetPreRegistrationForm,
        setPreRegistrationError,
    ]);

    return { savePreRegistration };
}
