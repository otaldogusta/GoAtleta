import { familyCandidateSchedule } from "../family-candidate-schedule";

test("shows stored weekdays and time compactly", () => {
  expect(familyCandidateSchedule({ class_name: "Vôlei", class_days: [3, 1, 1], class_start_time: "14:00" })).toBe("Vôlei · seg e qua, 14h");
  expect(familyCandidateSchedule({ class_name: "Vôlei", class_days: [5], class_start_time: "14:30:00" })).toBe("Vôlei · sex, 14h30");
});
test("does not invent missing or invalid schedules", () => {
  expect(familyCandidateSchedule({ class_name: "Sem turma" })).toBe("Sem turma");
  expect(familyCandidateSchedule({ class_name: "Vôlei", class_days: [9], class_start_time: "25:90" })).toBe("Vôlei");
});
