import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";

import type { ThemeColors } from "../../../../ui/app-theme";
import { WeekDaySelector } from "../WeekDaySelector";
import type { WeekDaySummary } from "../homeScheduleTypes";

const colors = {
  surface: "#162238", borderSubtle: "#2A3951", successBg: "#1D4D45",
  successText: "#A7F3D0", textMuted: "#94A3B8", textPrimary: "#F8FAFC",
  success: "#41D984", successBorder: "#41D984", primaryBg: "#41D984",
} as ThemeColors;

const days: WeekDaySummary[] = [
  {
    dateKey: "2026-11-14", weekdayLabel: "SÁB", dateLabel: "14/11",
    fullLabel: "sábado, 14 de novembro", lessonCount: 1, durationMinutes: 60, isToday: true,
  },
  {
    dateKey: "2026-11-15", weekdayLabel: "DOM", dateLabel: "15/11",
    fullLabel: "domingo, 15 de novembro", lessonCount: 0, durationMinutes: 0, isToday: false,
  },
];

afterEach(() => jest.restoreAllMocks());

test("names each day with its date and lesson count, and exposes the current native selection", () => {
  const onSelect = jest.fn();
  const props = { days, selectedDateKey: days[0].dateKey, colors, onSelect };
  const screen = render(React.createElement(WeekDaySelector, props));

  expect(screen.getByRole("button", { name: "sábado, 14 de novembro, 1 aula", selected: true })).toBeTruthy();
  const emptyDay = screen.getByRole("button", { name: "domingo, 15 de novembro, 0 aulas", selected: false });
  fireEvent.press(emptyDay);
  expect(onSelect).toHaveBeenCalledWith("2026-11-15");

  screen.rerender(React.createElement(WeekDaySelector, { ...props, selectedDateKey: days[1].dateKey }));
  expect(screen.getByRole("button", { name: "domingo, 15 de novembro, 0 aulas", selected: true })).toBeTruthy();
  expect(screen.getByRole("button", { name: "sábado, 14 de novembro, 1 aula", selected: false })).toBeTruthy();
});

test("uses the pressed state for web day buttons without adding tab or radio keyboard behavior", () => {
  jest.replaceProperty(Platform, "OS", "web");
  const screen = render(React.createElement(WeekDaySelector, {
    days, selectedDateKey: days[1].dateKey, colors, onSelect: jest.fn(),
  }));

  const selected = screen.getByRole("button", { name: "domingo, 15 de novembro, 0 aulas" });
  const other = screen.getByRole("button", { name: "sábado, 14 de novembro, 1 aula" });
  expect(selected.props["aria-pressed"]).toBe(true);
  expect(other.props["aria-pressed"]).toBe(false);
  expect(selected.props.accessibilityState?.selected).toBeUndefined();
});
