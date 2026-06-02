/**
 * Sleep tab — promoted from a standalone root route into the tab
 * navigator. With 8 triggers, iOS NativeTabs auto-overflows the
 * lowest-priority entries into the system "More" menu (matches the
 * Community / Social / Profile list shown to the user).
 *
 * The route file is intentionally a thin re-export of the existing
 * screen so deep links to `/sleep` keep working and the screen
 * implementation stays in one place.
 */
import SleepModeScreen from '@/screens/SleepModeScreen';

export default SleepModeScreen;
