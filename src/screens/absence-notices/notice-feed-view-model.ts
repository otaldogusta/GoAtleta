export type NoticeFeedFilter =
  "all" | "unread" | "absence" | "birthday" | "other" | "archived";

export type NoticeFeedCategory = "absence" | "birthday" | "other";

export type NoticeFeedCandidate<T> = {
  value: T;
  sortTime: number;
  category: NoticeFeedCategory;
  unread: boolean;
  archived: boolean;
};

export type NoticeFeedSection<T> = {
  id: "today" | "recent" | "earlier";
  title: string;
  data: T[];
};

export const resolveNoticeFeedCategory = ({
  hasAbsenceNotice,
  notificationType,
}: {
  hasAbsenceNotice: boolean;
  notificationType?: string | null;
}): NoticeFeedCategory => {
  if (hasAbsenceNotice || notificationType?.startsWith("absence_notice")) {
    return "absence";
  }
  if (notificationType === "birthday") return "birthday";
  return "other";
};

export const matchesNoticeFeedFilter = <T>(
  item: NoticeFeedCandidate<T>,
  filter: NoticeFeedFilter,
) => {
  if (filter === "all") return true;
  if (filter === "unread") return item.unread;
  if (filter === "archived") return item.archived;
  return item.category === filter;
};

export const buildNoticeFeedSections = <T>(
  items: readonly NoticeFeedCandidate<T>[],
  filter: NoticeFeedFilter,
  now = Date.now(),
): NoticeFeedSection<T>[] => {
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const recentStart = new Date(todayStart);
  recentStart.setDate(recentStart.getDate() - 6);

  const sections: NoticeFeedSection<T>[] = [
    { id: "today", title: "Hoje", data: [] },
    { id: "recent", title: "Últimos 7 dias", data: [] },
    { id: "earlier", title: "Anteriores", data: [] },
  ];

  items
    .filter((item) => matchesNoticeFeedFilter(item, filter))
    .sort((left, right) => right.sortTime - left.sortTime)
    .forEach((item) => {
      if (item.sortTime >= todayStart.getTime()) {
        sections[0].data.push(item.value);
      } else if (item.sortTime >= recentStart.getTime()) {
        sections[1].data.push(item.value);
      } else {
        sections[2].data.push(item.value);
      }
    });

  return sections.filter((section) => section.data.length > 0);
};
