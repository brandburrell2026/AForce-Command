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

import { Share, Platform, Linking } from 'react-native';
import * as Sharing from 'expo-sharing';
import type { ShareFormat, ShareItem } from '../types/share';
import { composeTextShare } from './shareTemplateEngine';

/**
 * Supported one-tap social targets. `'system'` is the OS share sheet which
 * remains the catch-all (and the only viable target for Instagram Stories
 * because IG does not accept text payloads through deep-link URLs).
 */
export type SocialPlatform =
  | 'x'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'whatsapp'
  | 'telegram'
  | 'sms'
  | 'system';

export interface OpenShareOpts {
  format: ShareFormat;
  message: string;
  /** Optional URL appended to the share — e.g. App Store link. */
  url?: string;
  /**
   * Optional captured image URI (file:// on native, blob:/data: on web).
   * When present, image-capable share targets attach the image instead of
   * (or in addition to) the text payload. Required for Instagram so the
   * card/story actually appears in the user's post.
   */
  imageUri?: string;
}

type MaybeWebShare = {
  share?: (d: ShareData & { files?: File[] }) => Promise<void>;
  canShare?: (d: ShareData & { files?: File[] }) => boolean;
  clipboard?: { writeText?: (s: string) => Promise<void> };
};

/** Convert a captured image URI (data:/blob:/http:) to a File for Web Share. */
async function uriToFile(uri: string, name = 'aforce-share.png'): Promise<File | undefined> {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || 'image/png' });
  } catch {
    return undefined;
  }
}

/** Trigger a browser download as a last-resort image fallback on web. */
function downloadOnWeb(uri: string, name = 'aforce-share.png'): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const a = document.createElement('a');
    a.href = uri;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

async function webShare(text: string, url?: string, imageUri?: string): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as unknown as MaybeWebShare;

  // Prefer image + text via Web Share API when the browser supports files.
  if (imageUri && typeof nav.share === 'function') {
    const file = await uriToFile(imageUri);
    if (file) {
      const payload: ShareData & { files?: File[] } = {
        files: [file],
        text,
        ...(url ? { url } : {}),
      };
      const can = typeof nav.canShare === 'function' ? nav.canShare(payload) : true;
      if (can) {
        try {
          await nav.share(payload);
          return true;
        } catch {
          // fall through to text-only share / download
        }
      }
    }
  }

  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text, ...(url ? { url } : {}) });
      return true;
    } catch {
      // User dismissed or share failed — treat both as not-shared.
      return false;
    }
  }
  // Final fallback: download the image (if any) + copy text to clipboard.
  if (imageUri) downloadOnWeb(imageUri);
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(url ? `${text}\n${url}` : text);
      return true;
    } catch {
      return false;
    }
  }
  return !!imageUri; // download counts as "something happened"
}

/** Returns true on success, false if the user cancelled or it failed silently. */
export async function openShareSheet(opts: OpenShareOpts): Promise<boolean> {
  const text = composeTextShare(opts.message);
  if (Platform.OS === 'web') return webShare(text, opts.url, opts.imageUri);

  // Native: when an image was captured, use expo-sharing so the share
  // sheet attaches the PNG (Instagram, Facebook, Messages, etc. all
  // accept images). expo-sharing's native dialog shows every image-
  // capable destination installed on the device.
  if (opts.imageUri) {
    try {
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(opts.imageUri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your result',
          UTI: 'public.png',
        });
        return true;
      }
    } catch {
      // fall through to text-only RN Share below
    }
  }
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
 * Build a deep-link / web-intent URL for a given social target.
 *
 * Each platform exposes a "share intent" URL that pre-fills a post composer.
 * Mobile apps register custom URL schemes that intercept the matching web
 * URL; if the app isn't installed the browser opens the same URL and the
 * user lands in the web composer instead. `null` means "this platform has
 * no text-share URL — use the OS share sheet" (Instagram is the canonical
 * example: IG Stories accept only image/video payloads via deep link, not
 * arbitrary text).
 */
export function buildSocialShareUrl(
  platform: SocialPlatform,
  text: string,
  url?: string,
): string | null {
  const t = text.trim();
  const u = (url ?? '').trim();
  const composed = u ? `${t}\n${u}` : t;
  const encT = encodeURIComponent(t);
  const encU = encodeURIComponent(u);
  const encComposed = encodeURIComponent(composed);

  switch (platform) {
    case 'x':
      // X / Twitter web intent — works for both app (via deep link
      // interception) and browser composer.
      return u
        ? `https://twitter.com/intent/tweet?text=${encT}&url=${encU}`
        : `https://twitter.com/intent/tweet?text=${encT}`;
    case 'facebook':
      // FB sharer requires a `u` (URL) param; the `quote` is appended as the
      // user-editable caption. When no link is supplied we fall back to
      // sharing the App Store landing page so the share is non-empty.
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u || 'https://aforce.app')}&quote=${encT}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u || 'https://aforce.app')}&summary=${encT}`;
    case 'whatsapp':
      // wa.me works on web AND deep-links into the WhatsApp app on devices
      // where it's installed — the recommended cross-platform target.
      return `https://wa.me/?text=${encComposed}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(u || 'https://aforce.app')}&text=${encT}`;
    case 'sms':
      // RFC 5724 SMS URI. Use `&` body separator on iOS, `?` elsewhere — but
      // both platforms tolerate `?body=` so we keep it simple.
      return `sms:?body=${encComposed}`;
    case 'instagram':
    case 'system':
      // Instagram has no text-share URL — let the OS share sheet handle it.
      return null;
  }
}

/**
 * Share to a specific social platform. Returns true on success / dispatch,
 * false if the user cancelled or the platform was unreachable.
 */
export async function shareToSocial(
  platform: SocialPlatform,
  opts: OpenShareOpts,
): Promise<boolean> {
  const text = composeTextShare(opts.message);
  // When the user is sharing an image (card/story format), bypass the
  // text-only deep links — those networks accept images only through the
  // OS share sheet. This is also the only way Instagram accepts our card.
  if (opts.imageUri) return openShareSheet(opts);

  const url = buildSocialShareUrl(platform, text, opts.url);
  // Instagram + 'system' fall through to the OS share sheet (Web Share API
  // on web). For Instagram on a real device the share sheet exposes the
  // "Stories" / "Feed" targets when IG is installed.
  if (!url) return openShareSheet(opts);
  try {
    const can = await Linking.canOpenURL(url);
    if (!can && Platform.OS !== 'web') {
      // Native couldn't resolve a handler — fall back to system share
      // sheet so the user still has a path to post.
      return openShareSheet(opts);
    }
    await Linking.openURL(url);
    return true;
  } catch {
    // openURL can throw on misconfigured URLs or user denial — treat as
    // a non-fatal cancellation and let the caller decide what to surface.
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
