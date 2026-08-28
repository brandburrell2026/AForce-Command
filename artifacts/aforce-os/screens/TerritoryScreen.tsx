/**
 * TerritoryScreen — the competition map, rendered over SAMPLE data.
 * Top: layer + scope toggles. Middle: stylized US map with region
 * markers. Below: selected region detail card, then active battles,
 * then trending regions.
 *
 * SAMPLE-TRUTH (PR-3, standing sample-data-caption ruling): every city/
 * state/team standing here comes from data/mockTerritoryData.ts via
 * mapAggregationService — illustrative, not a measurement of real
 * regions or people. The screen says so with the same canonical
 * disclosure the Circle standings carry (community.v3.sample_note);
 * the prior header copy framed this as a live map, which was false.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticSelection } from '@/services/haptics';

import { Colors } from '@/theme/colors';
import type { RegionKind, TerritoryLayer } from '@/types/territory';
import { getRegions, buildMarkers, getRegionById } from '@/services/mapAggregationService';
import { listBattles, supportSide } from '@/services/battleService';
import { useBattlesSubscription } from '@/hooks/useCircleSubscription';
import TerritoryMap from '@/components/TerritoryMap';
import MapLayerToggle from '@/components/MapLayerToggle';
import CityCard from '@/components/CityCard';
import BattleCard from '@/components/BattleCard';
import { emitTerritoryOpened, emitTerritoryEngaged } from '@/analytics/event_dispatcher';

const SCOPES: { id: RegionKind; label: string }[] = [
  { id: 'city',  label: 'CITY' },
  { id: 'state', label: 'STATE' },
  { id: 'team',  label: 'TEAM' },
];

// Spec #5 — restraint cap. We surface at most 3 featured battles on the
// Territory home so the rivalry shelf reads as a curated highlight, not a
// firehose. Additional battles still live in the service; this only gates
// the on-screen render.
const FEATURED_BATTLES_MAX = 3;

// Spec #4 — Territory Momentum bands. momentumScore is a signed -1..+1
// delta vs the prior period; raw numbers feel like a stock ticker, not a
// performance OS. We map to four semantic bands and let the label do the
// talking, keeping the raw delta as a muted secondary line for power users.
type MomentumTone = 'surging' | 'climbing' | 'holding' | 'cooling';
interface MomentumBand { label: string; tone: MomentumTone; color: string; }

function momentumBand(score: number): MomentumBand {
  if (score >=  0.25) return { label: 'SURGING',  tone: 'surging',  color: Colors.states.PEAK.primary };
  if (score >=  0.05) return { label: 'CLIMBING', tone: 'climbing', color: Colors.states.PEAK.primary };
  if (score >  -0.05) return { label: 'HOLDING',  tone: 'holding',  color: Colors.text.secondary };
  return                     { label: 'COOLING',  tone: 'cooling',  color: Colors.states.DEPLETED.primary };
}

export const TerritoryScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [scope, setScope] = React.useState<RegionKind>('city');
  const [layer, setLayer] = React.useState<TerritoryLayer>('territory');
  const [selectedId, setSelectedId] = React.useState<string | undefined>(undefined);
  // Subscribe to the battle store so support taps update scores immediately.
  const bv = useBattlesSubscription();

  const regions = React.useMemo(() => getRegions(scope), [scope]);
  const markers = React.useMemo(() => buildMarkers(regions, layer), [regions, layer]);
  const selected = selectedId ? getRegionById(selectedId) : regions[0];
  const battles = React.useMemo(
    () => listBattles().slice(0, FEATURED_BATTLES_MAX),
    [bv],
  );

  const trending = React.useMemo(
    () => [...regions].sort((a, b) => b.stats.momentumScore - a.stats.momentumScore).slice(0, 4),
    [regions],
  );

  // INTERNAL engagement telemetry (consent-gated inside emit). Territory is
  // gamified social, never a scoring surface, so these emits are display-only
  // and never touch a hydration point — they feed the founder Command Center.
  React.useEffect(() => {
    void emitTerritoryOpened();
  }, []);

  const onScope = (next: RegionKind) => {
    if (Platform.OS !== 'web') hapticSelection();
    setScope(next);
    setSelectedId(undefined);
  };

  // Inspecting a region (tapping a map marker or a trending row) is a real,
  // effectful engagement action; the stub Join / Challenge buttons are not.
  const handleSelectRegion = React.useCallback((regionId: string) => {
    setSelectedId(regionId);
    void emitTerritoryEngaged('region_selected');
  }, []);

  const handleSupport = (id: string, side: 'side1' | 'side2') => {
    supportSide(id, side);
    void emitTerritoryEngaged('battle_supported');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Back">
          <Icon name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.eyebrow}>AFORCE</Text>
          <Text style={styles.title}>PERFORMANCE MAP</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Sample-truth disclosure (standing sample-data-caption ruling).
            Everything below — map regions, ranks, participants, battles,
            trending momentum — derives from illustrative sample data, and
            the screen must say so before it says anything else. Same
            canonical string the Circle standings carry. */}
        <Text style={styles.sampleNote} testID="territory-sample-note">
          {t('community.v3.sample_note')}
        </Text>

        <View style={styles.section}>
          <View style={styles.scopeRow}>
            {SCOPES.map(s => {
              const active = scope === s.id;
              return (
                <Pressable
                  key={s.id} onPress={() => onScope(s.id)}
                  style={[styles.scopeBtn, active && styles.scopeBtnActive]}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.scopeText, active && styles.scopeTextActive]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <MapLayerToggle layer={layer} onChange={setLayer} />
        </View>

        <TerritoryMap
          regions={regions}
          markers={markers}
          selectedRegionId={selected?.regionId}
          onSelect={handleSelectRegion}
          height={300}
        />

        {selected && (
          <CityCard
            region={selected}
            onChallenge={() => { /* hook to openBattle later */ }}
            onJoin={() => { /* hook to join later */ }}
          />
        )}

        {battles.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FEATURED BATTLES</Text>
            <View style={styles.list}>
              {battles.map(b => (
                <BattleCard key={b.id} battle={b} onSupport={handleSupport} />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRENDING NOW</Text>
          <View style={styles.trendList}>
            {trending.map(r => {
              const band = momentumBand(r.stats.momentumScore);
              const signed = `${r.stats.momentumScore >= 0 ? '+' : ''}${(r.stats.momentumScore * 100).toFixed(0)}`;
              const iconName = band.tone === 'cooling'
                ? 'trending-down'
                : band.tone === 'holding' ? 'minus' : 'trending-up';
              return (
                <Pressable
                  key={r.regionId}
                  onPress={() => handleSelectRegion(r.regionId)}
                  style={({ pressed }) => [styles.trendRow, pressed && { opacity: 0.85 }]}
                  accessibilityLabel={`${r.name}, momentum ${band.label.toLowerCase()}, delta ${signed}`}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trendName}>{r.name}</Text>
                    <Text style={styles.trendMeta}>Rank #{r.rank} · {r.stats.participants.toLocaleString()} active</Text>
                  </View>
                  <Icon name={iconName} size={16} color={band.color} />
                  <View style={styles.trendBandWrap}>
                    <Text style={[styles.trendBandLabel, { color: band.color }]}>{band.label}</Text>
                    <Text style={styles.trendBandDelta}>{signed}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background.primary },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: Colors.text.muted, fontSize: 10, letterSpacing: 3, fontWeight: '600' },
  title: { color: Colors.text.primary, fontSize: 14, letterSpacing: 4, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  // Disclosure register — quiet, uncolored, unmistakably not a status.
  sampleNote: { color: Colors.text.muted, fontSize: 11, lineHeight: 15 },
  section: { gap: 10 },
  sectionLabel: { color: Colors.text.muted, fontSize: 11, letterSpacing: 3, fontWeight: '600' },
  scopeRow: { flexDirection: 'row', gap: 6 },
  scopeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border.medium, backgroundColor: Colors.fill.medium,
  },
  scopeBtnActive: { backgroundColor: Colors.text.primary, borderColor: Colors.text.primary },
  scopeText: { color: Colors.text.primary, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  scopeTextActive: { color: Colors.text.inverse },
  list: { gap: 12 },
  trendList: {
    backgroundColor: Colors.background.card, borderRadius: 16, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  trendRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border.subtle,
  },
  trendName: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
  trendMeta: { color: Colors.text.muted, fontSize: 11, marginTop: 2 },
  trendBandWrap: { minWidth: 64, alignItems: 'flex-end', gap: 1 },
  trendBandLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  trendBandDelta: { fontSize: 10, fontWeight: '500', color: Colors.text.muted, letterSpacing: 0.4 },
});

export default TerritoryScreen;
