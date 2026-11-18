/** Route name remains for deep-link compatibility; the member surface is Circle. */
import { CircleScreenV4 } from '@/components/community/CircleScreenV4';
import { ScreenErrorBoundary } from '@/components/ScreenErrorBoundary';
// SS-18: a render crash here must not blank the whole app.
export default function CommunityRoute() {
  return (
    <ScreenErrorBoundary screen="circle">
      <CircleScreenV4 />
    </ScreenErrorBoundary>
  );
}
