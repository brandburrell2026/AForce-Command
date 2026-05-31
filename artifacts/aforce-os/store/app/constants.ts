import type { VoiceIntensity, VoiceScope } from '../../services/voice/commandVoice';

export const VOICE_COACH_KEY = 'aforce.voiceCoachEnabled';
export const SELECTED_VOICE_KEY = 'aforce.selectedVoiceId';
export const VOICE_INTENSITY_KEY = 'aforce.voiceIntensity';
export const VOICE_SCOPE_KEY = 'aforce.voiceScope';
export const NOTIFICATION_SETTINGS_KEY = 'aforce.notificationSettings';
export const UNIT_PREFERENCES_KEY = 'aforce.unitPreferences';
export const PROFILE_IDENTITY_KEY = 'aforce.profileIdentity';

export const VOICE_INTENSITIES: ReadonlySet<VoiceIntensity> = new Set(['calm', 'standard', 'pressure']);
export const VOICE_SCOPES: ReadonlySet<VoiceScope> = new Set(['all', 'risk', 'commands', 'muted']);
