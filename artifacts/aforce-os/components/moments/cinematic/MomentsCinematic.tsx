/**
 * MomentsCinematic — the Moments tab laid out as the approved prototype:
 *
 *   top row   mark + "Moments", the member photo
 *   hero      the live or next Moment: when, its name in 40pt, its state
 *   status    the one status line
 *   action    "Plan a Moment · say it" (warm white)
 *   lists     Upcoming, Done — hairline rows with a small state pill
 *   links     Calendar, Protocols
 *
 * Presentation only: every string and row arrives as a prop. The hero takes a
 * World photograph when one is licensed; today it is drawn on AFORCE Black.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AFMark } from '@/components/ui/AFMark';
import { af, AF_MAX_DISPLAY_FONT_SCALE } from '@/theme';
import type { MomentRowModel } from './momentsCinematicLogic';

export interface MomentsLink {
  title: string;
  sub: string;
  onPress: () => void;
  testID?: string;
}

export interface MomentsCinematicProps {
  profileEntry?: React.ReactNode;
  hero: { eyebrow: string; title: string; sub: string };
  onPressHero?: () => void;
  statusLine: { left: string; right: string } | null;
  planLabel: string;
  onPlan: () => void;
  upcoming: MomentRowModel[];
  done: MomentRowModel[];
  onPressRow: (id: string) => void;
  links: MomentsLink[];
  /** Anything the container keeps between the action and the lists (flag-gated entries). */
  children?: React.ReactNode;
}

function Row({ row, onPress, last, muted }: { row: MomentRowModel; onPress: () => void; last: boolean; muted?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}. ${row.sub}`}
      style={({ pressed }) => [styles.row, !last && styles.rowRuled, pressed && styles.pressed]}
      testID={`moments-row-${row.id}`}
    >
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, muted && styles.rowTitleMuted]}>{row.title}</Text>
        <Text style={styles.rowSub}>{row.sub}</Text>
      </View>
      {row.pill ? (
        <View style={[styles.pill, row.pill !== 'Plan' && styles.pillOk]}>
          <Text style={[styles.pillText, row.pill !== 'Plan' && styles.pillTextOk]}>{row.pill}</Text>
        </View>
      ) : (
        <Text style={styles.chev}>›</Text>
      )}
    </Pressable>
  );
}

export function MomentsCinematic(p: MomentsCinematicProps) {
  return (
    <View testID="moments-cinematic">
      <View style={styles.topRow}>
        <View style={styles.markRow}>
          <AFMark size={15} decorative />
          <Text style={styles.eyebrowBright}>MOMENTS</Text>
        </View>
        {p.profileEntry}
      </View>

      <Pressable
        onPress={p.onPressHero}
        disabled={!p.onPressHero}
        accessibilityRole={p.onPressHero ? 'button' : undefined}
        accessibilityLabel={`${p.hero.title}. ${p.hero.eyebrow}. ${p.hero.sub}`}
        style={styles.hero}
        testID="moments-hero"
      >
        <Text style={styles.eyebrowBright}>{p.hero.eyebrow.toUpperCase()}</Text>
        <Text accessibilityRole="header" style={styles.heroTitle} maxFontSizeMultiplier={AF_MAX_DISPLAY_FONT_SCALE}>
          {p.hero.title}
        </Text>
        <Text style={styles.heroSub}>{p.hero.sub}</Text>
      </Pressable>

      {p.statusLine ? (
        <View style={styles.statusLine}>
          <View style={styles.statusLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{p.statusLine.left.toUpperCase()}</Text>
          </View>
          <Text style={[styles.statusText, styles.statusRight]}>{p.statusLine.right.toUpperCase()}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={p.onPlan}
        accessibilityRole="button"
        accessibilityLabel={p.planLabel}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        testID="moments-plan"
      >
        <Text style={styles.primaryLabel}>{p.planLabel}</Text>
      </Pressable>

      {p.children}

      {p.upcoming.length > 0 ? (
        <>
          <Text style={styles.eyebrow}>UPCOMING</Text>
          <View style={styles.list}>
            {p.upcoming.map((r, i) => (
              <Row key={r.id} row={r} last={i === p.upcoming.length - 1} onPress={() => p.onPressRow(r.id)} />
            ))}
          </View>
        </>
      ) : (
        <View style={styles.emptyCard} testID="moments-empty">
          <Text style={styles.eyebrowCard}>NOTHING PLANNED YET</Text>
          <Text style={styles.emptyBody}>
            Sealed Moments show up here, then a one-question Replay after each one.
          </Text>
        </View>
      )}

      {p.done.length > 0 ? (
        <>
          <Text style={styles.eyebrow}>DONE</Text>
          <View style={styles.list}>
            {p.done.map((r, i) => (
              <Row key={r.id} row={r} muted last={i === p.done.length - 1} onPress={() => p.onPressRow(r.id)} />
            ))}
          </View>
        </>
      ) : null}

      {p.links.length > 0 ? (
        <View style={styles.linkCard}>
          {p.links.map((l, i) => (
            <Pressable
              key={l.title}
              onPress={l.onPress}
              accessibilityRole="button"
              accessibilityLabel={`${l.title}. ${l.sub}`}
              style={({ pressed }) => [styles.row, i < p.links.length - 1 && styles.rowRuled, pressed && styles.pressed]}
              testID={l.testID}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{l.title}</Text>
                <Text style={styles.rowSub}>{l.sub}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const MONO = 'IBMPlexMono_400Regular';

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrowBright: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textPrimary, opacity: 0.92 },
  eyebrow: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary, marginBottom: 6 },
  eyebrowCard: { fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: af.textSecondary },
  hero: { paddingTop: 44, paddingBottom: 30 },
  heroTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 40,
    lineHeight: 41,
    letterSpacing: -0.8,
    color: af.textPrimary,
    marginTop: 8,
  },
  heroSub: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: af.textPrimary, opacity: 0.92, marginTop: 8 },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.textTertiary },
  statusText: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.5, color: af.textSecondary },
  statusRight: { color: af.textPrimary },
  primary: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: af.primaryFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  primaryLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: af.onPrimaryFill },
  pressed: { opacity: 0.72 },
  list: { marginBottom: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8 },
  rowRuled: { borderBottomWidth: 1, borderBottomColor: af.divider },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: 'Inter_400Regular', fontSize: 15, color: af.textPrimary },
  rowTitleMuted: { color: af.textSecondary },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12.5, lineHeight: 17, color: af.textSecondary },
  pill: { borderWidth: 1, borderColor: af.border, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  pillOk: { borderColor: af.surfacePressed },
  pillText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: af.textSecondary },
  pillTextOk: { color: af.textPrimary },
  chev: { fontFamily: 'Inter_400Regular', fontSize: 20, color: af.textTertiary },
  emptyCard: {
    backgroundColor: af.surface,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: 20,
    padding: 18,
    gap: 8,
    marginBottom: 22,
  },
  emptyBody: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 20, color: af.textSecondary },
  linkCard: { backgroundColor: af.surface, borderWidth: 1, borderColor: af.border, borderRadius: 20, paddingHorizontal: 18 },
});
