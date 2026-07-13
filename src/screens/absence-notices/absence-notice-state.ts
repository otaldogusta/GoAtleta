import type { AbsenceNotice } from "../../core/models";

export const canActOnAbsenceNotice = (
  notice: Pick<AbsenceNotice, "status"> | null | undefined
) => notice?.status === "pending";
