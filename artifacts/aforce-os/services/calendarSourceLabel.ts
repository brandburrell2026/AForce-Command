/**
 * calendarSourceLabel — plain-words account kind for a device calendar, from
 * the only two things expo-calendar exposes about where a calendar comes from:
 * the source name (the account, e.g. "iCloud" or an account address) and the
 * source type (iOS: local, exchange, caldav, mobileme, subscribed, birthdays;
 * Android: the account type string, e.g. "com.google"). Pure; no device module.
 * Unknown types return null: the screen then shows the source name alone and
 * never guesses a provider.
 */
const KIND_BY_TYPE: Record<string, string> = {
  local: 'On this phone',
  exchange: 'Exchange or Microsoft 365',
  caldav: 'CalDAV account',
  mobileme: 'iCloud',
  subscribed: 'Subscribed calendar',
  birthdays: 'Birthdays',
  'com.google': 'Google account',
  'com.microsoft.exchange': 'Exchange or Microsoft 365',
  'com.google.android.gm.exchange': 'Exchange or Microsoft 365',
  'com.osp.app.signin': 'Samsung account',
  'com.samsung.android.exchange': 'Exchange or Microsoft 365',
  'com.android.exchange': 'Exchange or Microsoft 365',
  'com.microsoft.office.outlook.USER_ACCOUNT': 'Outlook account',
  'com.yahoo.mobile.client.android.mail': 'Yahoo account',
};

export function calendarSourceKind(sourceType: string | undefined): string | null {
  if (!sourceType) return null;
  return KIND_BY_TYPE[sourceType] ?? KIND_BY_TYPE[sourceType.toLowerCase()] ?? null;
}
