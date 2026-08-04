const ISO_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

export const isStudentBirthdayToday = (
  birthDate: string | null | undefined,
  referenceDate: Date = new Date(),
) => {
  const match = String(birthDate ?? "")
    .trim()
    .match(ISO_DATE_PREFIX);
  if (!match || Number.isNaN(referenceDate.getTime())) return false;

  const month = Number(match[2]);
  const day = Number(match[3]);

  return (
    month === referenceDate.getMonth() + 1 && day === referenceDate.getDate()
  );
};
