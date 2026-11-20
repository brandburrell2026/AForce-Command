/**
 * Language picker — surfaces inside Profile → Settings.
 *
 * Lists the 6 MVP languages plus an "Auto (device)" option that
 * defers to whatever expo-localization detects. Persists selection
 * via the API client so reloads + other devices pick it up.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  LANGUAGE_LABELS,
  SUPPORTED_LANGUAGES,
  detectDeviceLanguage,
  setLanguage as setI18nLanguage,
  type SupportedLanguage,
} from '@/services/i18nService';
import { useAppStore } from '@/store/useAppStore';
import { af } from '@/theme';

interface LanguageSelectorProps {
  /** Persists the chosen language to the server (via the store). */
  onPersist?: (lang: SupportedLanguage) => Promise<void> | void;
}

type Option = { id: SupportedLanguage | 'auto'; label: string };

const OPTIONS: Option[] = [
  { id: 'auto', label: 'Auto' },
  ...SUPPORTED_LANGUAGES.map((id) => ({ id, label: LANGUAGE_LABELS[id] })),
];

export function LanguageSelector({ onPersist }: LanguageSelectorProps) {
  const { t, i18n } = useTranslation();
  const { setLanguage: setLanguageInStore } = useAppStore();
  const current = (i18n.language ?? 'en').slice(0, 2) as SupportedLanguage;
  const [pending, setPending] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');

  async function pick(opt: Option) {
    const resolved: SupportedLanguage = opt.id === 'auto' ? detectDeviceLanguage() : opt.id;
    setPending(opt.id);
    try {
      // Prefer the parent's persistence path (Profile passes the store
      // action). When no `onPersist` is provided we fall back to the
      // store directly — this keeps the component usable in isolation
      // without double-dispatching when a parent already wires it up.
      if (onPersist) {
        await setI18nLanguage(resolved);
        await onPersist(resolved);
      } else {
        await setLanguageInStore(resolved);
      }
      setStatus('saved');
    } catch {
      setStatus('failed');
    } finally {
      setPending(null);
      setTimeout(() => setStatus('idle'), 1800);
    }
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('settings.language_title')}</Text>
      <View style={styles.list}>
        {OPTIONS.map((opt) => {
          const isCurrent = opt.id !== 'auto' && opt.id === current;
          const isPending = pending === opt.id;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="button"
              accessibilityLabel={`${t('profile.language')}: ${opt.label}`}
              accessibilityState={{ selected: isCurrent }}
              onPress={() => pick(opt)}
              style={[
                styles.row,
                isCurrent && styles.rowActive,
                isPending && styles.rowPending,
              ]}>
              <Text style={[styles.rowLabel, isCurrent && styles.rowLabelActive]}>
                {opt.id === 'auto' ? `${opt.label} · ${t('profile.language_auto')}` : opt.label}
              </Text>
              {isCurrent && <Text style={styles.rowCheck}>✓</Text>}
            </Pressable>
          );
        })}
      </View>
      {status === 'saved' && <Text style={styles.statusOk}>{t('settings.language_saved')}</Text>}
      {status === 'failed' && <Text style={styles.statusBad}>{t('settings.language_failed')}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 12 },
  title: {
    fontFamily: 'IBMPlexMono_400Regular',
    color: af.textSecondary,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: af.canvasElevated,
    borderWidth: 1,
    borderColor: af.divider,
  },
  // Selected is a warm-white edge and a check, never a colour.
  rowActive: { borderColor: af.textPrimary },
  rowPending: { opacity: 0.6 },
  rowLabel: { fontFamily: 'Inter_400Regular', color: af.textPrimary, fontSize: 16 },
  rowLabelActive: { fontFamily: 'Inter_500Medium' },
  rowCheck: { color: af.textPrimary, fontSize: 18 },
  statusOk: { marginTop: 10, color: af.textSecondary, fontSize: 13 },
  statusBad: { marginTop: 10, color: af.redText, fontSize: 13 },
});
