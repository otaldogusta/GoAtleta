import { eventCalendarDates, eventDraftInterval, initialEventDraft, quickEventDraft } from "../event-draft";
import type { EventListItem } from "../../../../api/events";
test("new event inherits the selected date and rejects impossible dates/times", () => {
  const draft = initialEventDraft("2026-09-30");
  expect(draft.startDate).toBe("2026-09-30");
  expect(eventDraftInterval(draft)?.startsAt.getMonth()).toBe(8);
  expect(eventDraftInterval({ ...draft, startDate: "2026-02-30" })).toBeNull();
  expect(eventDraftInterval({ ...draft, endTime: "08:00" })).toBeNull();
  expect(eventDraftInterval({ ...draft, startTime: "25:00" })).toBeNull();
});
test("all-day ranges end exclusively and cover only intersecting days", () => {
  const draft = { ...initialEventDraft("2026-09-30"), endDate: "2026-10-02", allDay: true };
  const interval = eventDraftInterval(draft)!;
  const event = { ...draft, startsAt: interval.startsAt.toISOString(), endsAt: interval.endsAt.toISOString() } as unknown as EventListItem;
  expect(initialEventDraft("", event).endDate).toBe("2026-10-02");
  expect(eventCalendarDates(event, new Date("2026-10-01T00:00:00"), new Date("2026-10-04T23:59:59"))).toEqual(["2026-10-01", "2026-10-02"]);
});

test.each(["Reunião às 18h", "Reunião 18:30", "Reunião as 18h30"])("quick entry parses an explicit time without guessing another date: %s", text => {
 const draft = quickEventDraft({ ...initialEventDraft("2026-09-30"), title: text });
 expect(draft.title).toBe("Reunião"); expect(draft.startDate).toBe("2026-09-30");
 expect(draft.startTime).toBe(text.endsWith("18h") ? "18:00" : "18:30");
 expect(eventDraftInterval(draft)).not.toBeNull();
});
test("quick time handles midnight and blocks an invalid explicit hour", () => {
 expect(quickEventDraft({ ...initialEventDraft("2026-09-30"), title: "Treino às 23h30" })).toMatchObject({ title: "Treino", startTime: "23:30", endTime: "00:30", endDate: "2026-10-01" });
 expect(eventDraftInterval(quickEventDraft({ ...initialEventDraft("2026-09-30"), title: "Treino às 25h" }))).toBeNull();
});
