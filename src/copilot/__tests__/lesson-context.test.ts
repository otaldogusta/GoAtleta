import { createElement, useEffect, useState, type PropsWithChildren } from "react";
import { renderHook } from "@testing-library/react-native";
import { CopilotLessonContext, useCopilotLesson, type RegisteredCopilotLesson } from "../lesson-context";
let mockOrganization = { id: "org", role_level: 10 };
jest.mock("../../auth/auth", () => ({ useAuth: () => ({ session: { user: { id: "teacher" } } }) }));
jest.mock("../../providers/organization-context", () => ({ useOrganization: () => ({ activeOrganization: mockOrganization, isLoading: false }) }));
const scope = { classId: "class", organizationId: "org", date: "2026-09-08", sport: "volleyball", className: "Fixture", currentPlanId: null, onApplied: jest.fn() };
let registered: RegisteredCopilotLesson | null = null;
function Wrapper({ children }: PropsWithChildren) {
  const [value, setValue] = useState<RegisteredCopilotLesson | null>(null);
  useEffect(() => { registered = value; }, [value]);
  return createElement(CopilotLessonContext.Provider, { value: setValue }, children);
}
beforeEach(() => { mockOrganization = { id: "org", role_level: 10 }; registered = null; });
test("teacher registers selected lesson and leaving the screen clears it", () => {
  const { rerender } = renderHook(({ current }) => useCopilotLesson(current), { wrapper: Wrapper, initialProps: { current: scope as typeof scope | null } });
  expect(registered).toMatchObject({ userId: "teacher", scope: { classId: "class", date: "2026-09-08" } });
  rerender({ current: null });
  expect(registered).toBeNull();
});
test("changing workspace removes the former lesson from the chatbot", () => {
  const { rerender } = renderHook(() => useCopilotLesson(scope), { wrapper: Wrapper });
  mockOrganization = { id: "other", role_level: 50 };
  rerender({});
  expect(registered).toBeNull();
});
test("member access does not register lesson editing", () => {
  mockOrganization = { id: "org", role_level: 5 };
  renderHook(() => useCopilotLesson(scope), { wrapper: Wrapper });
  expect(registered).toBeNull();
});
