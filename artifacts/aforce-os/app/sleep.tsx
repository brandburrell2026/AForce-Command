/**
 * Route wrapper for the Phase 1 Sleep Mode screen. Lives outside the
 * (tabs) group so we don't add an eighth bottom-tab — reached via the
 * Me / Profile tab entry instead. Gated by the `sleep_mode_enabled`
 * flag (internal: true, public: false).
 */
import SleepModeScreen from '@/screens/SleepModeScreen';

export default SleepModeScreen;
