/**
 * af.* primitive gallery — DEV-ONLY visual harness for F2/F3 (spec §16.3).
 * Renders every primitive with representative states so the design system can
 * be reviewed on-device. `__DEV__` is false in release builds, so this route
 * redirects home and never ships to customers.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { af, afType } from '@/theme';
import {
  AFScreen,
  AFCard,
  AFPrimaryButton,
  AFSecondaryButton,
  AFTextButton,
  AFMetric,
  AFReadinessArc,
  AFProgressRing,
  AFStatusBadge,
  AFSectionLabel,
  AFListRow,
  AFCommandCard,
  AFTimeline,
  AFChart,
  AFEmptyState,
  AFErrorState,
  AFDisclosureSheet,
  AFEditorialHero,
} from '@/components/ui';

const HERO = require('../assets/images/welcome-hero.png');

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.block}>
      <AFSectionLabel label={title} />
      <View style={styles.blockBody}>{children}</View>
    </View>
  );
}

export default function UIGallery() {
  if (!__DEV__) return <Redirect href="/" />;
  const [toggle, setToggle] = React.useState(true);
  const [sheet, setSheet] = React.useState(false);

  return (
    <AFScreen scroll>
      <Text style={styles.h1}>af.* primitives</Text>
      <Text style={styles.sub}>F2 · Primitives A — visual harness</Text>

      <Row title="Readiness arc">
        <AFReadinessArc score={72}>
          <Text style={styles.arcScore}>72</Text>
          <Text style={styles.arcLabel}>READINESS</Text>
        </AFReadinessArc>
      </Row>

      <Row title="Progress ring">
        <View style={styles.inline}>
          <AFProgressRing progress={0.38}>
            <Text style={styles.ringPct}>38%</Text>
          </AFProgressRing>
          <AFProgressRing progress={0.85} color={af.green}>
            <Text style={styles.ringPct}>85%</Text>
          </AFProgressRing>
        </View>
      </Row>

      <Row title="Metrics">
        <View style={styles.inline}>
          <AFMetric label="Recovery" value={46} unit="%" trendDelta={4} />
          <AFMetric label="Strain" value="8.9" trendDelta={-1.2} />
          <AFMetric label="Sleep" value="6.8" unit="h" timestamp="2h ago" />
        </View>
      </Row>

      <Row title="Status badges">
        <View style={styles.inline}>
          <AFStatusBadge label="Connected" tone="positive" />
          <AFStatusBadge label="Pending" tone="caution" />
          <AFStatusBadge label="Syncing" tone="info" />
          <AFStatusBadge label="Recovering" tone="critical" />
        </View>
      </Row>

      <Row title="Cards">
        <AFCard>
          <Text style={styles.cardText}>Standard card</Text>
        </AFCard>
        <View style={{ height: 12 }} />
        <AFCard variant="raised">
          <Text style={styles.cardText}>Raised card</Text>
        </AFCard>
        <View style={{ height: 12 }} />
        <AFCard variant="warning">
          <Text style={styles.cardText}>Warning card</Text>
        </AFCard>
      </Row>

      <Row title="List rows">
        <AFCard padded={false} style={styles.rowsCard}>
          <AFListRow icon="heart" title="Health data" value="Connected" disclosure onPress={() => {}} />
          <AFListRow icon="bell" title="Notifications" subtitle="Reminders + score changes" toggle={{ value: toggle, onValueChange: setToggle }} />
          <AFListRow icon="shield" title="Permissions" value="Manage" disclosure onPress={() => {}} />
        </AFCard>
      </Row>

      <Row title="Buttons">
        <AFPrimaryButton label="I've had the water" onPress={() => {}} icon="check" />
        <View style={{ height: 12 }} />
        <AFPrimaryButton label="Loading" onPress={() => {}} loading />
        <View style={{ height: 12 }} />
        <AFSecondaryButton label="Adjust command" onPress={() => {}} />
        <View style={{ height: 12 }} />
        <AFPrimaryButton label="Disabled" onPress={() => {}} disabled />
        <View style={{ height: 12 }} />
        <AFTextButton label="Why this command" onPress={() => {}} icon="chevron-up" />
      </Row>

      <Row title="Command card">
        <AFCommandCard
          title="Start with water"
          instruction="Drink 20 oz. Recheck in 15 minutes."
          primaryLabel="I've had the water"
          onPrimary={() => {}}
          secondaryLabel="Adjust command"
          onSecondary={() => {}}
          rationale="Recovery window is open. Ease in — 20 oz now keeps you ahead."
        />
      </Row>

      <Row title="Timeline">
        <AFTimeline
          steps={[
            { title: 'Hydrate now', subtitle: 'Drink 20 oz of water', state: 'current', meta: 'Now' },
            { title: 'Cool down', subtitle: '5 minutes · after hydration', state: 'upcoming' },
            { title: 'Recheck signals', subtitle: 'In 15 minutes', state: 'upcoming' },
            { title: 'Morning baseline', subtitle: 'Locked until tomorrow', state: 'locked' },
            { title: 'Warm-up', state: 'completed', meta: 'Done' },
          ]}
        />
      </Row>

      <Row title="Chart">
        <AFChart
          values={[40, 44, 55, 52, 68, 74, 90]}
          labels={['M', 'T', 'W', 'T', 'F', 'S', 'S']}
          summary="Weekly readiness rose from 40 to 90."
        />
      </Row>

      <Row title="Empty state">
        <AFCard>
          <AFEmptyState
            icon="inbox"
            title="No readings yet"
            message="Connect a device to start seeing your readiness trend."
            action={{ label: 'Connect a device', onPress: () => {} }}
          />
        </AFCard>
      </Row>

      <Row title="Error state (offline — neutral, not red)">
        <AFCard>
          <AFErrorState
            variant="offline"
            title="You're offline"
            message="Showing your last verified reading. We'll refresh when you reconnect."
            action={{ label: 'Retry', onPress: () => {} }}
          />
        </AFCard>
      </Row>

      <Row title="Disclosure sheet">
        <AFSecondaryButton label="Open disclosure sheet" onPress={() => setSheet(true)} />
      </Row>

      <Row title="Editorial hero">
        <AFEditorialHero
          source={HERO}
          height={340}
          eyebrow="Performance is non-negotiable"
          title="Built for people who don't get to be off."
          style={{ borderRadius: 24 }}
        >
          <AFPrimaryButton label="Begin setup" onPress={() => {}} />
        </AFEditorialHero>
      </Row>

      <AFDisclosureSheet visible={sheet} onClose={() => setSheet(false)} title="Why this command">
        <Text style={styles.cardText}>
          Your readiness is low and the recovery window is open. Water first stabilizes recovery
          before electrolytes or rest. We recheck in 15 minutes to confirm the next move.
        </Text>
      </AFDisclosureSheet>

      <View style={{ height: 48 }} />
    </AFScreen>
  );
}

const styles = StyleSheet.create({
  h1: { ...afType.title1, color: af.textPrimary, marginTop: 8 },
  sub: { ...afType.secondary, color: af.textTertiary, marginBottom: 24 },
  block: { marginBottom: 28 },
  blockBody: { marginTop: 12, gap: 0 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 },
  cardText: { ...afType.body, color: af.textPrimary },
  rowsCard: { paddingHorizontal: 16 },
  arcScore: { ...afType.displayScore, fontSize: 56, lineHeight: 60, color: af.textPrimary, fontVariant: ['tabular-nums'] },
  arcLabel: { ...afType.eyebrow, color: af.textTertiary },
  ringPct: { ...afType.bodyStrong, color: af.textPrimary, fontVariant: ['tabular-nums'] },
});
