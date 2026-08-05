import {
  countUnreadNotifications,
  formatUnreadNotificationBadge,
} from "../unread-notification-count";

describe("unread notification badge", () => {
  it("counts only unread notifications", () => {
    expect(
      countUnreadNotifications([
        { read: false },
        { read: true },
        { read: false },
      ])
    ).toBe(2);
  });

  it("hides an empty badge and limits large values", () => {
    expect(formatUnreadNotificationBadge(0)).toBeUndefined();
    expect(formatUnreadNotificationBadge(8)).toBe("8");
    expect(formatUnreadNotificationBadge(120)).toBe("99+");
  });
});
