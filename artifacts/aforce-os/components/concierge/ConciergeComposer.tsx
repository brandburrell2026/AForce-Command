/**
 * AForce Concierge — composer. One-handed: input + a single 44pt send/stop
 * control at the thumb side. Cancel is always available while a request runs.
 *
 * Black Issue: a hairline-bordered pill holds the input and a red circular
 * send button (44pt). There is deliberately NO microphone: speech recognition
 * is a stub and the concierge law lock forbids offering it, so the reference's
 * mic glyph is not drawn.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { CONCIERGE_MAX_MESSAGE_CHARS } from '@/config/hydroStateModel';
import { useAFGutter } from '@/hooks/useAFGutter';

export interface ConciergeComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
  disabled?: boolean;
  testID?: string;
}

export interface ConciergeComposerHandle {
  focus: () => void;
}

export const ConciergeComposer = React.forwardRef<ConciergeComposerHandle, ConciergeComposerProps>(function ConciergeComposer(
  { value, onChange, onSend, onCancel, sending, disabled, testID = 'concierge-composer' },
  ref,
) {
  const { t } = useTranslation();
  const gutter = useAFGutter();
  const inputRef = React.useRef<TextInput>(null);
  React.useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  const canSend = value.trim().length > 0 && !sending && !disabled;
  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]} testID={testID}>
      <View style={styles.pill}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={(v) => onChange(v.slice(0, CONCIERGE_MAX_MESSAGE_CHARS))}
          placeholder={t('concierge.composer_placeholder')}
          placeholderTextColor={af.textTertiary}
          style={styles.input}
          multiline
          maxLength={CONCIERGE_MAX_MESSAGE_CHARS}
          editable={!disabled}
          accessibilityLabel={t('concierge.composer_label')}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={() => canSend && onSend()}
          testID={`${testID}-input`}
        />
        {sending ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel={t('concierge.cancel_request')}
            style={[styles.btn, styles.stop]}
            hitSlop={6}
            testID={`${testID}-stop`}
          >
            <Icon name="square" size={16} color={af.textPrimary} />
          </Pressable>
        ) : (
          <Pressable
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('concierge.send')}
            accessibilityState={{ disabled: !canSend }}
            style={[styles.btn, canSend ? styles.send : styles.sendDisabled]}
            hitSlop={6}
            testID={`${testID}-send`}
          >
            <Icon name="arrow-up" size={18} color={canSend ? af.onRed : af.textTertiary} />
          </Pressable>
        )}
      </View>
      {value.length > CONCIERGE_MAX_MESSAGE_CHARS - 60 ? (
        <Text style={[styles.counter, { right: gutter + 56 }]} accessibilityLiveRegion="polite">
          {CONCIERGE_MAX_MESSAGE_CHARS - value.length}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: af.canvas,
  },
  // The reference's pill: hairline outline, input left, send flush right.
  pill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 18,
    paddingRight: 4,
    paddingVertical: 4,
    borderRadius: afLayout.radiusPill,
    borderWidth: afLayout.hairline,
    borderColor: af.borderStrong,
    backgroundColor: af.surface,
  },
  input: {
    ...afType.body,
    flex: 1,
    color: af.textPrimary,
    minHeight: afLayout.controlMinHeight,
    maxHeight: 132,
    paddingVertical: 10,
  },
  btn: {
    width: afLayout.controlMinHeight,
    height: afLayout.controlMinHeight,
    borderRadius: afLayout.controlMinHeight / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: { backgroundColor: af.red },
  sendDisabled: { backgroundColor: af.surfaceRaised },
  stop: { backgroundColor: af.surfaceRaised, borderWidth: afLayout.hairline, borderColor: af.borderStrong },
  counter: { position: 'absolute', top: -6, ...afType.caption, color: af.textTertiary },
});
