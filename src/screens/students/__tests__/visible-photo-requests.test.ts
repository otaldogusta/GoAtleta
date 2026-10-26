import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { FlatList } from "react-native";

import type { ClassGroup, Student } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { ClassesListSection } from "../../classes/components/ClassesListSection";
import { StudentsListTab, type StudentsListTabProps } from "../StudentsListTab";

jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: new Proxy({}, { get: () => "#334455" }) }) }));
jest.mock("../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../ui/use-container-responsive-layout", () => ({
  useContainerResponsiveLayout: () => ({ containerRef: { current: null }, onLayout: () => undefined, width: 900 }),
}));
jest.mock("../../../ui/use-collapsible", () => ({
  useCollapsibleAnimation: () => ({ animatedStyle: {}, isVisible: false }),
}));
jest.mock("../../../ui/ModalSheet", () => ({ ModalSheet: () => null }));
jest.mock("../../../ui/AnchoredDropdown", () => ({ AnchoredDropdown: () => null }));
jest.mock("../../../observability/perf", () => ({ markRender: () => undefined }));
jest.mock("../../../api/student-relationship-invite", () => ({ listStudentFamilyAccessSummaries: async () => [] }));
jest.mock("../components/StudentFamilyAccessPanels", () => ({ StudentFamilyAccessPanels: () => null }));
jest.mock("../../classes/components/ClassCard", () => ({ ClassCard: () => null }));

const students = Array.from({ length: 5000 }, (_, id) => ({
  id: `student-${id}`, name: `Atleta ${String(id).padStart(4, "0")}`, classId: "class-a", birthDate: "2010-01-01",
  membershipStatus: "active", photoUrl: `https://example.com/${id}.jpg`,
} as Student));
const classes = Array.from({ length: 100 }, (_, id) => ({
  id: `class-${id}`, name: `Turma ${id}`, unit: "Unidade", daysOfWeek: [1], startTime: "12:00", ageBand: "12-14", gender: "misto",
} as ClassGroup));

test("the actual athlete pagination requests only the page, then updates on page/filter changes and clears on unmount", async () => {
  const requested = jest.fn();
  const props: StudentsListTabProps = {
    studentsUnitOptions: ["Todas"], studentsUnitFilter: "Todas", setStudentsUnitFilter: jest.fn(),
    studentsSearch: "", setStudentsSearch: jest.fn(), students, studentsFiltered: students, studentsGrouped: [],
    classById: new Map(), unitLabel: value => value, expandedUnits: {}, expandedClasses: {},
    toggleUnitExpanded: jest.fn(), toggleClassExpanded: jest.fn(), renderStudentItem: () => null,
    onVisiblePhotoStudentsChange: requested,
  };
  const view = render(React.createElement(StudentsListTab, props));
  await act(async () => undefined);
  const first: string[] = requested.mock.calls.at(-1)![0];
  expect(first.length).toBeGreaterThanOrEqual(8);
  expect(first.length).toBeLessThanOrEqual(20);
  expect(first[0]).toBe("student-0");
  fireEvent.press(view.getByText("2", { exact: true }));
  await act(async () => undefined);
  const second: string[] = requested.mock.calls.at(-1)![0];
  expect(second[0]).toBe(`student-${first.length}`);
  expect(second).toHaveLength(first.length);
  view.rerender(React.createElement(StudentsListTab, { ...props, studentsSearch: "4500", studentsFiltered: [students[4500]] }));
  await act(async () => undefined);
  expect(requested.mock.calls.at(-1)![0]).toEqual(["student-4500"]);
  view.unmount();
  expect(requested.mock.calls.at(-1)![0]).toEqual([]);
}, 30_000);

test("the actual class FlatList requests only viewable cards and clears them when the list leaves", async () => {
  const requested = jest.fn();
  const view = render(React.createElement(ClassesListSection, {
    grouped: [["Unidade", classes]], conflictsById: {}, dayNames: [], colors: new Proxy({}, { get: () => "#334455" }) as ThemeColors,
    onOpenClass: jest.fn(), onEditClass: jest.fn(), onDeleteClass: jest.fn(), classCardViewModelsById: {},
    onVisiblePhotoClassesChange: requested,
  }));
  expect(requested.mock.calls.at(-1)![0]).toEqual([]);
  act(() => view.UNSAFE_getByType(FlatList).props.onViewableItemsChanged({ viewableItems: [
    { item: classes[1], isViewable: true, key: classes[1].id, index: 1 },
    { item: classes[2], isViewable: true, key: classes[2].id, index: 2 },
    { item: classes[3], isViewable: false, key: classes[3].id, index: 3 },
  ] }));
  expect(requested.mock.calls.at(-1)![0]).toEqual(["class-1", "class-2"]);
  act(() => view.UNSAFE_getByType(FlatList).props.onViewableItemsChanged({ viewableItems: [
    { item: classes[15], isViewable: true, key: classes[15].id, index: 15 },
  ] }));
  expect(requested.mock.calls.at(-1)![0]).toEqual(["class-15"]);
  view.unmount();
  expect(requested.mock.calls.at(-1)![0]).toEqual([]);
});
