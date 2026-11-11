/**
 * Travel Intelligence 2.0 — shareable arrival card + share sheet.
 *
 * ArrivalShareCard is the image itself: a fixed 9:16 story card with the
 * N–И mark, "Welcome to <city>", "New city. Same standard." and the AFORCE
 * footer. It renders ONLY an ArrivalSharePayload (utils/travel/arrivalShare),
 * which cannot hold a date, time, flight, origin, weather or health value.
 *
 * ArrivalShareSheet previews the card, states what is and is never on it,
 * and shares only when the member taps Share (SS-06: private by default).
 * The card is captured as a 1080×1920 PNG and handed to the existing share
 * service; if capture fails, the same words go out as text.
 */
import React from 'react';
import { ImageBackground, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';

import { PreparationMark } from '@/components/oneBreath/PreparationMark';
import { openShareSheet } from '@/services/shareService';
import { af, afLayout, afType } from '@/theme/afTokens';
import type { ArrivalSharePayload } from '@/utils/travel/arrivalShare';

export const ARRIVAL_CARD_W = 360;
export const ARRIVAL_CARD_H = 640;

function CardBody({ payload }: { payload: ArrivalSharePayload }) {
  return (
    <>
      <View style={card.top}>
        <PreparationMark size={22} />
      </View>
      <View style={card.bottom}>
        <Text style={card.eyebrow}>{payload.eyebrow.toUpperCase()}</Text>
        <Text style={card.city} numberOfLines={2}>{payload.cityName}</Text>
        <Text style={card.line}>{payload.line}</Text>
        <View style={card.footer}>
          <Text style={card.footerText}>AFORCE OS™</Text>
          <Text style={card.footerText}>
            PERFORMANCE IS <Text style={card.footerRed}>NON-NEGOTIABLE</Text>
          </Text>
        </View>
      </View>
    </>
  );
}

export function ArrivalShareCard({ payload }: { payload: ArrivalSharePayload }) {
  const label = `${payload.eyebrow} ${payload.cityName}. ${payload.line} AFORCE OS.`;
  if (payload.photoUri) {
    return (
      <ImageBackground
        testID="arrival-share-card"
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        source={{ uri: payload.photoUri }}
        style={[card.frame, { backgroundColor: payload.tone }]}
        imageStyle={card.photo}
      >
        <View style={card.scrim} pointerEvents="none" />
        <CardBody payload={payload} />
      </ImageBackground>
    );
  }
  return (
    <View
      testID="arrival-share-card"
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[card.frame, { backgroundColor: payload.tone }]}
    >
      <CardBody payload={payload} />
    </View>
  );
}

export function ArrivalShareSheet({
  payload,
  visible,
  onClose,
  share = openShareSheet,
}: {
  payload: ArrivalSharePayload;
  visible: boolean;
  onClose: () => void;
  /** Injected for tests; defaults to the app's share service. */
  share?: typeof openShareSheet;
}) {
  const shot = React.useRef<ViewShot>(null);
  const [busy, setBusy] = React.useState(false);

  const onShare = async () => {
    if (busy) return;
    setBusy(true);
    let imageUri: string | undefined;
    try {
      imageUri = await shot.current?.capture?.();
    } catch {
      imageUri = undefined; // text fallback below
    }
    try {
      const ok = await share({ format: 'story', message: payload.message, imageUri });
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType={Platform.OS === 'web' ? 'none' : 'slide'} onRequestClose={onClose} transparent={false}>
      <ScrollView style={sheet.root} contentContainerStyle={sheet.content}>
        <Text accessibilityRole="header" style={sheet.title}>Share your arrival</Text>
        <Text style={sheet.sub}>Only if you choose. Nothing leaves your phone until you pick where it goes.</Text>

        <View style={sheet.previewWrap}>
          <ViewShot
            ref={shot}
            options={{ format: 'png', quality: 0.95, result: 'tmpfile', width: 1080, height: 1920 }}
          >
            <ArrivalShareCard payload={payload} />
          </ViewShot>
        </View>

        <View style={sheet.card}>
          <View style={sheet.col}>
            <Text style={sheet.colHead}>ON THE CARD</Text>
            <Text style={sheet.on}>City name</Text>
            <Text style={sheet.on}>{payload.photoUri ? 'City photo' : 'City colour'}</Text>
            <Text style={sheet.on}>The AFORCE line</Text>
          </View>
          <View style={sheet.col}>
            <Text style={sheet.colHead}>NEVER ON IT</Text>
            <Text style={sheet.never}>Dates or times</Text>
            <Text style={sheet.never}>Flight or origin</Text>
            <Text style={sheet.never}>Health or hydration</Text>
          </View>
        </View>

        <View style={sheet.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void onShare()}
            style={[sheet.primary, busy && { opacity: 0.5 }]}
          >
            <Text style={sheet.primaryText}>Share</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={sheet.secondary}>
            <Text style={sheet.secondaryText}>Not now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Modal>
  );
}

const card = StyleSheet.create({
  frame: { width: ARRIVAL_CARD_W, height: ARRIVAL_CARD_H, overflow: 'hidden', justifyContent: 'space-between' },
  photo: { resizeMode: 'cover' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%', backgroundColor: af.canvasElevated, opacity: 0.72 },
  top: { padding: 24 },
  bottom: { padding: 24, gap: 10 },
  eyebrow: { ...afType.eyebrow, color: af.textPrimary },
  city: { fontFamily: 'Inter_600SemiBold', fontSize: 60, lineHeight: 62, letterSpacing: -2.2, color: af.textPrimary },
  line: { fontFamily: 'Inter_400Regular', fontSize: 19, lineHeight: 26, color: af.textPrimary },
  footer: { marginTop: 12, paddingTop: 14, borderTopWidth: 1, borderTopColor: af.divider, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { ...afType.micro, color: af.textSecondary },
  footerRed: { color: af.redText },
});

const sheet = StyleSheet.create({
  root: { flex: 1, backgroundColor: af.canvas },
  content: { padding: afLayout.screenPaddingXCompact, paddingTop: 56, gap: afLayout.cardGap },
  title: { ...afType.displayHero, fontSize: 32, lineHeight: 36, color: af.textPrimary },
  sub: { ...afType.secondary, color: af.textSecondary },
  previewWrap: { alignItems: 'center', marginVertical: 8, borderRadius: afLayout.radiusHero, overflow: 'hidden', alignSelf: 'center' },
  card: { flexDirection: 'row', gap: 16, backgroundColor: af.surface, borderWidth: afLayout.hairline, borderColor: af.border, borderRadius: afLayout.radiusCard, padding: afLayout.cardPadding },
  col: { flex: 1, gap: 6 },
  colHead: { ...afType.eyebrow, color: af.textSecondary },
  on: { ...afType.secondary, color: af.textPrimary },
  never: { ...afType.secondary, color: af.textSecondary },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primary: { flex: 1, minHeight: afLayout.buttonHeight, borderRadius: afLayout.radiusPill, backgroundColor: af.textPrimary, alignItems: 'center', justifyContent: 'center' },
  primaryText: { ...afType.bodyStrong, color: af.canvas },
  secondary: { minHeight: afLayout.buttonHeight, paddingHorizontal: 22, borderRadius: afLayout.radiusPill, borderWidth: afLayout.hairline, borderColor: af.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { ...afType.bodyStrong, color: af.textPrimary },
});
