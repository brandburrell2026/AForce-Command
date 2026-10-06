/**
 * AForce Concierge — composer. One-handed: input + a single 44pt send/stop
 * control at the thumb side. Cancel is always available while a request runs.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { af, afLayout, afType } from '@/theme';
import { Icon } from '@/components/Icon';
import { CONCIERGE_MAX_MESSAGE_CHARS } from '@/config/hydroStateModel';

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
  const inputRef = React.useRef<TextInput>(null);
  React.useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);
  const canSend = value.trim().length > 0 && !sending && !disabled;
  return (
    <View style={styles.wrap} testID={testID}>
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
      {value.length > CONCIERGE_MAX_MESSAGE_CHARS - 60 ? (
        <Text style={styles.counter} accessibilityLiveRegion="polite">
          {CONCIERGE_MAX_MESSAGE_CHARS - value.length}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: afLayout.screenPaddingX,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: af.canvas,
    borderTopWidth: afLayout.hairline,
    borderTopColor: af.divider,
  },
  input: {
    ...afType.body,
    flex: 1,
    color: af.textPrimary,
    minHeight: afLayout.controlMinHeight,
    maxHeight: 132,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
    backgroundColor: af.surface,
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
  counter: { position: 'absolute', right: afLayout.screenPaddingX + 56, top: -6, ...afType.caption, color: af.textTertiary },
});
