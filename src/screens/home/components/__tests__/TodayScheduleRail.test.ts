import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { FlatList, View } from "react-native";

import { TodayScheduleRail } from "../TodayScheduleRail";

jest.mock("../../../../ui/app-theme", () => ({
  useAppTheme: () => ({
    colors: {
      surface: "#111827",
      borderSubtle: "#334155",
      textPrimary: "#f8fafc",
      textMuted: "#94a3b8",
    },
  }),
}));

jest.mock("../../../../ui/icon-registry", () => ({
  GoAtletaIcon: () => null,
}));

describe("TodayScheduleRail", () => {
  it("keeps a fixed rail height and scrolls only the lesson list", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        React.createElement(TodayScheduleRail, {
          title: "Aulas de terça-feira",
          subtitle: "21/07",
          height: 640,
          slots: [
            {
              key: "14:00",
              timeLabel: "14:00 - 15:00",
              startTime: 1,
              endTime: 2,
              items: [
                {
                  classId: "class-1",
                  className: "Primeiros Saques",
                  unit: "Rede Esperança",
                  gender: null,
                  dateKey: "2026-07-21",
                  dateLabel: "21/07",
                  startTime: 1,
                  endTime: 2,
                  timeLabel: "14:00 - 15:00",
                },
              ],
            },
          ],
          totalDurationMinutes: 60,
          onOpenLesson: jest.fn(),
          onOpenAttendance: jest.fn(),
        })
      );
    });

    const rootPanel = renderer!.root.findAllByType(View)[0];
    const lessonList = renderer!.root.findByType(FlatList);

    expect(rootPanel.props.style).toEqual(expect.objectContaining({
      height: 640,
      maxHeight: 640,
      minHeight: 0,
    }));
    expect(lessonList.props.style).toEqual({ flex: 1, minHeight: 0 });
    expect(lessonList.props.scrollEnabled).toBe(true);
    expect(lessonList.props.nestedScrollEnabled).toBe(true);
    expect(lessonList.props.showsVerticalScrollIndicator).toBe(true);

    act(() => {
      renderer!.unmount();
    });
  });
});
