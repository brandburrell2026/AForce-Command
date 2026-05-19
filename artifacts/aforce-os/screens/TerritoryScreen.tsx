/**
 * TerritoryScreen — live competition map. Top: layer + scope toggles.
 * Middle: stylized US map with region markers. Below: selected region
 * detail card, then active battles, then trending regions.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform } from 'react-native';
import { Icon } from '../components/Icon';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import type { RegionKind, TerritoryLayer } from '@/types/territory';
import { getRegions, buildMarkers, getRegionById } from '@/services/mapAggregationService';
import { listBattles, supportSide } from '@/services/battleService';
import { useBattlesSubscription } from '@/hooks/useCircleSubscription';
import TerritoryMap from '@/components/TerritoryMap';
import MapLayerToggle from '@/components/MapLayerToggle';
import CityCard from '@/components/CityCard';
import BattleCard from '@/components/BattleCard';

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

export const TerritoryScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const onScope = (next: RegionKind) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setScope(next);
    setSelectedId(undefined);
  };

  const handleSupport = (id: string, side: 'side1' | 'side2') => {
    supportSide(id, side);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={12} accessibilityLabel="Back">
          <Icon name="chevron-left" size={22} color={Colors.text.primary} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.eyebrow}>AFORCE</Text>
          <Text style={styles.title}>TERRITORY</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
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
          onSelect={setSelectedId}
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
            {trending.map(r => (
              <Pressable
                key={r.regionId}
                onPress={() => setSelectedId(r.regionId)}
                style={({ pressed }) => [styles.trendRow, pressed && { opacity: 0.85 }]}
                accessibilityLabel={`${r.name}, momentum ${r.stats.momentumScore.toFixed(2)}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.trendName}>{r.name}</Text>
                  <Text style={styles.trendMeta}>Rank #{r.rank} · {r.stats.participants.toLocaleString()} active</Text>
                </View>
                <Icon
                  name={r.stats.momentumScore >= 0 ? 'trending-up' : 'trending-down'}
                  size={16}
                  color={r.stats.momentumScore >= 0 ? Colors.states.PEAK.primary : Colors.states.DEPLETED.primary}
                />
                <Text style={[
                  styles.trendDelta,
                  { color: r.stats.momentumScore >= 0 ? Colors.states.PEAK.primary : Colors.states.DEPLETED.primary },
                ]}>
                  {r.stats.momentumScore >= 0 ? '+' : ''}{(r.stats.momentumScore * 100).toFixed(0)}
                </Text>
              </Pressable>
            ))}
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
  trendDelta: { fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'right' },
});

export default TerritoryScreen;
