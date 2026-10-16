import { useState } from "react";
import { ShieldAlert, Clock, AlertTriangle, X, Loader2 } from "lucide-react";
import { DesktopPrepOutcome } from "../types";
import { requestAccessibilityPermission } from "../lib/store";

interface DesktopPrepNoticeProps {
  outcome: DesktopPrepOutcome;
  onDismiss: () => void;
  /** Called with the fresh permission state after the user asks to fix it. */
  onPermissionChecked?: (granted: boolean) => void;
}

/**
 * Explains why the last overlay did not clear the desktop.
 *
 * Without this the failure was invisible: the sweep's outcome went to stderr,
 * the overlay appeared on top of the user's still-open fullscreen windows, and
 * nothing said why. Rendered in the dashboard window rather than over the
 * overlay itself, so the prayer screen stays undisturbed — the user sees it the
 * next time they open Waqt from the tray.
 */
export function DesktopPrepNotice({ outcome, onDismiss, onPermissionChecked }: DesktopPrepNoticeProps) {
  const [requesting, setRequesting] = useState(false);

  if (outcome.status === "skipped" || outcome.status === "completed") return null;

  const handleGrant = async () => {
    if (requesting) return;
    setRequesting(true);
    try {
      const granted = await requestAccessibilityPermission();
      onPermissionChecked?.(granted);
      if (granted) onDismiss();
    } catch {
      onPermissionChecked?.(false);
    } finally {
      setRequesting(false);
    }
  };

  const isPermission = outcome.status === "permission_denied";

  const Icon = isPermission ? ShieldAlert : outcome.status === "timed_out" ? Clock : AlertTriangle;

  const title = isPermission
    ? "Waqt could not clear your screen"
    : outcome.status === "timed_out"
    ? "Clearing your screen took too long"
    : "Clearing your screen failed";

  const body = isPermission
    ? "The prayer overlay appeared over your open windows because Accessibility access is not granted. Waqt needs it to minimize other apps before a prayer."
    : outcome.status === "timed_out"
    ? "Some windows stayed open when the overlay appeared. This usually means several apps were in fullscreen — leaving each fullscreen Space takes about half a second."
    : `Some windows stayed open when the overlay appeared. macOS reported: ${outcome.message}`;

  return (
    <div
      role="status"
      className="mx-auto mb-4 w-full max-w-3xl rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-amber-500/12 border border-amber-500/25 flex items-center justify-center">
          <Icon className="w-4 h-4 text-amber-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-amber-100">{title}</div>
          <p className="text-[11px] leading-relaxed text-amber-200/70 mt-1">{body}</p>

          {isPermission && (
            <button
              type="button"
              onClick={handleGrant}
              disabled={requesting}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requesting && <Loader2 className="w-3 h-3 animate-spin" />}
              {requesting ? "Opening System Settings…" : "Grant Accessibility access"}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 p-1 rounded-md text-amber-300/50 hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
