import React from "react";
import { render, waitFor } from "@testing-library/react-native";

import StudentBadges from "../../../../app/student-badges";
import { getClasses, getStudentScoutingByRange } from "../../../db/seed";
import { getTechnicalPerformanceScore } from "../../../core/scouting";

jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("../../../auth/role", () => {
  const student = { id: "athlete", classId: "linked", organizationId: "org" };
  return { useRole: () => ({ student }) };
});
jest.mock("../../../db/seed", () => ({ getClasses: jest.fn(), getStudentScoutingByRange: jest.fn() }));
jest.mock("../../../observability/perf", () => ({ markRender: jest.fn(), measureAsync: (_name: string, run: () => Promise<unknown>) => run() }));
jest.mock("../../../core/scouting", () => ({
  ...jest.requireActual("../../../core/scouting"),
  getTechnicalPerformanceScore: jest.fn(),
}));
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { background: "#fff", card: "#fff", text: "#111", muted: "#666", border: "#ccc", primaryBg: "#080" } }) }));
jest.mock("../../../ui/use-responsive-layout", () => ({ useResponsiveLayout: () => ({ maxContentWidth: 960, gutter: 16, supportsSplitView: false, density: { cardPadding: 10, pageGap: 12 } }) }));
jest.mock("../../../components/ui/ScreenPageHeader", () => ({ ScreenPageHeader: () => null }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: jest.requireActual("react-native").View }));

beforeEach(() => {
  jest.clearAllMocks();
  (getClasses as jest.Mock).mockResolvedValue([{ id: "linked" }]);
  (getStudentScoutingByRange as jest.Mock).mockResolvedValue([]);
  (getTechnicalPerformanceScore as jest.Mock).mockReturnValue(50);
});

test("each achievement presents its label, criterion and current status once", async () => {
  const view = render(React.createElement(StudentBadges));
  await waitFor(() => expect(getStudentScoutingByRange).toHaveBeenCalled());
  for (const label of ["Iniciante", "Constante", "Foco", "Ace", "Elite", "Mestre"]) {
    expect(view.getAllByText(label)).toHaveLength(1);
  }
  for (const criterion of ["Primeiro scouting", "30 pts no mês", "50 pts no mês", "70 pts no mês", "90 pts no mês", "100 pts no mês"]) {
    expect(view.getAllByText(criterion)).toHaveLength(1);
  }
  expect(view.getAllByText("✓ Conquistado")).toHaveLength(3);
  expect(view.getByText("50 pts")).toBeTruthy();
  for (const threshold of ["70 pts", "90 pts", "100 pts"]) expect(view.getByText(threshold)).toBeTruthy();
});

test("an athlete without points keeps all six targets and no earned status", async () => {
  (getTechnicalPerformanceScore as jest.Mock).mockReturnValue(0);
  const view = render(React.createElement(StudentBadges));
  await waitFor(() => expect(getStudentScoutingByRange).toHaveBeenCalled());
  expect(view.queryByText("✓ Conquistado")).toBeNull();
  expect(view.getByText("0 pts")).toBeTruthy();
  for (const target of ["1 pts", "30 pts", "50 pts", "70 pts", "90 pts", "100 pts"]) expect(view.getByText(target)).toBeTruthy();
});
