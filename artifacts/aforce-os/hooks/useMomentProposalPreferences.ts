import React from "react";
import {
  getMomentProposalPreferences,
  subscribeMomentPreferences,
} from "@/services/momentNotifications";
import { captureScope, isScopeCurrent } from "@/services/scopedWriteQueue";
import { getUserScopeGeneration } from "@/services/userScope";
import type { MomentProposalPreferences } from "@/services/momentProposalPreferences";

/** No global RAM snapshot: an account change blanks the old view before reading. */
export function useMomentProposalPreferences(
  enabled: boolean,
): MomentProposalPreferences | null {
  const [snapshot, setSnapshot] = React.useState<{
    generation: number;
    value: MomentProposalPreferences;
  } | null>(null);
  const generation = getUserScopeGeneration();
  React.useEffect(() => {
    if (!enabled) return;
    let active = true,
      request = 0;
    const load = () => {
      const current = ++request,
        token = captureScope();
      setSnapshot(null);
      void getMomentProposalPreferences()
        .then((value) => {
          if (active && current === request && isScopeCurrent(token))
            setSnapshot({ generation: token.generation, value });
        })
        .catch(() => {
          /* Unknown preferences means manual capture only. */
        });
    };
    const unsubscribe = subscribeMomentPreferences(load);
    load();
    return () => {
      active = false;
      request++;
      unsubscribe();
    };
  }, [enabled, generation]);
  return enabled && snapshot?.generation === generation ? snapshot.value : null;
}
