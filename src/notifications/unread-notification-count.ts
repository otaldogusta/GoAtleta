type NotificationReadState = {
  read: boolean;
};

export const countUnreadNotifications = (
  notifications: readonly NotificationReadState[]
) => notifications.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);

export const formatUnreadNotificationBadge = (count: number) => {
  const normalizedCount = Math.max(0, Math.floor(count));
  if (normalizedCount === 0) return undefined;
  return normalizedCount > 99 ? "99+" : String(normalizedCount);
};
