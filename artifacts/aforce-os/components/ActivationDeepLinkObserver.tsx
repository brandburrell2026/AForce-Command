/**
 * ActivationDeepLinkObserver — watches for the acquisition QR /
 * activation deep-link and records it for the founder activation funnel.
 *
 * Renders nothing and touches NO routing (never calls router.replace), so
 * it can never fight onboarding or the cinematic OpeningSequence overlay.
 * It reads the cold-start URL and subscribes to warm deep-links; the
 * recording itself is consent-gated and buffered inside the
 * `activation_tracker` (privacy before collection).
 */
import React from "react";
import { Linking } from "react-native";

import {
  flushPendingActivation,
  recordActivationLink,
} from "@/analytics/activation_tracker";

export function ActivationDeepLinkObserver(): null {
  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const initial = await Linking.getInitialURL();
        if (mounted && initial) {
          await recordActivationLink(initial);
        } else {
          // No fresh link this launch, but consent may have been granted in
          // a prior session — flush any scan that was waiting on it.
          await flushPendingActivation();
        }
      } catch {
        /* deep-link read is best-effort; never block app start */
      }
    })();
    const sub = Linking.addEventListener("url", ({ url }) => {
      void recordActivationLink(url);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return null;
}

export default ActivationDeepLinkObserver;
