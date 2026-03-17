import { useCallback } from "react";
import { Alert } from "react-native";
import { revealStudentCpf } from "../../../db/seed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Params = {
  canRevealCpf: boolean;
  cpfMaskedOriginal: string;
  cpfRevealUnavailable: boolean;
  cpfRevealedValue: string;
  editingId: string | null;
  isCpfVisible: boolean;
  setCpfDisplay: (v: string) => void;
  setCpfRevealedValue: (v: string) => void;
  setCpfRevealUnavailable: (v: boolean) => void;
  setIsCpfVisible: (v: boolean) => void;
  setRevealCpfBusy: (v: boolean) => void;
  setStudentDocumentsError: (
    patch:
      | { ra?: string; cpf?: string; rg?: string }
      | ((prev: { ra?: string; cpf?: string; rg?: string }) => { ra?: string; cpf?: string; rg?: string })
  ) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRevealCpf(params: Params) {
  const {
    canRevealCpf,
    cpfMaskedOriginal,
    cpfRevealUnavailable,
    cpfRevealedValue,
    editingId,
    isCpfVisible,
    setCpfDisplay,
    setCpfRevealedValue,
    setCpfRevealUnavailable,
    setIsCpfVisible,
    setRevealCpfBusy,
    setStudentDocumentsError,
  } = params;

  const handleRevealEditingCpf = useCallback(async () => {
    if (!editingId || !canRevealCpf) return;
    if (cpfRevealUnavailable) return;
    setStudentDocumentsError((prev) => ({ ...prev, cpf: undefined }));
    if (isCpfVisible) {
      setCpfDisplay(cpfMaskedOriginal);
      setIsCpfVisible(false);
      return;
    }
    if (cpfRevealedValue) {
      setCpfDisplay(cpfRevealedValue);
      setIsCpfVisible(true);
      return;
    }
    setRevealCpfBusy(true);
    try {
      const cpf = await revealStudentCpf(editingId, {
        reason: "edicao_aluno",
        legalBasis: "consentimento_app",
      });
      setCpfRevealedValue(cpf);
      setCpfDisplay(cpf);
      setIsCpfVisible(true);
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "Nao foi possivel revelar o CPF.";
      if (detail.toLowerCase().includes("indisponivel")) {
        setCpfRevealUnavailable(true);
      }
      setStudentDocumentsError((prev) => ({ ...prev, cpf: detail }));
      Alert.alert("CPF", detail);
    } finally {
      setRevealCpfBusy(false);
    }
  }, [
    canRevealCpf,
    cpfMaskedOriginal,
    cpfRevealUnavailable,
    cpfRevealedValue,
    editingId,
    isCpfVisible,
  ]);

  return { handleRevealEditingCpf };
}
