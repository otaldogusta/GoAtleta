import {
  useEffect,
  useMemo,
  useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";

import { getClasses } from "../../src/db/seed";
import type { ClassGroup } from "../../src/core/models";
import { Button } from "../../src/ui/Button";
import { useAppTheme } from "../../src/ui/app-theme";
import { getSectionCardStyle } from "../../src/ui/section-styles";

const pad2 = (value: number) => String(value).padStart(2, "0");

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
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

const formatDate = (value: Date) =>
  `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(
    value.getDate()
  )}`;

const formatDateLabel = (value: Date) =>
  `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}`;

const formatIcsDateTime = (date: Date, hour: number, minute: number) => {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const h = pad2(hour);
  const min = pad2(minute);
  return `${y}${m}${d}T${h}${min}00`;
};

const parseTime = (value: string) => {
  const parts = value.split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1] ?? "0");
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
};

const addMinutes = (hour: number, minute: number, delta: number) => {
  const total = hour * 60 + minute + delta;
  const nextHour = Math.floor(total / 60) % 24;
  const nextMinute = total % 60;
  return { hour: nextHour, minute: nextMinute };
};

const getMonthGrid = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < 42; i += 1) {
    const dayNumber = i - firstDay + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cells.push(null);
    } else {
      cells.push(new Date(year, month, dayNumber));
    }
  }
  return cells;
};

const isClassDay = (date: Date, classes: ClassGroup[]) => {
  const day = date.getDay();
  return classes.some((cls) => cls.daysOfWeek.includes(day));
};

export default function AgendaScreen() {
  const { colors } = useAppTheme();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [month, setMonth] = useState(new Date());
  const [selected, setSelected] = useState(formatDate(new Date()));
  const [icsPreview, setIcsPreview] = useState("");
  const [viewMode, setViewMode] = useState<"day" | "month" | "year">("day");
  const [yearPageStart, setYearPageStart] = useState(
    Math.floor(new Date().getFullYear() / 12) * 12
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClasses();
      if (alive) setClasses(data);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const grid = useMemo(
    () => getMonthGrid(month.getFullYear(), month.getMonth()),
    [month]
  );

  const selectedDate = useMemo(
    () => new Date(selected + "T00:00:00"),
    [selected]
  );

  const dayEvents = useMemo(() => {
    const day = selectedDate.getDay();
    const filtered = classes.filter((cls) => cls.daysOfWeek.includes(day));
    if (!filtered.length) return [];
    return filtered.map((cls, index) => ({
      id: cls.id,
      title: cls.name,
      start: parseTime(cls.startTime || "") ?? { hour: 14 + index, minute: 0 },
      end: addMinutes(
        parseTime(cls.startTime || "")?.hour ?? 14 + index,
        parseTime(cls.startTime || "")?.minute ?? 0,
        cls.durationMinutes || 60
      ),
    }));
  }, [classes, selectedDate]);

  const exportIcs = () => {
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const dates = getMonthGrid(year, monthIndex).filter(
      (d): d is Date => Boolean(d)
    );
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "CALSCALE:GREGORIAN",
      "PRODID:-//MeuApp//Agenda//PT",
    ];

    dates.forEach((date) => {
      if (!isClassDay(date, classes)) return;
      const day = date.getDay();
      const filtered = classes.filter((cls) => cls.daysOfWeek.includes(day));
      filtered.forEach((cls, index) => {
        const parsed = parseTime(cls.startTime || "");
        const startHour = parsed?.hour ?? 14 + index;
        const startMinute = parsed?.minute ?? 0;
        const endTime = addMinutes(startHour, startMinute, cls.durationMinutes || 60);
        const start = formatIcsDateTime(date, startHour, startMinute);
        const end = formatIcsDateTime(date, endTime.hour, endTime.minute);
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${cls.id}-${formatDate(date)}`);
        lines.push(`DTSTART:${start}`);
        lines.push(`DTEND:${end}`);
        lines.push(`SUMMARY:Aula - ${cls.name}`);
        lines.push("END:VEVENT");
      });
    });

    lines.push("END:VCALENDAR");
    const ics = lines.join("\r\n");

    if (Platform.OS === "web") {
      const blob = new Blob([ics], { type: "text/calendar;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `agenda_${year}-${pad2(monthIndex + 1)}.ics`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      setIcsPreview(ics);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
          Agenda mensal
        </Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          Dias por unidade e turmas
        </Text>
      </View>

      <View
        style={[
          getSectionCardStyle(colors, "info", { padding: 16, radius: 20 }),
          { gap: 0 },
        ]}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {viewMode === "day" ? (
            <Pressable
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
              }
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{"<"}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                if (viewMode === "month") {
                  setMonth(new Date(month.getFullYear() - 1, month.getMonth(), 1));
                } else {
                  setYearPageStart((prev) => prev - 12);
                }
              }}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{"<"}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              setViewMode((prev) =>
                prev === "day" ? "month" : prev === "month" ? "year" : "month"
              );
            }}
            style={{ paddingVertical: 4, paddingHorizontal: 8 }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700" }}>
              {viewMode === "year"
                ? `${yearPageStart} - ${yearPageStart + 11}`
                : `${monthNames[month.getMonth()]} ${month.getFullYear()}`}
            </Text>
          </Pressable>
          {viewMode === "day" ? (
            <Pressable
              onPress={() =>
                setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
              }
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{">"}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                if (viewMode === "month") {
                  setMonth(new Date(month.getFullYear() + 1, month.getMonth(), 1));
                } else {
                  setYearPageStart((prev) => prev + 12);
                }
              }}
              style={{ padding: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{">"}</Text>
            </Pressable>
          )}
        </View>

        {viewMode === "day" ? (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 8,
              }}
            >
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d) => (
                <Text key={d} style={{ width: "14%", textAlign: "center" }}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
              {grid.map((cell, index) => {
                const isSelected = cell && formatDate(cell) === selected;
                const hasClass = cell && isClassDay(cell, classes);
                return (
                  <Pressable
                    key={index}
                    disabled={!cell}
                    onPress={() => {
                      if (!cell) return;
                      setSelected(formatDate(cell));
                    }}
                    style={{
                      width: "14%",
                      alignItems: "center",
                      paddingVertical: 8,
                    }}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 15,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected ? colors.primaryBg : "transparent",
                        borderWidth: hasClass ? 1 : 0,
                        borderColor: colors.primaryBg,
                      }}
                    >
                      <Text style={{ color: isSelected ? colors.primaryText : colors.text }}>
                        {cell ? cell.getDate() : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : viewMode === "month" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
            {monthNames.map((name, index) => {
              const active = index === month.getMonth();
              return (
                <Pressable
                  key={name}
                  onPress={() => {
                    setMonth(new Date(month.getFullYear(), index, 1));
                    setViewMode("day");
                  }}
                  style={{
                    width: "33.333%",
                    paddingVertical: 10,
                    alignItems: "center",
                  }}
                >
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
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
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 12 }}>
            {Array.from({ length: 12 }, (_, idx) => yearPageStart + idx).map(
              (year) => {
                const active = year === month.getFullYear();
                return (
                  <Pressable
                    key={year}
                    onPress={() => {
                      setMonth(new Date(year, month.getMonth(), 1));
                      setViewMode("month");
                    }}
                    style={{
                      width: "33.333%",
                      paddingVertical: 10,
                      alignItems: "center",
                    }}
                  >
                    <View
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
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
      </View>

      <View style={{ marginTop: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
          {formatDateLabel(selectedDate)}
        </Text>
        <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
          {dayEvents.length === 0 ? (
            <Text style={{ color: colors.muted }}>Nenhuma aula neste dia</Text>
          ) : (
            dayEvents.map((event) => (
              <View
                key={event.id}
                style={[
                  getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16 }),
                  {
                    shadowOpacity: 0.04,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 2,
                  },
                ]}
              >
                <Text style={{ fontWeight: "700" }}>{event.title}</Text>
                <Text>
                  {pad2(event.start.hour)}:{pad2(event.start.minute)} -{" "}
                  {pad2(event.end.hour)}:{pad2(event.end.minute)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <View style={{ marginTop: 8 }}>
        <Button label="Exportar Google Calendar (.ics)" onPress={exportIcs} />
      </View>

      {icsPreview ? (
        <View style={{ marginTop: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Arquivo .ics
          </Text>
          <TextInput
            value={icsPreview}
            multiline
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 12,
              minHeight: 140,
              backgroundColor: colors.card,
            }}
          />
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}



