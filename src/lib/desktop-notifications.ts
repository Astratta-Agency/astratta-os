// Browser (desktop) notifications for Astratta OS.
// Shown by the operating system while the app is open in a tab, even when
// that tab is in the background. They do not reach a closed browser.

export type DesktopPermission = NotificationPermission | "unsupported";

export function desktopNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopPermission(): DesktopPermission {
  if (!desktopNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestDesktopPermission(): Promise<DesktopPermission> {
  if (!desktopNotificationsSupported()) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Decides whether a new notification should also pop up on the desktop.
 * Skipped when the user is already looking at the app: the bell covers that.
 */
export function shouldShowDesktopNotification(args: {
  pushEnabled: boolean;
  permission: DesktopPermission;
  documentHidden: boolean;
}): boolean {
  return args.pushEnabled && args.permission === "granted" && args.documentHidden;
}

export function showDesktopNotification(args: {
  id: string;
  title: string;
  body: string | null;
  onClick?: () => void;
}): void {
  if (getDesktopPermission() !== "granted") return;
  try {
    const n = new Notification(args.title, {
      body: args.body ?? undefined,
      tag: args.id, // same notification in several tabs is shown once
      icon: "/favicon.ico",
    });
    n.onclick = () => {
      window.focus();
      args.onClick?.();
      n.close();
    };
  } catch {
    // Some browsers (e.g. Android Chrome) only allow notifications from a
    // service worker; fail silently, the bell still has it.
  }
}
