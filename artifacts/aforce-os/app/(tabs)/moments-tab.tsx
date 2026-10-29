import React from 'react';
import { Redirect } from 'expo-router';
import { EditorialMomentsScreen } from '@/components/editorial/moments/EditorialMomentsScreen';
import { useMomentsFirstExperience } from '@/hooks/useMomentsFirstExperience';

export default function MomentsTab() {
  const enabled = useMomentsFirstExperience();
  if (!enabled) return <Redirect href="/" />;
  return <EditorialMomentsScreen tabRoot />;
}
