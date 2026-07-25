type PendingWrite = {
  id: string;
  kind:
    | "session_log"
    | "attendance_records"
    | "scouting_log"
    | "student_scouting_log"
    | "nfc_checkin";
  payload: unknown;
  createdAt: string;
};

export const enqueueWrite = async (write: PendingWrite) => {
  const { enqueueWrite: enqueueWriteFromNfcSync } = await import("./nfc-sync");
  await enqueueWriteFromNfcSync(write);
};

