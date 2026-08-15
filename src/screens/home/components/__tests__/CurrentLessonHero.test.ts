import React from "react";
import { render } from "@testing-library/react-native";

import { CurrentLessonHero } from "../CurrentLessonHero";
import type { HomeScheduleSlot } from "../homeScheduleTypes";

const colors = {
  surface: "#162238",
  borderSubtle: "#2A3951",
  successBg: "#1D4D45",
  successText: "#A7F3D0",
  textMuted: "#94A3B8",
  textPrimary: "#F8FAFC",
  success: "#41D984",
  primaryDisabledBg: "#334155",
};

jest.mock("../../../../ui/app-theme", () => ({
  useAppTheme: () => ({ colors }),
}));

jest.mock("../../../../ui/icon-registry", () => {
  const ReactModule = jest.requireActual<typeof React>("react");
  const { Text } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    GoAtletaIcon: ({ name, ...props }: { name: string }) =>
      ReactModule.createElement(Text, props, name),
  };
});

const slot: HomeScheduleSlot = {
  key: "2026-08-15-1",
  timeLabel: "09:00 - 10:00",
  startTime: new Date("2026-08-15T09:00:00").getTime(),
  endTime: new Date("2026-08-15T10:00:00").getTime(),
  items: [
    {
      classId: "class-1",
      className: "Estrelas do Saque",
      unit: "Rede Esportes Pinhais",
      gender: null,
      dateKey: "2026-08-15",
      dateLabel: "Sáb | 15/08",
      startTime: new Date("2026-08-15T09:00:00").getTime(),
      endTime: new Date("2026-08-15T10:00:00").getTime(),
      timeLabel: "09:00 - 10:00",
    },
  ],
};

describe("CurrentLessonHero", () => {
  it("keeps the carousel accessible without visual navigation controls", () => {
    const screen = render(
      React.createElement(CurrentLessonHero, {
        slot,
        selectedDateLabel: "Sábado, 15 de agosto",
        isToday: false,
        mobile: true,
        currentPosition: 0,
        totalSlots: 2,
        onOpenLesson: jest.fn(),
        onOpenAttendance: jest.fn(),
      })
    );

    const carousel = screen.getByLabelText("Aula 1 de 2. Arraste para navegar.");
    expect(carousel).toBeTruthy();
    expect(screen.queryByText("1/2")).toBeNull();
    expect(screen.queryByLabelText("Aula anterior")).toBeNull();
    expect(screen.queryByLabelText("Próxima aula")).toBeNull();
  });
});
