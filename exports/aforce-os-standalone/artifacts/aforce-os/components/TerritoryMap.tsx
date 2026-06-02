/**
 * TerritoryMap — *stylized* competition map (the design language, not a
 * placeholder). AForce intentionally never renders a precise satellite or
 * street map: locations are aggregated to city/state/team buckets and shown
 * on an abstract 100x60 grid, projected through `react-native-svg` so it
 * renders identically on iOS / Android / web without a native maps dep.
 *
 * This is a privacy stance as much as a visual one — the user can see
 * relative competition energy across the country without anyone, including
 * AForce, ever needing exact GPS. If we ever introduce real cartography it
 * will be an additive opt-in layer; this stylized view stays as the default.
 */

import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Rect, G, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/theme/colors';
import type { TerritoryRegion, MapMarker } from '@/types/territory';

interface Props {
  regions: TerritoryRegion[];
  markers: MapMarker[];
  selectedRegionId?: string;
  onSelect: (regionId: string) => void;
  height?: number;
}

const GRID_W = 100;
const GRID_H = 60;

export const TerritoryMap: React.FC<Props> = ({
  regions, markers, selectedRegionId, onSelect, height = 280,
}) => {
  const markerByRegion = React.useMemo(() => {
    const m = new Map<string, MapMarker>();
    for (const x of markers) m.set(x.regionId, x);
    return m;
  }, [markers]);

  return (
    <View style={[styles.wrap, { height }]}>
      <View style={styles.badge} pointerEvents="none" accessibilityRole="text">
        <Text style={styles.badgeText}>STYLIZED VIEW · NO PRECISE LOCATION</Text>
      </View>
      <Svg width="100%" height="100%" viewBox={`0 0 ${GRID_W} ${GRID_H}`} preserveAspectRatio="xMidYMid meet">
        <Defs>
          <RadialGradient id="bgGlow" cx="50%" cy="50%" r="60%">
            <Stop offset="0%" stopColor={Colors.background.elevated} stopOpacity={1} />
            <Stop offset="100%" stopColor={Colors.background.primary} stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={GRID_W} height={GRID_H} fill="url(#bgGlow)" />

        {/* Subtle grid lines */}
        <G opacity={0.08}>
          {Array.from({ length: 11 }).map((_, i) => (
            <Rect key={`v-${i}`} x={(i * GRID_W) / 10} y={0} width={0.1} height={GRID_H} fill={Colors.text.primary} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <Rect key={`h-${i}`} x={0} y={(i * GRID_H) / 6} width={GRID_W} height={0.08} fill={Colors.text.primary} />
          ))}
        </G>

        {/* Region markers */}
        {regions.map((r) => {
          const m = markerByRegion.get(r.regionId);
          const color = m?.color ?? Colors.text.muted;
          const intensity = m?.intensity ?? 0.5;
          const cx = (r.position.x / 100) * GRID_W;
          const cy = (r.position.y / 100) * GRID_H;
          const baseR = Math.max(1.5, r.radius * 0.6);
          const isSel = selectedRegionId === r.regionId;
          return (
            <G key={r.regionId} opacity={intensity}>
              <Circle cx={cx} cy={cy} r={baseR * 2.4} fill={color} opacity={0.12} />
              <Circle cx={cx} cy={cy} r={baseR * 1.4} fill={color} opacity={0.30} />
              <Circle cx={cx} cy={cy} r={baseR}       fill={color} />
              {isSel && (
                <Circle cx={cx} cy={cy} r={baseR + 1.2} stroke={Colors.text.primary} strokeWidth={0.25} fill="none" />
              )}
              {m?.label && (
                <SvgText
                  x={cx}
                  y={cy - baseR - 1.5}
                  fill={Colors.text.primary}
                  fontSize={2.2}
                  fontWeight="600"
                  textAnchor="middle"
                  opacity={0.9}
                >
                  {m.label}
                </SvgText>
              )}
            </G>
          );
        })}
      </Svg>

      {/* Touch overlay — Pressables positioned per-region.
       *
       * Critical: position.x/y are already 0..100 in mock data, and the
       * SVG side projects them via `(value / 100) * GRID_*`. The Pressable
       * overlay is sized to the View's full bounds, so we must use the
       * same 0..100 percentage directly — *not* divide by GRID_H, which
       * would push southern markers (y > 60) off-screen and misalign all
       * other tap targets vs their visual circles.
       */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {regions.map(r => {
          const leftPct = r.position.x;     // 0..100
          const topPct  = r.position.y;     // 0..100, same basis as x
          const tapSize = Math.max(36, r.radius * 8);
          return (
            <Pressable
              key={`tap-${r.regionId}`}
              onPress={() => onSelect(r.regionId)}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, rank ${r.rank}`}
              style={[
                styles.tap,
                {
                  left:   `${leftPct}%`,
                  top:    `${topPct}%`,
                  width:  tapSize,
                  height: tapSize,
                  marginLeft: -tapSize / 2,
                  marginTop:  -tapSize / 2,
                },
              ]}
            >
              <Text accessibilityElementsHidden style={{ width: 0, height: 0 }} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border.subtle,
    backgroundColor: Colors.background.card,
  },
  tap: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', top: 10, left: 12, zIndex: 2,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
    borderWidth: 1, borderColor: Colors.border.medium,
    backgroundColor: `${Colors.background.primary}cc`,
  },
  badgeText: {
    color: Colors.text.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '700',
  },
});

export default TerritoryMap;
