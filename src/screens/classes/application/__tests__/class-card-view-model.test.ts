import type { ClassGroup, Student } from "../../../../core/models";
import { buildClassCardViewModel, groupStudentsByClassId } from "../class-card-view-model";

const buildClass = (overrides: Partial<ClassGroup> = {}): ClassGroup =>
  ({
    id: "c_1",
    name: "Turma 8-11",
    unit: "Rede Esperança",
    ageBand: "08-11",
    gender: "misto",
    goal: "Fundamentos",
    modality: "voleibol",
    startTime: "14:00",
    durationMinutes: 60,
    daysOfWeek: [2, 4],
    ...overrides,
  }) as ClassGroup;

const buildStudent = (id: string, name: string, classId = "c_1", photoUrl?: string): Student =>
  ({
    id,
    name,
    classId,
    organizationId: "org_1",
    age: 10,
    phone: "",
    loginEmail: "",
    guardianName: "",
    guardianPhone: "",
    guardianRelation: "",
    birthDate: "",
    photoUrl,
  }) as Student;

describe("class card view model", () => {
  it("uses real students for count, stack and extra count", () => {
    const students = [
      buildStudent("s_1", "Ana Costa"),
      buildStudent("s_2", "Bruno Lima", "c_1", "https://example.com/bruno.jpg"),
      buildStudent("s_3", "Caio Alves"),
      buildStudent("s_4", "Duda Reis"),
      buildStudent("s_5", "Eva Rocha"),
    ];

    const viewModel = buildClassCardViewModel({
      classGroup: buildClass(),
      students,
      teacher: { name: "Gustavo Ribeiro", photoUrl: null },
    });

    expect(viewModel.studentCount).toBe(5);
    expect(viewModel.visibleStudents).toHaveLength(4);
    expect(viewModel.extraStudentCount).toBe(1);
    expect(viewModel.visibleStudents[1].photoUrl).toBe("https://example.com/bruno.jpg");
  });

  it("does not invent student count when the class has no roster data", () => {
    const viewModel = buildClassCardViewModel({
      classGroup: buildClass(),
      students: [],
      teacher: null,
    });

    expect(viewModel.studentCount).toBe(0);
    expect(viewModel.developmentLevelLabel).toBe("Iniciação");
    expect(viewModel.visibleStudents).toEqual([]);
    expect(viewModel.extraStudentCount).toBe(0);
    expect(viewModel.teacher).toMatchObject({
      name: "Professor não definido",
      initials: "PD",
      isFallback: true,
    });
  });

  it("shows the canonical development level instead of the class goal", () => {
    const viewModel = buildClassCardViewModel({
      classGroup: buildClass({ mvLevel: "MV3", goal: "Fundamentos" }),
    });

    expect(viewModel.developmentLevelLabel).toBe("Rendimento");
  });

  it("groups students by class id", () => {
    const grouped = groupStudentsByClassId([
      buildStudent("s_1", "Ana", "c_1"),
      buildStudent("s_2", "Bia", "c_2"),
      buildStudent("s_3", "Caio", "c_1"),
    ]);

    expect(grouped.c_1.map((student) => student.id)).toEqual(["s_1", "s_3"]);
    expect(grouped.c_2.map((student) => student.id)).toEqual(["s_2"]);
  });
});
