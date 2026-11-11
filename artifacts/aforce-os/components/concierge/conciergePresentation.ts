/**
 * AForce Concierge — pure presentation helpers (unit-tested, RN-free).
 */
import type { TFunction } from 'i18next';
import type { ConciergeAction, ConciergeAssistantTurn, ConciergeClientContext, ConciergeSource } from '@/services/concierge/conciergeTypes';
import type { ConciergeErrorKind } from '@/services/concierge/conciergeApi';

export interface NoticeCopy {
  title: string;
  body: string;
  retryable: boolean;
}

/** Copy for a non-ok assistant turn (unavailable / gated). Urgent is rendered as content. */
export function noticeCopyFor(turn: ConciergeAssistantTurn, t: TFunction): NoticeCopy | null {
  if (turn.status === 'ok' || turn.status === 'urgent') return null;
  if (turn.status === 'gated') {
    return { title: t('concierge.state.gated_title'), body: t('concierge.state.gated_body'), retryable: true };
  }
  return { title: t('concierge.state.unavailable_title'), body: unavailableBodyFor(turn.code, t), retryable: unavailableRetryable(turn.code) };
}

/** Turn codes and status reasons share one copy map: configuration vs capacity vs reachability. */
export function unavailableBodyFor(code: string | null | undefined, t: TFunction): string {
  switch (code) {
    case 'ai_not_configured':
    case 'upstream_auth':
    case 'ai_key_invalid':
      return t('concierge.state.not_configured_body');
    case 'upstream_quota':
    case 'ai_quota_exhausted':
      return t('concierge.state.quota_body');
    case 'upstream_rate_limited':
    case 'ai_rate_limited':
      return t('concierge.state.rate_limited');
    case 'upstream_model':
    case 'ai_model_unavailable':
      return t('concierge.state.model_body');
    default:
      return t('concierge.state.unavailable_body');
  }
}

/** Configuration and billing faults are not fixed by tapping Retry. */
export function unavailableRetryable(code: string | null | undefined): boolean {
  return !['ai_not_configured', 'upstream_auth', 'ai_key_invalid', 'upstream_quota', 'ai_quota_exhausted', 'upstream_model', 'ai_model_unavailable'].includes(code ?? '');
}

export function localNoticeCopy(kind: 'offline' | 'error' | 'rate_limited' | 'daily_limit', t: TFunction): NoticeCopy {
  switch (kind) {
    case 'offline':
      return { title: t('concierge.state.offline_title'), body: t('concierge.state.offline_body'), retryable: true };
    case 'rate_limited':
      return { title: t('concierge.state.unavailable_title'), body: t('concierge.state.rate_limited'), retryable: true };
    case 'daily_limit':
      return { title: t('concierge.state.unavailable_title'), body: t('concierge.state.daily_limit'), retryable: false };
    default:
      return { title: t('concierge.state.unavailable_title'), body: t('concierge.state.unavailable_body'), retryable: true };
  }
}

export function errorKindToLocal(kind: ConciergeErrorKind): 'offline' | 'error' | 'rate_limited' | 'daily_limit' {
  if (kind === 'offline') return 'offline';
  if (kind === 'rate_limited') return 'rate_limited';
  if (kind === 'daily_limit') return 'daily_limit';
  return 'error';
}

/** "Sleep (whoop) · measured · a little old" */
export function describeSource(s: ConciergeSource, t: TFunction): string {
  const parts = [s.label, t(`concierge.provenance.${s.provenance}`), t(`concierge.freshness.${s.freshness}`)];
  return parts.filter(Boolean).join(' · ');
}

export function actionTitle(action: ConciergeAction, t: TFunction): string {
  switch (action.type) {
    case 'log_hydration':
      return t('concierge.action.log_hydration_title');
    case 'open_screen':
      return t('concierge.action.open_screen_title', { screen: t(`concierge.screen.${action.screen}`) });
    case 'start_checkin':
      return t('concierge.action.start_checkin_title');
    case 'set_reminder':
      return t('concierge.action.set_reminder_title');
  }
}

/** The exact details shown BEFORE confirmation — the member sees what will happen. */
export function actionDetail(action: ConciergeAction, t: TFunction): string {
  switch (action.type) {
    case 'log_hydration':
      return t('concierge.action.log_hydration_detail', { oz: action.oz });
    case 'open_screen':
      return t(`concierge.screen.${action.screen}`);
    case 'start_checkin':
      return t('concierge.action.start_checkin_detail');
    case 'set_reminder':
      return t('concierge.action.set_reminder_detail', {
        title: action.title,
        date: action.dateLocal,
        time: action.timeLocal,
        recurrence: t(`concierge.action.recurrence_${action.recurrence}`),
      });
  }
}

/** Speakable text for read-aloud: answer + next step, never the "why" or sources. */
export function speakableText(turn: ConciergeAssistantTurn): string {
  return [turn.answer, turn.nextStep].filter((x): x is string => Boolean(x && x.trim())).join(' ');
}

/** The composer seed for a contextual Ask entry. */
export function seedText(seed: string | undefined, t: TFunction): string {
  if (seed === 'hydration' || seed === 'signal' || seed === 'weekly') return t(`concierge.seed.${seed}`);
  return '';
}

/** "9:12 AM" in the member's locale; null when the stamp is not a real time (never a placeholder). */
export function formatTurnTime(iso: string | null | undefined, locale?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Headline / remainder of an answer — presentation only, the string is never
 * rewritten. The headline is the first sentence when it is short enough to
 * read as one; a terminator inside a number ("3.5") is not a sentence end.
 * Everything else stays body text, so a long answer is not shouted.
 */
export const HEADLINE_MAX_CHARS = 120;
export function splitAnswer(answer: string): { headline: string | null; rest: string } {
  const trimmed = answer.trim();
  const m = trimmed.match(/^[\s\S]+?[.!?](?=\s|$)/);
  const first = (m ? m[0] : trimmed).trim();
  if (first.length === 0 || first.length > HEADLINE_MAX_CHARS) return { headline: null, rest: trimmed };
  return { headline: first, rest: trimmed.slice(first.length).trim() };
}

/**
 * The context pill: ONLY fields the screen already passes to the concierge
 * (the same object a turn sends). Each segment appears when its source field
 * is present; nothing is defaulted. The HydroState reading appears only once
 * its evidence is ready — a building baseline is not shown as a number — and
 * "nothing logged today" is never stated as a segment (absence of logs is not
 * a body state).
 */
export function contextSegments(ctx: Pick<ConciergeClientContext, 'hydroState' | 'intake'>, t: TFunction): string[] {
  const out: string[] = [];
  const h = ctx.hydroState;
  if (h && h.evidence === 'ready') {
    out.push(t('concierge.context.state', { score: Math.round(h.score), level: t(`states.${h.level.toLowerCase()}`) }));
  }
  if (ctx.intake.loggedToday) {
    const oz = Math.round(ctx.intake.ozToday);
    const target = Math.round(ctx.intake.ozTarget);
    out.push(target > 0 ? t('concierge.context.intake', { oz, target }) : t('concierge.context.intake_logged', { oz }));
  }
  return out;
}

/** Up to three existing suggested questions for the "Ask next" row — the picked one first. */
export function askNextKeys<K extends string>(picked: K, all: readonly K[], max = 3): K[] {
  return [picked, ...all.filter((k) => k !== picked)].slice(0, max);
}
