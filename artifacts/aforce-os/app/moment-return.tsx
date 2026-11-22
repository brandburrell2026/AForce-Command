/**
 * /moment-return — where a tap on the AFORCE mark (Dynamic Island or Lock
 * Screen) lands. It shows nothing of its own; it decides where to go:
 *
 *   signed out            → sign in, then back here
 *   a Moment is locked in → One Breath, which opens that Moment as it is now (Quiet)
 *   otherwise             → Moments (the Moment ended, or is not on this phone)
 */
import React from 'react';
import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { hydrateMoments, useMomentsStore } from '@/services/momentsStore';
import { rememberMomentReturn, takeMomentReturn } from '@/services/momentReturn';
import { momentReturnRoute } from '@/utils/oneBreath/liveActivity';
import { af } from '@/theme';

const Blank = () => <View style={{ flex: 1, backgroundColor: af.canvas }} />;

export default function MomentReturnRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  const store = useMomentsStore();

  React.useEffect(() => {
    if (isSignedIn && !store.hydrated) void hydrateMoments();
  }, [isSignedIn, store.hydrated]);

  if (!isLoaded) return <Blank />;
  if (!isSignedIn) {
    rememberMomentReturn();
    return <Redirect href={'/(auth)/sign-in' as never} />;
  }
  if (!store.hydrated) return <Blank />;
  takeMomentReturn();
  return <Redirect href={momentReturnRoute(store.moments, Date.now()) as never} />;
}
