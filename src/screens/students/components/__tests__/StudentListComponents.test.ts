import type { ClassGroup, Student } from "../../../../core/models";
import type { StudentHealthAssessment } from "../../../../core/student-health";
import type { ThemeColors } from "../../../../ui/app-theme";
import {
  StudentClassDropdownListContent,
  StudentClassDropdownPanelContent,
} from "../StudentClassDropdownPanel";
import {
  StudentClassOptionContent,
  StudentSelectOptionContent,
} from "../StudentDropdownOptions";
import { StudentListRowContent } from "../StudentListRow";
import { StudentsOverviewCardContent } from "../StudentsOverviewCard";

const collectTextAndLabels = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectTextAndLabels(item));
  }
  if (typeof node === "object") {
    const maybeNode = node as {
      props?: {
        accessibilityLabel?: unknown;
        children?: unknown;
        placeholder?: unknown;
      };
    };
    return [
      typeof maybeNode.props?.accessibilityLabel === "string"
        ? maybeNode.props.accessibilityLabel
        : "",
      typeof maybeNode.props?.placeholder === "string" ? maybeNode.props.placeholder : "",
      ...collectTextAndLabels(maybeNode.props?.children),
    ].filter(Boolean);
  }
  return [];
};

const student = {
  id: "student_1",
  name: "Flávia Alves",
  classId: "class_1",
  birthDate: "1900-01-01",
  guardianName: "",
  guardianPhone: "",
  phone: "",
  loginEmail: "",
  ra: "",
  isExperimental: true,
} as Student;

const healthAssessment: StudentHealthAssessment = {
  level: "atencao",
  label: "Atenção",
  signals: ["health_issue"],
  summary: "Há informações de saúde registradas para acompanhamento.",
};

const classGroup = {
  id: "class_1",
  name: "Turma 10-12",
  organizationId: "org_1",
  unit: "Rede Esportes Pinhais",
  unitId: "unit_1",
  colorKey: "brown",
  modality: "voleibol",
  ageBand: "10-12",
  gender: "misto",
  startTime: "14:00",
  endTime: "15:00",
  durationMinutes: 60,
  daysOfWeek: [1, 3],
  daysPerWeek: 2,
  goal: "Fundamentos",
  equipment: "quadra",
  level: 1,
  mvLevel: "MV1",
  cycleStartDate: "2026-06-01",
  cycleLengthWeeks: 8,
  acwrLow: 0.8,
  acwrHigh: 1.3,
  createdAt: "2026-06-01T00:00:00.000Z",
} as ClassGroup;

const colors: ThemeColors = {
  backgroundSubtle: "#f8fafc",
  surface: "#fff",
  surfaceElevated: "#fff",
  textPrimary: "#111",
  textSecondary: "#333",
  textMuted: "#666",
  borderSubtle: "#ddd",
  borderStrong: "#aaa",
  primary: "#22c55e",
  primaryPressed: "#16a34a",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  background: "#fff",
  card: "#fff",
  border: "#ddd",
  text: "#111",
  muted: "#666",
  placeholder: "#999",
  inputBg: "#fff",
  inputText: "#111",
  primaryBg: "#111",
  primaryText: "#fff",
  primaryDisabledBg: "#bbb",
  secondaryBg: "#f4f4f4",
  secondaryText: "#111",
  dangerBg: "#fee2e2",
  dangerBorder: "#fecaca",
  dangerText: "#991b1b",
  thumbFallback: "#e5e7eb",
  successBg: "#dcfce7",
  successText: "#166534",
  successBorder: "#bbf7d0",
  warningBg: "#fef3c7",
  warningText: "#92400e",
  warningBorder: "#fde68a",
  dangerSolidBg: "#dc2626",
  dangerSolidText: "#fff",
  infoBg: "#dbeafe",
  infoText: "#1d4ed8",
};

describe("student list components", () => {
  it("renders the overview metrics", () => {
    const text = collectTextAndLabels(
      StudentsOverviewCardContent({
        colors,
        organizationName: "Rede Esportes Pinhais",
        activeStudentsCount: 134,
        pendingInvitesCount: 2,
        todayBirthdaysCount: 1,
      })
    ).join(" ");

    expect(text).toContain("Visão geral");
    expect(text).toContain("Rede Esportes Pinhais");
    expect(text).toContain("Alunos ativos");
    expect(text).toContain("134");
    expect(text).toContain("Convites pendentes");
    expect(text).toContain("2");
    expect(text).toContain("Aniversários hoje");
    expect(text).toContain("1");
  });

  it("renders student row labels without private glyph text", () => {
    const text = collectTextAndLabels(
      StudentListRowContent({
        colors,
        student,
        classPalette: { bg: "#123456", text: "#ffffff" },
        healthAssessment,
        hasBirthDateWarning: true,
        onPress: jest.fn(),
        onWhatsApp: jest.fn(),
        onInvite: jest.fn(),
        onPhotoPress: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Flávia Alves");
    expect(text).toContain("Data suspeita");
    expect(text).toContain("Experimental");
    expect(text).toContain("Atenção");
    expect(text).toContain("Gerar convite do aluno");
    expect(text).toContain("Abrir WhatsApp do aluno");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });

  it("renders generic dropdown options with active label", () => {
    const text = collectTextAndLabels(
      StudentSelectOptionContent({
        colors,
        label: "Aluno regular",
        value: "regular",
        active: true,
        isFirst: true,
        onSelect: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Aluno regular");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });

  it("renders class dropdown options with schedule and unit", () => {
    const text = collectTextAndLabels(
      StudentClassOptionContent({
        colors,
        item: classGroup,
        active: false,
        isFirst: false,
        onSelect: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("14:00 - 15:00 - Turma 10-12");
    expect(text).toContain("Rede Esportes Pinhais");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });

  it("renders class dropdown panel with class option", () => {
    const text = collectTextAndLabels(
      StudentClassDropdownPanelContent({
        colors,
        classOptions: [classGroup],
        filteredClassOptions: [classGroup],
        classModalities: ["voleibol"],
        selectedClassId: classGroup.id,
        modalityFilter: "all",
        onModalityFilterChange: jest.fn(),
        onSelectClass: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("14:00 - 15:00 - Turma 10-12");
    expect(text).toContain("Rede Esportes Pinhais");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });

  it("renders class dropdown panel empty state", () => {
    const text = collectTextAndLabels(
      StudentClassDropdownPanelContent({
        colors,
        classOptions: [],
        filteredClassOptions: [],
        classModalities: [],
        selectedClassId: "",
        modalityFilter: "all",
        onModalityFilterChange: jest.fn(),
        onSelectClass: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Nenhuma turma encontrada.");
  });

  it("renders shared class dropdown list with class option", () => {
    const text = collectTextAndLabels(
      StudentClassDropdownListContent({
        colors,
        classOptions: [classGroup],
        filteredClassOptions: [classGroup],
        selectedClassId: classGroup.id,
        onSelectClass: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("14:00 - 15:00 - Turma 10-12");
    expect(text).toContain("Rede Esportes Pinhais");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });

  it("renders shared class dropdown list empty state", () => {
    const text = collectTextAndLabels(
      StudentClassDropdownListContent({
        colors,
        classOptions: [],
        filteredClassOptions: [],
        selectedClassId: "",
        onSelectClass: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Nenhuma turma encontrada.");
  });

  it("renders shared class dropdown list filtered empty state", () => {
    const text = collectTextAndLabels(
      StudentClassDropdownListContent({
        colors,
        classOptions: [classGroup],
        filteredClassOptions: [],
        selectedClassId: "",
        onSelectClass: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Nenhuma turma dessa modalidade nesta unidade.");
  });
});
