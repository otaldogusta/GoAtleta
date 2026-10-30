import { buildCalendarEntryIcs, buildCalendarEntrySummary, calendarEntryFileName, type CalendarEntryShareSnapshot } from "../share-calendar-entry-content";

const snapshot: CalendarEntryShareSnapshot = { title: "Treino", startDate: "2026-10-29", endDate: "2026-10-29", startTime: "09:00", endTime: "10:30", location: "Quadra 1", description: "Levar material" };
test("exports one occurrence without recurring rules, invitations or private attachment URLs", () => {
  const content = buildCalendarEntryIcs({ ...snapshot, uid: "event-a@goatleta" }, new Date("2026-10-29T12:00:00Z"));
  expect(content.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  expect(content).toContain("UID:event-a@goatleta\r\n");
  expect(content).toContain("DTSTAMP:20261029T120000Z\r\n");
  expect(content).toContain("DTSTART:"); expect(content).toContain("SUMMARY:Treino\r\n");
  expect(content).not.toMatch(/RRULE:|ORGANIZER:|ATTENDEE:|ATTACH:|URL:/);
});
test("all-day inclusive display dates become an exclusive calendar end exactly once", () => {
  const content = buildCalendarEntryIcs({ ...snapshot, startDate: "2026-12-31", endDate: "2027-01-02", allDay: true });
  expect(content).toContain("DTSTART;VALUE=DATE:20261231\r\n");
  expect(content).toContain("DTEND;VALUE=DATE:20270103\r\n");
  expect(content).not.toMatch(/DTSTART:\d+T/);
});
test("escapes text injection and folds Unicode without splitting code points", () => {
  const content = buildCalendarEntryIcs({ ...snapshot, title: "Aula, treino; equipe\\\r\nATTACH:privado", description: "á🏐".repeat(100) });
  expect(content).not.toContain("\r\nATTACH:");
  expect(content).toContain("Aula\\, treino\\; equipe\\\\\\nATTACH:privado");
  for (const line of content.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
  expect(content).not.toContain(String.fromCodePoint(0xfffd));
});
test("summary uses visible details and export filenames contain no path components", () => {
  const summary = buildCalendarEntrySummary(snapshot);
  expect(summary).toContain("Treino\n"); expect(summary).toContain("09:00 – 10:30");
  expect(summary).toContain("Quadra 1\nLevar material");
  expect(calendarEntryFileName({ ...snapshot, title: "../Reunião / equipe" })).toBe("go-atleta-reuniao-equipe-2026-10-29.ics");
});
test("missing or impossible periods are rejected instead of inventing a time", () => {
  expect(() => buildCalendarEntryIcs({ ...snapshot, startTime: undefined })).toThrow("datas");
  expect(() => buildCalendarEntryIcs({ ...snapshot, startDate: "2026-02-30" })).toThrow("datas");
  const midnight = buildCalendarEntryIcs({ ...snapshot, startTime: "23:30", endDate: "2026-10-30", endTime: "00:30" });
  expect(midnight).toContain("END:VEVENT");
});
