import { type Dispatch, type SetStateAction, useCallback } from "react";
import type { Student } from "../../../core/models";
import { deleteStudent } from "../../../db/seed";
import { logAction } from "../../../observability/breadcrumbs";
import { measure } from "../../../observability/perf";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConfirmFn = (options: {
  title: string;
  message: string;
  confirmLabel: string;
  undoMessage: string;
  onOptimistic: () => void;
  onConfirm: () => void | Promise<void>;
  onUndo: () => void | Promise<void>;
}) => void;

type Params = {
  confirm: ConfirmFn;
  editingId: string | null;
  students: Student[];
  setStudents: Dispatch<SetStateAction<Student[]>>;
  closeEditModal: () => void;
  reload: () => Promise<void>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDeleteStudent(params: Params) {
  const { confirm, editingId, students, setStudents, closeEditModal, reload } = params;

  const deleteEditingStudent = useCallback(() => {
    if (!editingId) return;
    const student = students.find((item) => item.id === editingId);
    if (!student) return;
    confirm({
      title: "Excluir aluno?",
      message: student.name
        ? `Tem certeza que deseja excluir ${student.name}?`
        : "Tem certeza que deseja excluir este aluno?",
      confirmLabel: "Excluir",
      undoMessage: "Aluno excluído. Deseja desfazer?",
      onOptimistic: () => {
        setStudents((prev) => prev.filter((item) => item.id !== student.id));
        closeEditModal();
      },
      onConfirm: async () => {
        await measure("deleteStudent", () => deleteStudent(student.id));
        await reload();
        logAction("Excluir aluno", {
          studentId: student.id,
          classId: student.classId,
        });
      },
      onUndo: async () => {
        await reload();
      },
    });
  }, [confirm, editingId, closeEditModal, logAction, reload, students]);

  return { deleteEditingStudent };
}
