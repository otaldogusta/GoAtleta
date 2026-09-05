import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { getStudentProfilePhoto } from "../../api/student-self-photo";
import { getStudentPhotoAccessUrl } from "../../api/student-photo-storage";
import type { Student } from "../../core/models";
import { useStudentProfilePhoto } from "../use-student-profile-photo";

jest.mock("expo-router", () => ({ useFocusEffect: (callback: () => void) => require("react").useEffect(callback, [callback]) }));
jest.mock("../../api/student-self-photo", () => ({ getStudentProfilePhoto: jest.fn() }));
jest.mock("../../api/student-photo-storage", () => ({ getStudentPhotoAccessUrl: jest.fn() }));

const student = { id: "student-1", organizationId: "org-1", photoUrl: "old" } as Student;
const load = jest.mocked(getStudentProfilePhoto);
const sign = jest.mocked(getStudentPhotoAccessUrl);

beforeEach(() => {
  jest.clearAllMocks();
  load.mockResolvedValue("current");
  sign.mockImplementation(async uri => uri ? `signed:${uri}` : null);
});

it("loads the coordinator's current photo and authorizes its private URL", async () => {
  const { result } = renderHook(() => useStudentProfilePhoto(student));
  await waitFor(() => expect(result.current).toBe("signed:current"));
  expect(load).toHaveBeenCalledWith("student-1", "org-1");
  expect(sign).toHaveBeenCalledWith("current");
});

it("updates after saving and handles removal", async () => {
  const { result, rerender } = renderHook(({ value }) => useStudentProfilePhoto(value), { initialProps: { value: student } });
  await waitFor(() => expect(result.current).toBe("signed:current"));
  load.mockResolvedValue(null);
  rerender({ value: { ...student, photoUrl: undefined } });
  await waitFor(() => expect(result.current).toBeNull());
});

it("does not display a previous student's photo after switching accounts", async () => {
  const { result, rerender } = renderHook(({ value }) => useStudentProfilePhoto(value), { initialProps: { value: student } });
  await waitFor(() => expect(result.current).toBe("signed:current"));
  let finish!: (value: string) => void;
  load.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  rerender({ value: { ...student, id: "student-2" } });
  expect(result.current).toBeNull();
  await act(async () => finish("second"));
  await waitFor(() => expect(result.current).toBe("signed:second"));
});

it("refreshes a coordinator change when the app returns to the foreground", async () => {
  let onChange!: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const subscription = jest.spyOn(AppState, "addEventListener").mockImplementation((_type, callback) => {
    onChange = callback;
    return { remove };
  });
  try {
    const { result, unmount } = renderHook(() => useStudentProfilePhoto(student));
    await waitFor(() => expect(result.current).toBe("signed:current"));
    load.mockResolvedValue("coordinator-new-photo");
    await act(async () => onChange("active"));
    await waitFor(() => expect(result.current).toBe("signed:coordinator-new-photo"));
    unmount();
    expect(remove).toHaveBeenCalled();
  } finally {
    subscription.mockRestore();
  }
});
