import { duplicateEventDraft, eventCalendarDates, eventDraftInterval, initialEventDraft, moveEventDraftStart, quickEventDraft } from "../event-draft";
import type { EventListItem } from "../../../../api/events";
test("new event inherits the selected date and rejects impossible dates/times", () => {
  const draft = initialEventDraft("2026-09-30");
  expect(draft.startDate).toBe("2026-09-30");
  expect(eventDraftInterval(draft)?.startsAt.getMonth()).toBe(8);
  expect(eventDraftInterval({ ...draft, startDate: "2026-02-30" })).toBeNull();
  expect(eventDraftInterval({ ...draft, endTime: "08:00" })).toBeNull();
  expect(eventDraftInterval({ ...draft, startTime: "25:00" })).toBeNull();
});
test("duplicate copies configuration and standalone unit without retaining source identity or array references", () => {
  const event = { id: "original", organizationId: "org", unitId: "unit-a", title: "Encontro", description: "Levar material", eventType: "reuniao", sport: "geral", startsAt: "2026-10-29T09:00:00", endsAt: "2026-10-29T10:30:00", allDay: false, classIds: ["class-a"], ruleSetId: "old-rules" } as EventListItem;
  const draft = duplicateEventDraft("2026-10-29", event);
  expect(draft).toMatchObject({ title: event.title, description: event.description, unitId: "unit-a", startDate: "2026-10-29", startTime: "09:00", endTime: "10:30", classIds: ["class-a"] });
  expect(draft).not.toHaveProperty("id"); expect(draft).not.toHaveProperty("ruleSetId"); expect(draft).not.toHaveProperty("resumeId"); expect(draft).not.toHaveProperty("attachments");
  draft.classIds.push("class-b"); expect(event.classIds).toEqual(["class-a"]);
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

test("moving the start preserves an existing duration across midnight", () => {
 const draft = { ...initialEventDraft("2026-09-30"), endTime: "10:30" };
 const moved = moveEventDraftStart(draft, "23:30");
 expect(moved).toMatchObject({ startTime: "23:30", endDate: "2026-10-01", endTime: "01:00" });
 expect(eventDraftInterval(moved)!.endsAt.getTime() - eventDraftInterval(moved)!.startsAt.getTime()).toBe(90 * 60000);
});

test("the start selector leaves all-day and invalid time values unchanged", () => {
 const draft = initialEventDraft("2026-09-30");
 expect(moveEventDraftStart(draft, "25:00")).toBe(draft);
 const allDay = { ...draft, allDay: true };
 expect(moveEventDraftStart(allDay, "12:30")).toBe(allDay);
});

test("moving the start date preserves timed and all-day ranges across the year", () => {
 const timed = { ...initialEventDraft("2026-12-30"), startTime: "23:30", endDate: "2026-12-31", endTime: "01:00" };
 expect(moveEventDraftStart(timed, timed.startTime, "2026-12-31")).toMatchObject({ startDate: "2026-12-31", endDate: "2027-01-01", endTime: "01:00" });
 const allDay = { ...initialEventDraft("2026-12-30"), allDay: true, endDate: "2027-01-01" };
 const moved = moveEventDraftStart(allDay, allDay.startTime, "2026-12-31");
 expect(moved).toMatchObject({ startDate: "2026-12-31", endDate: "2027-01-02", allDay: true });
 expect(eventDraftInterval(moved)!.endsAt.getDate()).toBe(3);
 expect(moveEventDraftStart(timed, timed.startTime, "2026-02-30")).toBe(timed);
});
