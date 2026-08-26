/**
 * SignalsZone — bottom-of-screen ambient signals stack:
 *   RiskTimerDisplay → WaterCycleBar → PhantomSignal → PhantomBandCard →
 *   HeatAlertBanner (when band !== STABLE) → SocialModeBanner (when active)
 *   → Social Mode entry tile.
 *
 * All cards inside are individually memoized and read only the slices
 * they need.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Icon } from '../Icon';
import { hapticSelection } from '@/services/haptics';
import { useTranslation } from 'react-i18next';

import { Colors } from '../../theme/colors';
import { RiskTimerDisplay } from '../RiskTimerDisplay';
import { WaterCycleBar } from '../WaterCycleBar';
import { PhantomSignal } from '../PhantomSignal';
import { PhantomBandCard } from '../PhantomBandCard';
import { RingStatusCard } from '../RingStatusCard';
import { HeatAlertBanner } from '../HeatAlertBanner';
import { SocialModeBanner } from '../SocialModeBanner';
import { useEngineSlice, useUserSlice, useTimerSlice, useSocialSlice, useFlagsSlice } from '../../store/slices';
import { isNightOutEnabled, nightOutInternalPreviewContext } from '@/services/nightOut/access';
import type { HeatRiskBand } from '../../types/heat';

interface Props {
  heatScore: { score: number; band: HeatRiskBand };
  onOpenSocial: () => void;
  /** When true, EntryActions are rendered above the signals (phone layout). */
  includeEntryActions?: boolean;
  entryActions?: React.ReactNode;
}

function Spacer() { return <View style={styles.spacer} />; }

function SignalsZoneImpl({ heatScore, onOpenSocial, includeEntryActions, entryActions }: Props) {
  const { t } = useTranslation();
  const engine = useEngineSlice();
  const userState = useUserSlice();
  const timer = useTimerSlice();
  const social = useSocialSlice();
  // Hardware (Phantom Band + AForce Ring) ships dark for v1 launch — these
  // surfaces only render when the flag is on (admin toggle in Profile, or
  // remote config in production).
  const flags = useFlagsSlice();
  const showHardwareSignals = flags.phantom_wearable_enabled;
  // NO-b: Night Out (formerly Social Mode) is Founder/Internal-Preview only
  // (NO-10). Its Home surfaces — the banner and the entry tile — render only
  // when authorized, so production / unauthorized users can neither see nor
  // enter Night Out from Home.
  const nightOutAuthorized = isNightOutEnabled(flags, nightOutInternalPreviewContext());

  return (
    <>
      {includeEntryActions && entryActions}
      {includeEntryActions && <Spacer />}
      <RiskTimerDisplay timerSeconds={timer.timerSeconds} performanceState={engine.performanceState} />
      <Spacer />
      <WaterCycleBar
        unitsConsumed={userState.unitsConsumedToday}
        dailyTarget={userState.dailyTarget}
        performanceState={engine.performanceState}
      />
      {showHardwareSignals && (
        <>
          <Spacer />
          <PhantomSignal />
          <Spacer />
          <PhantomBandCard />
          <Spacer />
          <RingStatusCard />
        </>
      )}
      {heatScore.band !== 'STABLE' && (
        <>
          <Spacer />
          <View testID="heat-alert-banner">
            <HeatAlertBanner score={heatScore.score} band={heatScore.band} />
          </View>
        </>
      )}
      {nightOutAuthorized && social && (
        <>
          <Spacer />
          <SocialModeBanner social={social} onPress={onOpenSocial} />
        </>
      )}
      {nightOutAuthorized && (
        <>
          <Spacer />
          <TouchableOpacity
            onPress={() => {
              if (Platform.OS !== 'web') hapticSelection();
              onOpenSocial();
            }}
            activeOpacity={0.85}
            style={[styles.socialEntry, { borderColor: '#9D7CFB55' }]}
            accessibilityRole="button"
            accessibilityLabel={t('social.entry_button')}
            testID="home-social-entry"
          >
            <Icon name="moon" size={16} color="#9D7CFB" />
            <Text style={styles.socialEntryText}>{t('social.entry_button')}</Text>
            <Icon name="chevron-right" size={16} color="#9D7CFB" />
          </TouchableOpacity>
        </>
      )}
    </>
  );
}

export const SignalsZone = React.memo(SignalsZoneImpl);

const styles = StyleSheet.create({
  spacer: { height: 12 },
  socialEntry: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: 14, borderWidth: 1,
    backgroundColor: 'rgba(157,124,251,0.06)',
  },
  socialEntryText: {
    flex: 1, fontSize: 13, fontFamily: 'Inter_700Bold',
    color: Colors.text.primary, letterSpacing: 1.2,
  },
});
