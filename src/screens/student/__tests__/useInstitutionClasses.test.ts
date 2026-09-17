import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getStudentClassIds } from "../../../db/students";
import { useInstitutionClasses } from "../useInstitutionClasses";
import type { ClassGroup } from "../../../core/models";

jest.mock("../../../db/students", () => ({ getStudentClassIds: jest.fn() }));

it("reconsulta vínculos no refresh e mantém o escopo da instituição", async () => {
  const fetchIds = getStudentClassIds as jest.Mock;
  fetchIds.mockResolvedValueOnce([]).mockResolvedValueOnce(["class-1", "other"]);
  const classes = [
    { id: "class-1", organizationId: "org-1", unit: "Unidade" },
    { id: "other", organizationId: "org-2", unit: "Outra" },
  ] as ClassGroup[];
  const { result } = renderHook(() => useInstitutionClasses("student-1", "org-1", classes));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.groups).toEqual([]);
  await act(async () => { await result.current.refresh(); });
  expect(result.current.groups[0].classes.map(item => item.id)).toEqual(["class-1"]);
  expect(fetchIds).toHaveBeenLastCalledWith("student-1", { organizationId: "org-1" });
});
