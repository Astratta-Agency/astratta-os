import { describe, expect, it } from "vitest";
import { applyChannelChange } from "@/lib/notification-preferences";
import { shouldShowDesktopNotification } from "@/lib/desktop-notifications";
import { NOTIFICATION_EVENTS } from "@/hooks/useWorkspaceSettings";

const base = { in_app: true, email: false, push: false };

describe("applyChannelChange", () => {
  it("changes only the requested channel", () => {
    expect(applyChannelChange(base, "email", true)).toEqual({ in_app: true, email: true, push: false });
  });

  it("turns desktop off when in-app is turned off", () => {
    expect(applyChannelChange({ in_app: true, email: true, push: true }, "in_app", false)).toEqual({
      in_app: false,
      email: true,
      push: false,
    });
  });

  it("turns in-app on when desktop is turned on", () => {
    expect(applyChannelChange({ in_app: false, email: false, push: false }, "push", true)).toEqual({
      in_app: true,
      email: false,
      push: true,
    });
  });

  it("does not mutate the input", () => {
    const input = { ...base };
    applyChannelChange(input, "in_app", false);
    expect(input).toEqual(base);
  });
});

describe("shouldShowDesktopNotification", () => {
  it("shows only when enabled, permitted and the tab is in the background", () => {
    expect(shouldShowDesktopNotification({ pushEnabled: true, permission: "granted", documentHidden: true })).toBe(true);
    expect(shouldShowDesktopNotification({ pushEnabled: true, permission: "granted", documentHidden: false })).toBe(false);
    expect(shouldShowDesktopNotification({ pushEnabled: false, permission: "granted", documentHidden: true })).toBe(false);
    expect(shouldShowDesktopNotification({ pushEnabled: true, permission: "denied", documentHidden: true })).toBe(false);
    expect(shouldShowDesktopNotification({ pushEnabled: true, permission: "unsupported", documentHidden: true })).toBe(false);
  });
});

describe("NOTIFICATION_EVENTS", () => {
  it("covers every type the notifications table accepts, once", () => {
    const keys = NOTIFICATION_EVENTS.map((e) => e.key).sort();
    expect(keys).toEqual(
      [
        "post_approved", "post_rejected", "post_changes_requested", "invite_accepted",
        "payment_received", "contract_expiring", "new_lead", "proposal_signed",
        "task_assigned", "contract_signed",
        "invoice_sent", "invoice_paid", "invoice_overdue", "invoice_payment_failed",
      ].sort(),
    );
  });
});
