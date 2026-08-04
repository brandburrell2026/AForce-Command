/**
 * ZoomableProductImage.
 *
 * Drop-in replacement for <Image source={...} /> when the image is a
 * product photo and the user should be able to tap it to see a large
 * zoomed view. Tap the inline image to open a fullscreen lightbox; tap
 * anywhere on the dim backdrop (or hit the close X) to dismiss.
 *
 * Implementation notes:
 *  - Inline render is a Pressable wrapping the same <Image> the caller
 *    would have used. The press triggers a soft scale "tap feedback"
 *    (95%) before opening the modal so the touch always feels acknowledged.
 *  - The modal uses `presentationStyle="overFullScreen"` + a translucent
 *    backdrop so the product appears to lift out of the surface in place.
 *  - Reanimated drives a fade-in + scale-up curve on open and the inverse
 *    on close. No native modules beyond what the app already ships.
 *  - A subtle accent ring color can be passed in to match the product's
 *    flavor color so the zoomed card still feels in-brand.
 */

import React, { useState, useCallback } from 'react';
import {
  Pressable,
  Image,
  Modal,
  View,
  Text,
  StyleSheet,
  StyleProp,
  ImageStyle,
  ViewStyle,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Icon } from './Icon';
import * as Haptics from 'expo-haptics';

import { Colors } from '@/theme/colors';
import { afMotion } from '@/theme/afTokens';

interface Props {
  source: number | { uri: string };
  /** Style for the inline (small) thumbnail. Mirrors <Image style>. */
  style?: StyleProp<ImageStyle>;
  /** Container around the Pressable — useful when the caller already has a slot/border wrapper. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Resize mode for the inline thumbnail. Defaults to 'contain'. */
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  /** Optional accent color (used for the lightbox ring + close button). */
  accent?: string;
  /** Optional caption shown under the zoomed image. */
  caption?: string;
  /** Disable the zoom interaction entirely (renders a plain Image). */
  disabled?: boolean;
  /** Accessibility label for the tap target. */
  accessibilityLabel?: string;
  /** testID for the inline thumbnail Pressable. */
  testID?: string;
}

export function ZoomableProductImage({
  source,
  style,
  containerStyle,
  resizeMode = 'contain',
  accent = Colors.states.PEAK.primary,
  caption,
  disabled = false,
  accessibilityLabel,
  testID,
}: Props) {
  const [open, setOpen] = useState(false);
  const tapScale = useSharedValue(1);

  // Animation values for the modal content (fade + scale up).
  const modalOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.85);

  const { width: screenW, height: screenH } = useWindowDimensions();
  const imageBox = Math.min(screenW - 48, screenH - 220);

  const onPressIn = useCallback(() => {
    tapScale.value = withTiming(0.95, { duration: 90, easing: Easing.out(Easing.quad) });
  }, [tapScale]);

  const onPressOut = useCallback(() => {
    tapScale.value = withSpring(1, { damping: 14, stiffness: 220 });
  }, [tapScale]);

  const openLightbox = useCallback(() => {
    if (disabled) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    setOpen(true);
    // kick off the in-animation on the next frame so Modal mount has a chance.
    modalOpacity.value = 0;
    modalScale.value = 0.85;
    // ENTER (afMotion pattern #1): durations.standard + easing.standardOut,
    // was 180ms/Easing.out(cubic) — diff 40ms.
    modalOpacity.value = withTiming(1, { duration: afMotion.durations.standard, easing: Easing.bezier(...afMotion.easing.standardOut) });
    // Bespoke lightbox-pop spring (damping:16, stiffness:180) — not the
    // dominant sheet spring; left as-is (see PR body holdout list).
    modalScale.value = withSpring(1, { damping: 16, stiffness: 180 });
  }, [disabled, modalOpacity, modalScale]);

  const closeLightbox = useCallback(() => {
    // EXIT (afMotion pattern #2): durations.selection, was 160ms — diff 10ms.
    // Native Easing.in(cubic) kept — exits have no designated token easing.
    modalOpacity.value = withTiming(0, { duration: afMotion.durations.selection, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(setOpen)(false);
    });
    modalScale.value = withTiming(0.9, { duration: afMotion.durations.selection, easing: Easing.in(Easing.cubic) });
  }, [modalOpacity, modalScale]);

  const inlineAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tapScale.value }],
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
  }));

  const cardAnimStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  if (disabled) {
    return <Image source={source} style={style} resizeMode={resizeMode} />;
  }

  return (
    <>
      <Pressable
        onPress={openLightbox}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={containerStyle}
        accessibilityRole="imagebutton"
        accessibilityLabel={accessibilityLabel ?? 'Tap to zoom in on product image'}
        accessibilityHint="Opens a larger view of the product image"
        testID={testID}
      >
        <Animated.View style={[{ width: '100%', height: '100%' }, inlineAnimStyle]}>
          <Image source={source} style={style} resizeMode={resizeMode} />
        </Animated.View>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={closeLightbox}
        statusBarTranslucent
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropAnimStyle]}>
          {/* Tap-anywhere-to-close — covers the whole backdrop. */}
          <Pressable
            onPress={closeLightbox}
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close zoomed image"
          />

          {/* Image card — pointerEvents: 'box-none' so the close X stays tappable
              but the image area itself doesn't swallow the backdrop tap. */}
          <Animated.View
            pointerEvents="box-none"
            style={[styles.cardWrap, cardAnimStyle]}
          >
            <View
              style={[
                styles.imageCard,
                {
                  width: imageBox,
                  height: imageBox,
                  borderColor: `${accent}55`,
                  shadowColor: accent,
                },
              ]}
              pointerEvents="none"
            >
              <Image
                source={source}
                style={styles.fullImage}
                resizeMode="contain"
              />
            </View>

            {caption ? (
              <Text style={styles.caption} numberOfLines={2}>{caption}</Text>
            ) : null}

            <Pressable
              onPress={closeLightbox}
              style={({ pressed }) => [
                styles.closeBtn,
                { borderColor: `${accent}66`, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={16}
              accessibilityRole="button"
              accessibilityLabel="Close zoomed image"
              testID="zoom-close"
            >
              <Icon name="x" size={18} color={accent} />
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(2, 6, 18, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  imageCard: {
    backgroundColor: Colors.background.card,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Soft glow that picks up the accent color.
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  fullImage: { width: '100%', height: '100%' },
  caption: {
    marginTop: 16,
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.3,
    paddingHorizontal: 12,
  },
  closeBtn: {
    marginTop: 18,
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: Colors.fill.light,
  },
});
