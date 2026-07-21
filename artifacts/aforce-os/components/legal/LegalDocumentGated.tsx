/**
 * LegalDocumentGated — drop-in for the shared LegalDocumentScreen that renders
 * the Phase 3 af.* reskin when `spec_legal` is on, else the untouched legacy
 * chrome. Legal COPY is identical in both (compliance) — chrome only.
 */
import { LegalDocumentScreen as LegacyLegalDocumentScreen, type LegalSection } from '@/components/LegalDocumentScreen';
import { LegalDocumentScreenV2 } from '@/components/legal/LegalDocumentScreenV2';
import { useAppStore } from '@/store/useAppStore';

export type { LegalSection };

export function LegalDocumentScreen(props: React.ComponentProps<typeof LegacyLegalDocumentScreen>) {
  const on = useAppStore().state.featureFlags.spec_legal;
  return on ? <LegalDocumentScreenV2 {...props} /> : <LegacyLegalDocumentScreen {...props} />;
}
