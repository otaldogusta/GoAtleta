import {
  buildNoticeFeedSections,
  matchesNoticeFeedFilter,
  resolveNoticeFeedCategory,
  type NoticeFeedCandidate,
} from "../notice-feed-view-model";

type Candidate = NoticeFeedCandidate<string>;

describe("notice feed view model", () => {
  it("classifies absence and birthday notifications", () => {
    expect(
      resolveNoticeFeedCategory({
        hasAbsenceNotice: true,
        notificationType: "generic",
      }),
    ).toBe("absence");
    expect(
      resolveNoticeFeedCategory({
        hasAbsenceNotice: false,
        notificationType: "birthday",
      }),
    ).toBe("birthday");
    expect(
      resolveNoticeFeedCategory({
        hasAbsenceNotice: false,
        notificationType: "training_saved",
      }),
    ).toBe("other");
  });

  it("filters unread items independently from category", () => {
    const unreadBirthday: Candidate = {
      value: "birthday",
      sortTime: 1,
      category: "birthday",
      unread: true,
      archived: false,
    };

    expect(matchesNoticeFeedFilter(unreadBirthday, "unread")).toBe(true);
    expect(matchesNoticeFeedFilter(unreadBirthday, "birthday")).toBe(true);
    expect(matchesNoticeFeedFilter(unreadBirthday, "absence")).toBe(false);
  });

  it("shows only archived items in the archived filter", () => {
    const archived: Candidate = {
      value: "archived",
      sortTime: 2,
      category: "other",
      unread: false,
      archived: true,
    };
    const active: Candidate = {
      value: "active",
      sortTime: 1,
      category: "other",
      unread: false,
      archived: false,
    };

    expect(matchesNoticeFeedFilter(archived, "archived")).toBe(true);
    expect(matchesNoticeFeedFilter(active, "archived")).toBe(false);
  });

  it("groups notices by recency and removes empty sections", () => {
    const now = new Date("2026-08-05T12:00:00-03:00").getTime();
    const items: Candidate[] = [
      {
        value: "today",
        sortTime: new Date("2026-08-05T09:00:00-03:00").getTime(),
        category: "other",
        unread: false,
        archived: false,
      },
      {
        value: "recent",
        sortTime: new Date("2026-08-02T09:00:00-03:00").getTime(),
        category: "absence",
        unread: true,
        archived: false,
      },
      {
        value: "earlier",
        sortTime: new Date("2026-07-20T09:00:00-03:00").getTime(),
        category: "birthday",
        unread: false,
        archived: false,
      },
    ];

    expect(buildNoticeFeedSections(items, "all", now)).toEqual([
      { id: "today", title: "Hoje", data: ["today"] },
      { id: "recent", title: "Últimos 7 dias", data: ["recent"] },
      { id: "earlier", title: "Anteriores", data: ["earlier"] },
    ]);
    expect(buildNoticeFeedSections(items, "unread", now)).toEqual([
      { id: "recent", title: "Últimos 7 dias", data: ["recent"] },
    ]);
  });
});
