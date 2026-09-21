/* eslint-disable @typescript-eslint/no-require-imports */
import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";
import Recorder from "../LessonVoiceRecorder";
import { useAudioRecorderState } from "expo-audio";
import { checkLessonAudioAvailability, transcribeLessonAudio } from "../../../../api/lesson-audio";
const mockRecorder = { stop: jest.fn().mockResolvedValue(undefined), prepareToRecordAsync: jest.fn(), record: jest.fn(), uri: null, getStatus: () => ({ metering: -15 }) };
jest.mock("expo-audio", () => ({ RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorder: () => mockRecorder, useAudioRecorderState: jest.fn(), requestRecordingPermissionsAsync: jest.fn(), setAudioModeAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../../../api/lesson-audio", () => ({ checkLessonAudioAvailability: jest.fn(), transcribeLessonAudio: jest.fn() }));
jest.mock("../../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {} }) }));
jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../../ui/Pressable", () => ({ Pressable: require("react-native").Pressable }));
beforeEach(() => { jest.clearAllMocks(); (useAudioRecorderState as jest.Mock).mockReturnValue({ isRecording: false, durationMillis: 0 }); });
test("unavailable backend shows its cause and does not start recording", async () => {
  (checkLessonAudioAvailability as jest.Mock).mockRejectedValue(new Error("A transcrição ainda não está disponível no servidor."));
  const screen = render(React.createElement(Recorder, { organizationId: "o", classId: "c", disabled: false, onText: jest.fn() }));
  await act(async () => { fireEvent.press(screen.getByLabelText("Gravar mensagem de voz")); });
  expect(screen.getByRole("alert").props.children).toContain("não está disponível no servidor");
  expect(mockRecorder.record).not.toHaveBeenCalled();
});
test("recording displays waves and elapsed time; cancelling never transcribes", async () => {
  (useAudioRecorderState as jest.Mock).mockReturnValue({ isRecording: true, durationMillis: 5000 });
  const screen = render(React.createElement(Recorder, { organizationId: "o", classId: "c", disabled: false, onText: jest.fn() }));
  expect(screen.getByLabelText("Gravação em andamento")).toBeTruthy();
  expect(screen.getByText("0:05")).toBeTruthy();
  await act(async () => { fireEvent.press(screen.getByLabelText("Cancelar gravação")); });
  expect(mockRecorder.stop).toHaveBeenCalled();
  expect(transcribeLessonAudio).not.toHaveBeenCalled();
  screen.unmount();
});

test("does not stop a long recording without the professor action", () => {
  (useAudioRecorderState as jest.Mock).mockReturnValue({ isRecording: true, durationMillis: 120_000 });
  const screen = render(React.createElement(Recorder, { organizationId: "o", classId: "c", disabled: false, onText: jest.fn() }));
  expect(screen.getByText("2:00")).toBeTruthy();
  expect(mockRecorder.stop).not.toHaveBeenCalled();
  screen.unmount();
});
