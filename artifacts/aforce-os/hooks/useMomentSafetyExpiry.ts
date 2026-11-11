import { useEffect } from "react";
import { getUserScopeGeneration } from "@/services/userScope";
import { preparationPreviewEnabled } from "@/services/preparationAccess";
import { AppState } from "react-native";
import {
  hydrateMoments,
  pruneMomentSafetyContext,
  useMomentsStore,
} from "@/services/momentsStore";

/** Privacy-only cleanup on expiry or foreground. Never changes coaching,
 * makes a sobriety claim, or triggers a return/morning transition. */
export function useMomentSafetyExpiry(): void {
  const { moments, hydrated } = useMomentsStore();
  const generation = getUserScopeGeneration();
  useEffect(() => {
    if (!hydrated && preparationPreviewEnabled())
      void hydrateMoments().catch(() => {});
  }, [hydrated, generation]);
  useEffect(() => {
    const deadlines = moments
      .map((m) => Date.parse(m.safetyContext?.expiresAtIso ?? ""))
      .filter(Number.isFinite);
    if (!deadlines.length) return;
    const remaining = Math.max(0, Math.min(...deadlines) - Date.now());
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Math.min(...deadlines);
    const check = () => {
      if (Date.now() >= deadline) pruneMomentSafetyContext();
      else
        timer = setTimeout(check, Math.min(deadline - Date.now(), 2147483647));
    };
    timer = setTimeout(check, Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [moments]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") pruneMomentSafetyContext();
    });
    return () => sub.remove();
  }, []);
}
