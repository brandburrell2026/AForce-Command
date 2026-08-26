/**
 * Share Preview screen — pick a voice, pick a format, pick a line, share.
 *
 * Sharing in AForce is identity, not data. The user picks a VOICE
 * (STATUS / ACTION / IDENTITY) which drives the dominant headline on
 * the card. The legacy `type` query param still feeds in (e.g. score,
 * state, streak) — it determines the live context that subtext draws
 * from.
 *
 * Reachable as the route `/share`. Reads share context from query params:
 *   /share?type=score&score=88&state=Balanced
 *   /share?type=streak&streakDays=7
 *   /share?voice=identity
 */

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Platform,
} from 'react-native';
import { Icon, type IconName } from '../components/Icon';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticNotify, hapticSelection } from '@/services/haptics';
import ViewShot from 'react-native-view-shot';

import { Colors } from '@/theme/colors';
import { useAppStore } from '@/store/useAppStore';

import type {
  ShareContext, ShareFormat, ShareType, ShareVoice, StateLabel,
} from '@/types/share';
import {
  generateBroadcasts, defaultVoice, broadcastToMessage,
} from '@/services/shareBroadcastEngine';
import { openShareSheet, shareToSocial, buildShareItem, type SocialPlatform } from '@/services/shareService';
import ShareCard from '@/components/ShareCard';
import ShareStory from '@/components/ShareStory';
import ShareText from '@/components/ShareText';
import ShareJournalRecap from '@/components/ShareJournalRecap';
import {
  readJournalShare,
  type JournalSharePayload,
} from '@/services/journalShareCache';

const BASE_FORMATS: { id: ShareFormat; label: string; icon: IconName }[] = [
  { id: 'card',  label: 'CARD',  icon: 'square'    },
  { id: 'story', label: 'STORY', icon: 'smartphone' },
  { id: 'text',  label: 'TEXT',  icon: 'type'      },
];
const RECAP_FORMAT: { id: ShareFormat; label: string; icon: IconName } = {
  id: 'recap', label: 'RECAP', icon: 'bar-chart-2',
};

const VOICES: { id: ShareVoice; label: string; tagline: string }[] = [
  { id: 'status',   label: 'STATUS',   tagline: 'System state' },
  { id: 'action',   label: 'ACTION',   tagline: 'Proof in motion' },
  { id: 'identity', label: 'IDENTITY', tagline: 'How I run' },
];

function levelToStateLabel(level: string): StateLabel {
  switch (level) {
    case 'PEAK':       return 'Peak';
    case 'RECOVERING': return 'Recovering';
    case 'DEPLETED':   return 'Depleted';
    default:           return 'Balanced';
  }
}

function readParam(params: Record<string, string | string[] | undefined>, k: string): string | undefined {
  const v = params[k];
  return Array.isArray(v) ? v[0] : v;
}

// Allowlists keep raw query params from poisoning the engine. Anything
// outside the union falls through to the safe fallback.
const VALID_TYPES: ReadonlySet<ShareType> = new Set([
  'score', 'state', 'gain', 'streak', 'protocol', 'rank', 'heat_save', 'command', 'reset',
]);
const VALID_STATES: ReadonlySet<StateLabel> = new Set(['Peak', 'Balanced', 'Recovering', 'Depleted']);
const VALID_VOICES: ReadonlySet<ShareVoice> = new Set(['status', 'action', 'identity']);

function asType(v: string | undefined): ShareType | undefined {
  return v && VALID_TYPES.has(v as ShareType) ? (v as ShareType) : undefined;
}
function asState(v: string | undefined): StateLabel | undefined {
  return v && VALID_STATES.has(v as StateLabel) ? (v as StateLabel) : undefined;
}
function asVoice(v: string | undefined): ShareVoice | undefined {
  return v && VALID_VOICES.has(v as ShareVoice) ? (v as ShareVoice) : undefined;
}

function parseContext(
  params: Record<string, string | string[] | undefined>,
  fallback: ShareContext,
): ShareContext {
  const type = asType(readParam(params, 'type')) ?? fallback.type;
  const scoreRaw = readParam(params, 'score');
  const deltaRaw = readParam(params, 'delta');
  const streakRaw = readParam(params, 'streakDays');
  const score = scoreRaw != null ? Number(scoreRaw) : fallback.score;
  const delta = deltaRaw != null ? Number(deltaRaw) : undefined;
  const streakDays = streakRaw != null ? Number(streakRaw) : undefined;
  return {
    type,
    score: Number.isFinite(score) ? score : fallback.score,
    state: asState(readParam(params, 'state')) ?? fallback.state,
    delta: Number.isFinite(delta) ? delta : undefined,
    streakDays: Number.isFinite(streakDays) ? streakDays : undefined,
    rankLabel: readParam(params, 'rankLabel'),
    protocolLabel: readParam(params, 'protocolLabel'),
    voice: asVoice(readParam(params, 'voice')),
  };
}

export const SharePreviewScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { state } = useAppStore();
  const { performanceState, score: liveScore } = state.engineOutput;

  // Default: share the current performance score / state.
  const fallbackContext: ShareContext = React.useMemo(() => ({
    type: 'score',
    score: liveScore,
    state: levelToStateLabel(performanceState.level),
  }), [liveScore, performanceState.level]);

  const ctx = React.useMemo(() => parseContext(params, fallbackContext), [params, fallbackContext]);

  // Voice: explicit param wins; otherwise auto-pick a sensible default
  // for the live context. User can override via the VOICE picker.
  const [voice, setVoice] = React.useState<ShareVoice>(() => ctx.voice ?? defaultVoice(ctx));

  const broadcasts = React.useMemo(() => generateBroadcasts(voice, ctx), [voice, ctx]);
  const [variantIdx, setVariantIdx] = React.useState(0);
  // Journal payload is read once on mount. When present we expose the
  // RECAP format option AND default the picker to it, so a user who
  // taps "Share to Social" on the Journal screen lands on a card that
  // shows their actual chart + stats — not a generic identity headline.
  const [journalPayload] = React.useState<JournalSharePayload | null>(() => readJournalShare());
  const formats = React.useMemo(
    () => (journalPayload ? [RECAP_FORMAT, ...BASE_FORMATS] : BASE_FORMATS),
    [journalPayload],
  );
  const [format, setFormat] = React.useState<ShareFormat>(journalPayload ? 'recap' : 'card');
  const [sharing, setSharing] = React.useState(false);

  // The cache self-expires via TTL (see journalShareCache.ts), which
  // both prevents stale recap data leaking into an unrelated /share
  // visit hours later AND survives the React 18 StrictMode dev
  // double-mount that would otherwise wipe the payload between mounts.
  // Wraps the visual preview so we can snapshot it as a PNG for image
  // shares (Instagram, FB, Messages, etc.). Text format skips capture.
  const previewRef = React.useRef<ViewShot>(null);

  // Reset variant index if voice/context changes and the index is out of range.
  React.useEffect(() => {
    if (variantIdx >= broadcasts.length) setVariantIdx(0);
  }, [broadcasts, variantIdx]);

  const broadcast = broadcasts[variantIdx] ?? broadcasts[0];
  const message = broadcast ? broadcastToMessage(broadcast) : '';

  /**
   * Single dispatch path for every share button on this screen.
   *
   * Passing `platform` routes through `shareToSocial` (deep-link / web
   * intent) for X / Facebook / LinkedIn / WhatsApp / Telegram / SMS.
   * Instagram + the default "More" button fall through to the OS share
   * sheet — Instagram because IG only accepts image/video payloads via
   * deep link, "More" because that's the user's intent.
   */
  const dispatchShare = async (platform: SocialPlatform = 'system') => {
    if (!message || sharing) return;
    setSharing(true);
    if (Platform.OS !== 'web') hapticSelection();

    // Snapshot the visual preview for card/story formats so the share
    // includes the actual image — required for Instagram, and a much
    // better experience on every other network (richer post, no plain
    // text). Text format keeps the original text-only path.
    let imageUri: string | undefined;
    if (format !== 'text' && previewRef.current?.capture) {
      try {
        imageUri = await previewRef.current.capture();
      } catch {
        // Capture failed — gracefully fall back to text-only share
        imageUri = undefined;
      }
    }

    const opts = { format, message, imageUri };
    const ok = platform === 'system'
      ? await openShareSheet(opts)
      : await shareToSocial(platform, opts);
    if (ok) {
      buildShareItem(format, message, ctx); // local record; server event TBD
      if (Platform.OS !== 'web') {
        hapticNotify('success');
      }
    }
    setSharing(false);
  };

  const onShare = () => dispatchShare('system');

  /**
   * Quick-share targets surfaced as a horizontal row of icons.
   * Order is the most-requested-first list (X / IG / FB are the top three
   * for share-to-social on consumer apps, then messengers).
   */
  const SOCIAL_TARGETS: ReadonlyArray<{
    id: SocialPlatform;
    label: string;
    icon: IconName;
    tint: string;
  }> = [
    { id: 'x',         label: 'X',         icon: 'twitter',          tint: '#FFFFFF' },
    { id: 'instagram', label: 'Instagram', icon: 'instagram',        tint: '#E1306C' },
    { id: 'facebook',  label: 'Facebook',  icon: 'facebook',         tint: '#1877F2' },
    { id: 'linkedin',  label: 'LinkedIn',  icon: 'linkedin',         tint: '#0A66C2' },
    { id: 'whatsapp',  label: 'WhatsApp',  icon: 'message-circle',   tint: '#25D366' },
    { id: 'telegram',  label: 'Telegram',  icon: 'send',             tint: '#26A5E4' },
    { id: 'sms',       label: 'Messages',  icon: 'message-square',   tint: Colors.text.primary },
    { id: 'system',    label: 'More',      icon: 'more-horizontal',  tint: Colors.text.primary },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconBtn}
          hitSlop={12}
          accessibilityLabel="Close share preview"
        >
          <Icon name="x" size={20} color={Colors.text.primary} />
        </Pressable>
        <Text style={styles.title}>SHARE</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewWrap}>
          {/*
            ViewShot wraps the live preview so we can snapshot it as a
            PNG when the user taps share. options.result='tmpfile' yields
            a file:// URI on native (consumable by expo-sharing) and a
            data: URI on web (consumable by the Web Share API or download
            fallback). Skipped at capture time when format === 'text'.
          */}
          <ViewShot
            ref={previewRef}
            options={{ format: 'png', quality: 0.95, result: 'tmpfile' }}
          >
            {format === 'card'  && broadcast && <ShareCard  broadcast={broadcast} context={ctx} />}
            {format === 'story' && broadcast && <ShareStory broadcast={broadcast} context={ctx} />}
            {format === 'text'  && broadcast && <ShareText  broadcast={broadcast} />}
            {format === 'recap' && journalPayload && (
              <ShareJournalRecap
                rollups={journalPayload.rollups}
                rangeDays={journalPayload.rangeDays}
              />
            )}
          </ViewShot>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VOICE</Text>
          <View style={styles.voiceRow}>
            {VOICES.map((v) => {
              const active = v.id === voice;
              return (
                <Pressable
                  key={v.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') hapticSelection();
                    setVoice(v.id);
                    setVariantIdx(0);
                  }}
                  style={[styles.voiceBtn, active && styles.voiceBtnActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`${v.label} voice — ${v.tagline}`}
                  accessibilityState={{ selected: active }}
                  testID={`voice-${v.id}`}
                >
                  <Text style={[styles.voiceLabel, active && styles.voiceLabelActive]}>
                    {v.label}
                  </Text>
                  <Text style={[styles.voiceTagline, active && styles.voiceTaglineActive]}>
                    {v.tagline}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SHARE TO</Text>
          {/*
            One-tap social targets. Each opens that network's share intent
            (or the OS share sheet for Instagram + "More"). The row is
            horizontally scrollable so we never have to drop a platform on
            narrow phones — the visible quartet is always the highest-
            priority targets (X · Instagram · Facebook · LinkedIn).
          */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.socialRow}
          >
            {SOCIAL_TARGETS.map((target) => (
              <Pressable
                key={target.id}
                onPress={() => dispatchShare(target.id)}
                disabled={sharing}
                style={({ pressed }) => [
                  styles.socialBtn,
                  pressed && !sharing && { opacity: 0.85 },
                  sharing && { opacity: 0.5 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Share to ${target.label}`}
                testID={`share-to-${target.id}`}
              >
                <View style={[styles.socialIconCircle, { borderColor: `${target.tint}55` }]}>
                  <Icon name={target.icon} size={18} color={target.tint} />
                </View>
                <Text style={styles.socialLabel} numberOfLines={1}>{target.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FORMAT</Text>
          <View style={styles.formatRow}>
            {formats.map((f) => {
              const active = f.id === format;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') hapticSelection();
                    setFormat(f.id);
                  }}
                  style={[styles.formatBtn, active && styles.formatBtnActive]}
                  accessibilityLabel={`${f.label} format`}
                  accessibilityState={{ selected: active }}
                >
                  <Icon name={f.icon} size={14} color={active ? Colors.text.inverse : Colors.text.primary} />
                  <Text style={[styles.formatBtnText, active && styles.formatBtnTextActive]}>
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MESSAGE</Text>
          <View style={styles.variantsCol}>
            {broadcasts.map((b, i) => {
              const active = i === variantIdx;
              const preview = b.subtext ? `${b.headline} ${b.subtext}` : b.headline;
              return (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    if (Platform.OS !== 'web') hapticSelection();
                    setVariantIdx(i);
                  }}
                  style={[styles.variantBtn, active && styles.variantBtnActive]}
                  accessibilityLabel={`Message option ${i + 1}: ${preview}`}
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.radio, active && styles.radioActive]} />
                  <View style={styles.variantTextWrap}>
                    <Text style={styles.variantHeadline} numberOfLines={2}>{b.headline}</Text>
                    {b.subtext ? (
                      <Text style={styles.variantSubtext} numberOfLines={1}>{b.subtext}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={onShare}
          disabled={sharing}
          style={({ pressed }) => [
            styles.cta,
            (pressed || sharing) && styles.ctaPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Open share sheet"
        >
          <Icon name="share" size={16} color={Colors.text.inverse} />
          <Text style={styles.ctaText}>{sharing ? 'OPENING…' : 'SHARE'}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 18,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text.primary,
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },
  previewWrap: { marginTop: 4 },
  section: { gap: 10 },
  sectionLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
  },
  voiceRow: { flexDirection: 'row', gap: 8 },
  voiceBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
    alignItems: 'center',
    gap: 4,
  },
  voiceBtnActive: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  voiceLabel: {
    color: Colors.text.primary,
    fontSize: 12,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  voiceLabelActive: { color: Colors.text.inverse },
  voiceTagline: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: '500',
  },
  voiceTaglineActive: { color: Colors.text.inverse, opacity: 0.7 },
  socialRow: { flexDirection: 'row', gap: 14, paddingVertical: 4, paddingRight: 8 },
  socialBtn: { alignItems: 'center', gap: 6, width: 64 },
  socialIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: Colors.fill.light,
  },
  socialLabel: {
    color: Colors.text.muted,
    fontSize: 10,
    letterSpacing: 0.6,
    fontWeight: '600',
    textAlign: 'center',
  },
  formatRow: { flexDirection: 'row', gap: 8 },
  formatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  formatBtnActive: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  formatBtnText: {
    color: Colors.text.primary,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
  },
  formatBtnTextActive: { color: Colors.text.inverse },
  variantsCol: { gap: 8 },
  variantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    backgroundColor: Colors.fill.medium,
  },
  variantBtnActive: {
    borderColor: Colors.border.strong,
    backgroundColor: Colors.fill.strong,
  },
  radio: {
    width: 14, height: 14, borderRadius: 7,
    borderWidth: 1, borderColor: Colors.border.strong,
  },
  radioActive: {
    backgroundColor: Colors.text.primary,
    borderColor: Colors.text.primary,
  },
  variantTextWrap: { flex: 1, gap: 2 },
  variantHeadline: {
    color: Colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  variantSubtext: {
    color: Colors.text.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.background.primary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.text.primary,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: {
    color: Colors.text.inverse,
    fontSize: 13,
    letterSpacing: 3,
    fontWeight: '700',
  },
});

export default SharePreviewScreen;
