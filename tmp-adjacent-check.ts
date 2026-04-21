const classId = "c_1767111579656";
const referenceDate = "2026-04-17";

(async () => {
  try {
    const { getClassById } = await import("./src/db/classes");
    const { calculateAdjacentClassDate } = await import("./src/utils/whatsapp-templates");

    try {
      const cls = await getClassById(classId);
      console.log(`daysOfWeek=${JSON.stringify(cls?.daysOfWeek ?? null)}`);
      const adjacent = calculateAdjacentClassDate(cls as any, referenceDate);
      console.log(`previous=${adjacent?.previous ?? null}`);
      console.log(`next=${adjacent?.next ?? null}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`error=${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`error=${message}`);
  }
})();
