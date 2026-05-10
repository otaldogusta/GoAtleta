import { Linking } from "react-native";

import {
  getMockMediaMessage,
  isHttpMediaUri,
  isMockMediaUri,
  openExerciseMediaUri,
} from "../open-exercise-media-uri";

describe("openExerciseMediaUri", () => {
  const canOpenUrlMock = jest.spyOn(Linking, "canOpenURL");
  const openUrlMock = jest.spyOn(Linking, "openURL");

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("does not call Linking.openURL for mock://", async () => {
    const result = await openExerciseMediaUri("mock://higgsfield/exercise_video/stiff");

    expect(result).toEqual({ ok: false, reason: "mock_uri" });
    expect(canOpenUrlMock).not.toHaveBeenCalled();
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it("calls Linking.openURL for https://", async () => {
    canOpenUrlMock.mockResolvedValue(true);
    openUrlMock.mockResolvedValue();

    const result = await openExerciseMediaUri("https://example.com/demo.mp4");

    expect(result).toEqual({ ok: true });
    expect(canOpenUrlMock).toHaveBeenCalledWith("https://example.com/demo.mp4");
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/demo.mp4");
  });

  it("normalizes missing protocol with https://", async () => {
    canOpenUrlMock.mockResolvedValue(true);
    openUrlMock.mockResolvedValue();

    const result = await openExerciseMediaUri("example.com/demo.mp4");

    expect(result).toEqual({ ok: true });
    expect(canOpenUrlMock).toHaveBeenCalledWith("https://example.com/demo.mp4");
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/demo.mp4");
  });

  it("returns error for empty uri", async () => {
    const result = await openExerciseMediaUri("   ");

    expect(result).toEqual({ ok: false, reason: "empty_uri" });
  });

  it("returns open_failed when Linking fails", async () => {
    canOpenUrlMock.mockRejectedValue(new Error("fail"));

    const result = await openExerciseMediaUri("https://example.com/demo.mp4");

    expect(result).toEqual({ ok: false, reason: "open_failed" });
  });
});

describe("media uri helpers", () => {
  it("detects mock and http URIs", () => {
    expect(isMockMediaUri("mock://demo")).toBe(true);
    expect(isHttpMediaUri("https://demo")).toBe(true);
    expect(isHttpMediaUri("demo")).toBe(false);
  });

  it("builds a mock media message", () => {
    expect(getMockMediaMessage("mock://demo")).toContain("provider mockado");
  });
});
