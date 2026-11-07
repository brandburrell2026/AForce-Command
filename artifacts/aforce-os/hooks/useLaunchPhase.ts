import React from 'react';

export type LaunchPhase = 'opening' | 'welcome' | 'done';

/** A finished front door cannot be reopened by a late opening callback. */
export function useLaunchPhase(skip: boolean) {
  const [phase, setPhase] = React.useState<LaunchPhase>(skip ? 'done' : 'opening');
  const handleOpeningDone = React.useCallback(() => {
    setPhase((current) => current === 'opening' ? 'welcome' : current);
  }, []);
  const handleEntered = React.useCallback(() => setPhase('done'), []);
  return { phase, handleOpeningDone, handleEntered };
}
