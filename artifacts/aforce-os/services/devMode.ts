/**
 * Developer Mode — user-toggled flag.
 *
 * When on, the Social bottom-tab exposes the legacy Recovery/Cruise
 * screen (`/social-legacy`) alongside the production Social V2 screen.
 * When off, the legacy screen is reachable only via deep link and is
 * hidden from the tab bar.
 *
 * Persisted to AsyncStorage so toggling survives reloads. A tiny
 * module-level store + `useSyncExternalStore` exposes the value to
 * React without pulling in zustand or another global store.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@aforce/devMode';

let current = false;
const listeners = new Set<() => void>();
let hydrated = false;

function notify() {
  for (const l of listeners) l();
}

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw === '1' && !current) {
      current = true;
      notify();
    }
  } catch {
    /* ignore — defaults to off */
  }
}

void hydrate();

export function getDevMode(): boolean {
  return current;
}

export async function setDevMode(next: boolean): Promise<void> {
  if (current === next) return;
  current = next;
  notify();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0');
  } catch {
    /* non-fatal: state is still updated in memory */
  }
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function useDevMode(): boolean {
  return useSyncExternalStore(subscribe, getDevMode, getDevMode);
}
