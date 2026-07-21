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
} from '@/components/ui';

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
