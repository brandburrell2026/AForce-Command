/**
 * Share service — opens the OS share sheet with a composed payload.
 *
 * Format scope today:
 *   - All three formats (card / story / text) emit a TEXT share to the OS
 *     share sheet. The card/story formats are visual *previews* inside the
 *     app so the user can see how their moment looks; image export
 *     (card-as-PNG via react-native-view-shot) is intentionally deferred to
 *     a future cycle. The format choice is still recorded on the ShareItem
 *     so analytics can differentiate intent and so the future image-export
 *     wire-up is purely additive.
 *
 * Web behavior:
 *   - Tries the Web Share API (`navigator.share`) first.
 *   - Falls back to the Clipboard API (`navigator.clipboard.writeText`) if
 *     Web Share is unavailable. RN's `Share.share` is unreliable on web.
 *   - On both paths, returns true only when the share/copy actually
 *     succeeded; user cancellation returns false without throwing.
 */

import { Share, Platform } from 'react-native';
import type { ShareFormat, ShareItem } from '../types/share';
import { composeTextShare } from './shareTemplateEngine';

export interface OpenShareOpts {
  format: ShareFormat;
  message: string;
  /** Optional URL appended to the share — e.g. App Store link. */
  url?: string;
}

type MaybeWebShare = {
  share?: (d: ShareData) => Promise<void>;
  clipboard?: { writeText?: (s: string) => Promise<void> };
};

async function webShare(text: string, url?: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as unknown as MaybeWebShare;
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text, ...(url ? { url } : {}) });
      return true;
    } catch {
      // User dismissed or share failed — treat both as not-shared.
      return false;
    }
  }
  // Fallback: copy to clipboard so the user has something to paste.
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(url ? `${text}\n${url}` : text);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Returns true on success, false if the user cancelled or it failed silently. */
export async function openShareSheet(opts: OpenShareOpts): Promise<boolean> {
  const text = composeTextShare(opts.message);
  if (Platform.OS === 'web') return webShare(text, opts.url);
  try {
    const result = await Share.share(
      { message: opts.url ? `${text}\n${opts.url}` : text },
      { dialogTitle: 'Share your result' },
    );
    return result.action !== Share.dismissedAction;
  } catch {
    // User cancellation on iOS throws — treat as not-shared, not an error.
    return false;
  }
}

/**
 * Build a fully-formed ShareItem record. Useful for logging / event emission;
 * the api-server will eventually accept these via `share.created` events to
 * power weekly recap analytics. For now this is purely client-side.
 */
export function buildShareItem(format: ShareFormat, message: string, ctx: ShareItem['context']): ShareItem {
  return {
    shareId: `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: ctx.type,
    format,
    message,
    context: ctx,
    createdAt: new Date().toISOString(),
  };
}
