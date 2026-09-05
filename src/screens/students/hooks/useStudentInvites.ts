import { useCallback } from "react";
import { Alert } from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  createStudentInvite,
  revokeStudentAccess,
  revokeStudentInvite,
} from "../../../api/student-invite";
import type { ClassGroup, Student } from "../../../core/models";
import type { WhatsAppTemplateId } from "../../../utils/whatsapp-templates";
import { WHATSAPP_TEMPLATES } from "../../../utils/whatsapp-templates";
import { useSaveToast } from "../../../ui/save-toast";
import {
  buildStudentInviteLink,
  getStudentInviteActionErrorMessage,
} from "../application/student-invite-sharing";

export type UseStudentInvitesParams = {
  classes: ClassGroup[];
  studentInviteBusy: boolean;
  pendingStudentInviteBusyId: string | null;
  buildStudentMessage: (
    student: Student,
    cls: ClassGroup | null,
    templateId: WhatsAppTemplateId,
    fields: Record<string, string>
  ) => string;
  showWhatsAppNotice: (message: string) => void;
  reload: () => Promise<void>;
  // setters
  setStudentInviteBusy: (value: boolean) => void;
  setSelectedTemplateId: (value: WhatsAppTemplateId | null) => void;
  setSelectedTemplateLabel: (value: string | null) => void;
  setCustomFields: (value: Record<string, string>) => void;
  setCustomStudentMessage: (value: string) => void;
  setPendingStudentInviteBusyId: (value: string | null) => void;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useStudentInvites({
  classes,
  studentInviteBusy,
  pendingStudentInviteBusyId,
  buildStudentMessage,
  showWhatsAppNotice,
  reload,
  setStudentInviteBusy,
  setSelectedTemplateId,
  setSelectedTemplateLabel,
  setCustomFields,
  setCustomStudentMessage,
  setPendingStudentInviteBusyId,
}: UseStudentInvitesParams) {
  const { showSaveToast } = useSaveToast();
  const applyStudentInviteTemplate = useCallback(
    async (
      student: Student,
      cls: ClassGroup | null,
      invitedTo: string,
      options: { revokeFirst: boolean; copyLink: boolean }
    ): Promise<string | null> => {
      if (studentInviteBusy) return null;
      setStudentInviteBusy(true);
      setSelectedTemplateId("student_invite");
      setSelectedTemplateLabel(WHATSAPP_TEMPLATES.student_invite.title);
      setCustomFields({});
      setCustomStudentMessage("Gerando convite...");
      const createInvite = async () => {
        const response = await createStudentInvite(student.id, {
          invitedVia: "whatsapp",
          invitedTo: invitedTo.trim() ? invitedTo : "",
        });
        if (!response.token) {
          throw new Error("Convite inválido.");
        }
        const link = buildStudentInviteLink(response.token);
        const fields: Record<string, string> = { inviteLink: link };
        setCustomFields(fields);
        const message = buildStudentMessage(student, cls, "student_invite", fields);
        setCustomStudentMessage(message);
        if (options.copyLink) {
          await Clipboard.setStringAsync(link);
          showWhatsAppNotice("Link copiado.");
        }
        return message;
      };
      try {
        if (options.revokeFirst) {
          await revokeStudentAccess(student.id, { clearLoginEmail: true });
        }
        const attempts = options.revokeFirst ? 2 : 1;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            const message = await createInvite();
            await reload();
            return message;
          } catch (error) {
            if (attempt + 1 < attempts) {
              await wait(400);
              continue;
            }
            throw error;
          }
        }
        return null;
      } catch (error) {
        const message = getStudentInviteActionErrorMessage(error);
        Alert.alert("Convite", message);
        setCustomStudentMessage(message);
        return null;
      } finally {
        setStudentInviteBusy(false);
      }
    },
    [buildStudentMessage, reload, showWhatsAppNotice, studentInviteBusy,
      setStudentInviteBusy, setSelectedTemplateId, setSelectedTemplateLabel,
      setCustomFields, setCustomStudentMessage]
  );

  const onGenerateInviteFromList = useCallback(
    async (student: Student) => {
      const cls = classes.find((entry) => entry.id === student.classId) ?? null;
      const generated = await applyStudentInviteTemplate(student, cls, "", {
        revokeFirst: false,
        copyLink: true,
      });
      if (!generated) return;
      showSaveToast({
        message: "Link de convite gerado e copiado para a área de transferência.",
        variant: "success",
      });
    },
    [applyStudentInviteTemplate, classes, showSaveToast]
  );

  const onCancelPendingStudentInvite = useCallback(
    async (inviteId: string) => {
      if (pendingStudentInviteBusyId) return;
      setPendingStudentInviteBusyId(inviteId);
      try {
        await revokeStudentInvite(inviteId);
        await reload();
      } catch (error) {
        Alert.alert("Convite", getStudentInviteActionErrorMessage(error));
      } finally {
        setPendingStudentInviteBusyId(null);
      }
    },
    [pendingStudentInviteBusyId, reload, setPendingStudentInviteBusyId]
  );

  return { applyStudentInviteTemplate, onGenerateInviteFromList, onCancelPendingStudentInvite };
}
