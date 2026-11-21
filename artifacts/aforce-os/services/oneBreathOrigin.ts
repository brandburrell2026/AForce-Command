/**
 * Where One Breath was opened from, so Close can go back there.
 *
 * One Breath hides the tab bar (the approved prototype shows none), so its
 * close button is the way out. When One Breath is the tab itself there is no
 * history to go back through, so the tab the member was on is remembered here.
 * Only a tab is ever remembered: a screen stacked above the tabs has its own
 * way back.
 */
const TABS: readonly string[] = ['/', '/journal', '/protocol', '/moments-tab', '/competition', '/profile', '/scan', '/social', '/social-legacy', '/sleep'];

let origin = '/';

/** Called by the tab layout whenever the screen in front changes. */
export function rememberOneBreathOrigin(pathname: string | null | undefined): void {
  if (pathname && TABS.includes(pathname)) origin = pathname;
}

export const oneBreathOrigin = (): string => origin;

interface Router {
  canGoBack: () => boolean;
  back: () => void;
  navigate: (href: never) => void;
  replace: (href: never) => void;
}

/** Close One Breath: back to where it was opened from, or Home if that is unknown. */
export function closeOneBreath(router: Router, pathname: string): void {
  if (pathname.startsWith('/one-breath-tab')) router.navigate(origin as never);
  else if (router.canGoBack()) router.back();
  else router.replace('/' as never);
}

/** Test seam. */
export function resetOneBreathOriginForTests(): void {
  origin = '/';
}
