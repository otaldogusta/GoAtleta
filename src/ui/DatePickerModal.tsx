import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Pressable } from "./Pressable";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useAppTheme } from "./app-theme";
import { ModalSheet } from "./ModalSheet";

type ViewMode = "day" | "month" | "year";

export function DatePickerModal({
  visible,
  value,
  onChange,
  onClose,
  closeOnSelect = false,
  initialViewMode = "day",
}: {
  visible: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  closeOnSelect: boolean;
  initialViewMode: ViewMode;
}) {
  const { colors, mode } = useAppTheme();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(new Date().getFullYear() / 12) * 12
  );
  const wasVisible = useRef(false);

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const dayLabels = ["D", "S", "T", "Q", "Q", "S", "S"];

  const formatIsoDate = (value: Date) => {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const parseIsoDate = (value: string) => {
    if (!value) return null;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const local = new Date(year, month - 1, day);
      return Number.isNaN(local.getTime()) ? null : local;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getCalendarDays = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ date: Date | null }> = [];
    for (let i = 0; i < 42; i += 1) {
      const dayNumber = i - firstDay + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cells.push({ date: null });
      } else {
        cells.push({ date: new Date(year, month, dayNumber) });
      }
    }
    return cells;
  };

  const buildClampedDate = (year: number, monthIndex: number) => {
    const base = parseIsoDate(value) ?? new Date();
    const day = base.getDate();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const clampedDay = Math.min(day, daysInMonth);
    return new Date(year, monthIndex, clampedDay);
  };

  useEffect(() => {
    if (visible && !wasVisible.current) {
      const base = parseIsoDate(value) ?? new Date();
      setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
      setYearPageStart(Math.floor(base.getFullYear() / 12) * 12);
      setViewMode(initialViewMode);
    }
    wasVisible.current = visible;
  }, [value, visible, initialViewMode]);

  const todayIso = useMemo(() => formatIsoDate(new Date()), []);
  const unselectedText = mode === "dark" ? colors.primaryText : colors.text;
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    return getCalendarDays(year, month);
  }, [calendarMonth]);

  const selectDate = (date: Date) => {
    onChange(formatIsoDate(date));
    if (closeOnSelect) onClose();
  };

  const goToday = () => {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onChange(todayIso);
    setViewMode("day");
  };

  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      cardStyle={{
        width: "100%",
        maxWidth: 360,
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 14,
        gap: 8,
      }}
    >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Pressable
              onPress={() => {
                if (viewMode === "day") {
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                  );
                } else if (viewMode === "month") {
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear() - 1, prev.getMonth(), 1)
                  );
                } else {
                  setYearPageStart((prev) => prev - 12);
                }
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <MaterialCommunityIcons
                name="chevron-left"
                size={18}
                color={colors.text}
              />
            </Pressable>
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Pressable
                onPress={goToday}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  minWidth: 44,
                  backgroundColor:
                    viewMode === "day" ? colors.primaryBg : colors.card,
                  borderWidth: viewMode === "day" ? 1 : 0,
                  borderColor: viewMode === "day" ? colors.primaryText : colors.border,
                }}
              >
                <Text
                  style={{
                    color: viewMode === "day" ? colors.primaryText : colors.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  Dia
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode("month")}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  minWidth: 44,
                  backgroundColor:
                    viewMode === "month" ? colors.primaryBg : colors.card,
                  borderWidth: viewMode === "month" ? 1 : 0,
                  borderColor: viewMode === "month" ? colors.primaryText : colors.border,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <Text
                  style={{
                    color: viewMode === "month" ? colors.primaryText : colors.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {monthNames[calendarMonth.getMonth()].slice(0, 3)}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode("year")}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 12,
                  minWidth: 44,
                  backgroundColor:
                    viewMode === "year" ? colors.primaryBg : colors.card,
                  borderWidth: viewMode === "year" ? 1 : 0,
                  borderColor: viewMode === "year" ? colors.primaryText : colors.border,
                  shadowColor: "#000",
                  shadowOpacity: 0.06,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 },
                  elevation: 2,
                }}
              >
                <Text
                  style={{
                    color: viewMode === "year" ? colors.primaryText : colors.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {calendarMonth.getFullYear()}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => {
                if (viewMode === "day") {
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                  );
                } else if (viewMode === "month") {
                  setCalendarMonth(
                    (prev) => new Date(prev.getFullYear() + 1, prev.getMonth(), 1)
                  );
                } else {
                  setYearPageStart((prev) => prev + 12);
                }
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={colors.text}
              />
            </Pressable>
          </View>
          {viewMode === "day" ? (
            <>
              <View style={{ flexDirection: "row", marginTop: 8 }}>
                {dayLabels.map((label, index) => (
                  <Text
                    key={`${label}-${index}`}
                    style={{
                      width: "14.2857%",
                      textAlign: "center",
                      fontSize: 12,
                      color: colors.muted,
                    }}
                  >
                    {label}
                  </Text>
                ))}
              </View>
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.border,
                  opacity: 0.6,
                  marginTop: 6,
                }}
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                {calendarDays.map((cell, index) => {
                  const isSelected =
                    cell.date && formatIsoDate(cell.date) === value;
                  const isToday =
                    cell.date && formatIsoDate(cell.date) === todayIso;
                  return (
                    <Pressable
                      key={`${cell.date ? cell.date.toISOString() : "empty"}_${index}`}
                      disabled={!cell.date}
                      onPress={() => {
                        if (!cell.date) return;
                        selectDate(cell.date);
                      }}
                      style={{
                        width: "14.2857%",
                        height: 32,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 4,
                        borderRadius: 18,
                        backgroundColor: isSelected
                          ? colors.primaryBg
                          : "transparent",
                        borderWidth: isToday && !isSelected ? 1 : 0,
                        borderColor: isToday ? colors.primaryBg : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: cell.date
                            ? (isSelected
                                ? colors.primaryText
                                : colors.text)
                            : "transparent",
                          fontSize: 12,
                        }}
                      >
                        {cell.date ? cell.date.getDate() : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : viewMode === "month" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
              {monthNames.map((name, index) => {
                const active = index === calendarMonth.getMonth();
                return (
                  <Pressable
                    key={name}
                    onPress={() => {
                      const nextDate = buildClampedDate(
                        calendarMonth.getFullYear(),
                        index
                      );
                      onChange(formatIsoDate(nextDate));
                      setCalendarMonth(
                        new Date(calendarMonth.getFullYear(), index, 1)
                      );
                    }}
                    style={{
                      width: "33.333%",
                      paddingVertical: 12,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: active
                          ? colors.primaryBg
                          : colors.secondaryBg,
                      }}
                    >
                      <Text style={{ color: active ? colors.primaryText : colors.text }}>
                        {name.slice(0, 3)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
              {Array.from({ length: 12 }, (_, idx) => yearPageStart + idx).map(
                (year) => {
                  const active = year === calendarMonth.getFullYear();
                  return (
                    <Pressable
                      key={year}
                      onPress={() => {
                        const nextDate = buildClampedDate(
                          year,
                          calendarMonth.getMonth()
                        );
                        onChange(formatIsoDate(nextDate));
                        setCalendarMonth(
                          new Date(year, calendarMonth.getMonth(), 1)
                        );
                      }}
                      style={{
                        width: "33.333%",
                        paddingVertical: 12,
                        alignItems: "center",
                      }}
                    >
                      <View
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          backgroundColor: active
                            ? colors.primaryBg
                            : colors.secondaryBg,
                        }}
                      >
                        <Text style={{ color: active ? colors.primaryText : colors.text }}>
                          {year}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }
              )}
            </View>
          )}
          <Pressable
            onPress={onClose}
            style={{
              paddingVertical: 8,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
              marginTop: 6,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Fechar</Text>
          </Pressable>
    </ModalSheet>
  );
}


