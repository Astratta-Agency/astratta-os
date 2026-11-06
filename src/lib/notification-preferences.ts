import type { NotificationChannel, NotificationChannelPrefs } from "@/hooks/useWorkspaceSettings";

/**
 * Applies one channel change to an event's preferences. Desktop alerts are
 * triggered by the in-app row arriving over realtime, so they depend on it:
 * turning in-app off also turns desktop off, and turning desktop on turns
 * in-app on.
 */
export function applyChannelChange(
  current: NotificationChannelPrefs,
  channel: NotificationChannel,
  value: boolean,
): NotificationChannelPrefs {
  const next = { ...current, [channel]: value };
  if (channel === "in_app" && !value) next.push = false;
  if (channel === "push" && value) next.in_app = true;
  return next;
}
