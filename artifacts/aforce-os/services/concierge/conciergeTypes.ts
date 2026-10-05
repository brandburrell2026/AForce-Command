/**
 * AForce Concierge — client-side wire types.
 *
 * Mirrors api-server/src/lib/concierge/types.ts (zod is the authority there;
 * these are the plain TS shapes the app renders). Keep the two in step — the
 * contract test `__tests__/conciergeContract.test.ts` pins the enums.
 */

export type ConciergeProvenance = 'measured' | 'logged' | 'estimated' | 'demo';
export type ConciergeFreshness = 'fresh' | 'aging' | 'stale' | 'expired' | 'missing';

export const CONCIERGE_SCREENS = [
  'home',
  'hydration',
  'protocol',
  'circle',
  'profile',
  'urine_check',
  'weekly_report',
  'performance_signal',
  'scan',
  'notifications',
  'health_connected',
  'moments',
  'sweat',
  'concierge_memory',
] as const;
export type ConciergeScreenId = (typeof CONCIERGE_SCREENS)[number];

export const CONCIERGE_CAPABILITIES = [
  'log_hydration',
  'open_screen',
  'start_checkin',
  'set_reminder',
] as const;
export type ConciergeCapability = (typeof CONCIERGE_CAPABILITIES)[number];

export type ConciergeAction =
  | { type: 'log_hydration'; fluidType: 'water'; oz: number; label: string }
  | { type: 'open_screen'; screen: ConciergeScreenId; label: string }
  | { type: 'start_checkin'; label: string }
  | {
      type: 'set_reminder';
      title: string;
      timeLocal: string;
      dateLocal: string;
      recurrence: 'once' | 'daily';
      label: string;
    };

export interface ConciergeSignal {
  id: string;
  label: string;
  value: number | string;
  unit?: string;
  provider?: string;
  provenance: ConciergeProvenance;
  freshness: ConciergeFreshness;
  observedAtIso?: string;
}

export interface ConciergeProviderStatus {
  id: string;
  connected: boolean;
  lastSyncIso: string | null;
  freshness: ConciergeFreshness;
}

export interface ConciergeDaySummary {
  date: string;
  avgScore: number | null;
  logs: number;
  oz: number | null;
}

export interface ConciergeClientContext {
  schemaVersion: 1;
  localTime: { iso: string; timeZone: string; hour: number };
  locale: string;
  demoMode: boolean;
  hydroState: {
    score: number;
    level: 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';
    urgency: 'calm' | 'moderate' | 'high' | 'critical';
    confidence?: 'high' | 'medium' | 'low';
    evidence: 'pending' | 'building' | 'ready';
    reasons?: string[];
  } | null;
  command: {
    action: string;
    explanation: string;
    urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
    confidence?: 'high' | 'medium' | 'low';
    guard: 'approved' | 'blocked';
  } | null;
  intake: {
    ozToday: number;
    ozTarget: number;
    unitsToday: number;
    unitsTarget: number;
    lastIntakeMinutesAgo: number | null;
    provenance: ConciergeProvenance;
  };
  signals: ConciergeSignal[];
  providers: ConciergeProviderStatus[];
  recentDays: ConciergeDaySummary[];
  capabilities: ConciergeCapability[];
  screens: ConciergeScreenId[];
  stated?: {
    destination?: string;
    destinationTimeZone?: string;
    schedule?: string;
    constraints?: string;
  };
}

export interface ConciergeSource {
  id: string;
  label: string;
  provenance: ConciergeProvenance | 'server';
  freshness: ConciergeFreshness;
  observedAtIso?: string;
}

export type ConciergeTurnStatus = 'ok' | 'urgent' | 'unavailable' | 'gated';

export interface ConciergeRememberSuggestion {
  key: 'primaryGoal' | 'routine' | 'tone' | 'note';
  value: string;
}

export interface ConciergeAssistantTurn {
  status: ConciergeTurnStatus;
  kind: 'answer' | 'clarify' | 'notice';
  answer: string;
  nextStep: string | null;
  why: string | null;
  action: ConciergeAction | null;
  remember: ConciergeRememberSuggestion | null;
  sources: ConciergeSource[];
  code?: string;
  audit: { model: string | null; gatePolicy: string; attempts: number };
}

export interface ConciergePreferences {
  primaryGoal?: string | null;
  routine?: string | null;
  tone?: 'rock' | 'bb' | 'surge' | 'sage' | null;
  notes?: string[];
}

export interface ConciergePreferencesRecord {
  prefs: ConciergePreferences;
  consentAt: string | null;
  updatedAt: string;
}

export interface ConciergeConversationSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConciergeStoredMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'notice';
  content: Record<string, unknown>;
  createdAt: string;
}

/** What the screen renders: member turns + assistant turns + local notices. */
export type ConciergeChatItem =
  | { id: string; role: 'user'; text: string; clientTurnId: string; createdAt: string }
  | { id: string; role: 'assistant'; turn: ConciergeAssistantTurn; createdAt: string }
  | {
      id: string;
      role: 'local';
      kind: 'offline' | 'error' | 'rate_limited' | 'daily_limit';
      retryOf?: string;
      createdAt: string;
    };
