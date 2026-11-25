/**
 * The AFORCE Live Activity, bound to the native module. The rule and the
 * step-keeping live in momentLiveActivitySync.ts (pure, tested).
 */
import { momentLiveActivityNative } from '@/modules/moment-live-activity';
import { createLiveActivitySync } from './momentLiveActivitySync';

const live = createLiveActivitySync(momentLiveActivityNative);

export const syncMomentLiveActivity = live.sync;
