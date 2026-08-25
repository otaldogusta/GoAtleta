import { useCallback, useEffect, useRef, useState } from "react";

import type { Student } from "../../core/models";
import { createBinding, deleteBinding, getBinding, getStudentBinding } from "../../data/nfc-tag-bindings";
import { isNfcSupported } from "../../nfc/nfc";
import { NFC_ERRORS } from "../../nfc/nfc-errors";
import { useNfcScanner } from "../../nfc/nfc-hooks";
import { getFriendlyErrorMessage } from "../../ui/error-messages";
import { useSaveToast } from "../../ui/save-toast";

type UseStudentNfcBindingOptions = {
  organizationId?: string | null;
  userId?: string | null;
  canManage: boolean;
};

export function useStudentNfcBinding({ organizationId, userId, canManage }: UseStudentNfcBindingOptions) {
  const { showSaveToast } = useSaveToast();
  const { scanOnce, cancelScan } = useNfcScanner();
  const [scanningStudentId, setScanningStudentId] = useState<string | null>(null);
  const bindingInProgress = useRef(false);

  useEffect(() => () => {
    void cancelScan();
  }, [cancelScan]);

  const bindStudentTag = useCallback(async (student: Student) => {
    if (!canManage || bindingInProgress.current) return;
    if (!organizationId || !userId) {
      showSaveToast({ message: "Organização ou sessão indisponível.", variant: "error" });
      return;
    }

    bindingInProgress.current = true;
    setScanningStudentId(student.id);
    try {
      const support = await isNfcSupported();
      if (!support.available || !support.enabled) {
        throw new Error(support.reason || "NFC indisponível neste aparelho.");
      }

      const result = await scanOnce();
      if (!result) return;

      const bindingForTag = await getBinding(organizationId, result.uid);
      if (bindingForTag?.studentId === student.id) {
        showSaveToast({ message: `Tag NFC já vinculada a ${student.name}.`, variant: "success" });
        return;
      }
      if (bindingForTag) {
        throw new Error("Esta tag NFC já está vinculada a outro aluno.");
      }

      const currentStudentBinding = await getStudentBinding(organizationId, student.id);
      if (currentStudentBinding) {
        await deleteBinding({ organizationId, bindingId: currentStudentBinding.id });
      }

      await createBinding({
        organizationId,
        tagUid: result.uid,
        studentId: student.id,
        createdBy: userId,
      });
      showSaveToast({ message: `Tag NFC vinculada a ${student.name}.`, variant: "success" });
    } catch (error) {
      if ((error as { code?: string } | null)?.code === NFC_ERRORS.CANCELLED) return;
      showSaveToast({ message: getFriendlyErrorMessage(error, "Não foi possível vincular a tag NFC."), variant: "error" });
    } finally {
      bindingInProgress.current = false;
      setScanningStudentId(null);
    }
  }, [canManage, organizationId, scanOnce, showSaveToast, userId]);

  return {
    bindStudentTag,
    scanningStudentId,
  };
}
