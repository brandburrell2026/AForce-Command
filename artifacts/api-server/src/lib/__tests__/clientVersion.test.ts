/**
 * THE CLIENT VERSION CONTRACT — the eight adversarial proofs the founder's
 * release-recovery ruling requires before this may open.
 *
 * The failure this guards is asymmetric and worth stating plainly. A gate that
 * fails to block a bad build costs us a slower recovery. A gate that blocks a
 * GOOD build locks paying members out of a working app, and — with no OTA and
 * no way to reach the binary — the only remedy is an App Store review cycle.
 * So every ambiguity resolves toward "supported", and these laws exist mostly
 * to prove the gate CANNOT fire when it should not.
 */
import { describe, it, expect } from "vitest";
import {
  parseClientHeader,
  evaluateClientSupport,
  clientPolicyPayload,
  CLIENT_SUPPORT_POLICY,
  CLIENT_HEADER,
  type ClientIdentity,
  type ClientSupportPolicy,
} from "../clientVersion";

/** The two artifacts actually in the field, verified from the EAS builds. */
const SHIPPED_IOS: ClientIdentity = { platform: "ios", appVersion: "1.0.0", build: 71 };
const SHIPPED_ANDROID: ClientIdentity = { platform: "android", appVersion: "1.0.0", build: 1 };

describe("1 — old clients remain compatible", () => {
  it("the builds in the field send NO header, and are `unknown`, not `unsupported`", () => {
    // Verified from the shipped artifacts: nothing on the wire carries a
    // version today. Every one of those installs must keep working.
    expect(parseClientHeader(undefined)).toBeNull();
    expect(evaluateClientSupport(null)).toBe("unknown");
    expect(evaluateClientSupport(null)).not.toBe("unsupported");
  });

  it("`unknown` stays unknown even under a policy that WOULD gate", () => {
    // The dangerous shape: activation happens later, and a client that never
    // identified itself must not be swept up by it.
    const strict: ClientSupportPolicy = { minSupportedBuild: { ios: 9999, android: 9999 } };
    expect(evaluateClientSupport(null, strict)).toBe("unknown");
  });
});

describe("2 — an absent version header does not block", () => {
  it.each([undefined, null, "", "   ", [], ["ios/1.0.0+71", "ios/1.0.0+71"], {}, 0, false])(
    "header %p yields unknown, never unsupported",
    (raw) => {
      // Express hands a repeated header over as an ARRAY — a caller that sends
      // it twice is malformed, not out of date.
      expect(parseClientHeader(raw)).toBeNull();
      expect(evaluateClientSupport(parseClientHeader(raw))).toBe("unknown");
    },
  );
});

describe("3 — malformed or unknown versions do not accidentally block", () => {
  const JUNK = [
    "ios", "ios/", "ios/1.0.0", "1.0.0+71", "ios-1.0.0+71", "ios/1.0.0+",
    "ios/1.0.0+abc", "ios/1.0.0+71.2", "ios/1.0.0+-1", "ios/1.0.0+ 71",
    "web/1.0.0+71", "windows/1.0.0+3", "IOS/1.0.0+71", "ios/1.0.0+71extra",
    "ios/1.0.0+99999999999999999999", "ios/" + "9".repeat(40) + "+1",
    "../../etc/passwd", "ios/1.0.0+0x10",
  ];
  it.each(JUNK)("%p parses to null and evaluates to unknown", (raw) => {
    expect(parseClientHeader(raw)).toBeNull();
    expect(evaluateClientSupport(parseClientHeader(raw), {
      minSupportedBuild: { ios: 9999, android: 9999 },
    })).toBe("unknown");
  });

  it("surrounding whitespace is trimmed, not treated as malformed", () => {
    // A trailing newline or padding is transport hygiene, not an out-of-date
    // client — and refusing to parse it would push a perfectly current build
    // into `unknown`, losing the telemetry this contract exists to gather.
    // (Node rejects raw newlines inside header VALUES at the HTTP layer, and
    // nothing here is ever reflected back, so trimming introduces no risk.)
    expect(parseClientHeader("ios/1.0.0+71\n")).toEqual(SHIPPED_IOS);
    expect(parseClientHeader("\tandroid/1.0.0+1 ")).toEqual(SHIPPED_ANDROID);
  });

  it("ANTI-VACUITY: the parser is not simply rejecting everything", () => {
    // If it were, all of the above would pass for free.
    expect(parseClientHeader("ios/1.0.0+71")).toEqual(SHIPPED_IOS);
    expect(parseClientHeader("android/1.0.0+1")).toEqual(SHIPPED_ANDROID);
    expect(parseClientHeader("  ios/1.0.0+71  ")).toEqual(SHIPPED_IOS);
    expect(parseClientHeader("ios/1.2.3-beta.4+250")).toEqual({
      platform: "ios", appVersion: "1.2.3-beta.4", build: 250,
    });
  });
});

describe("4 — a minimum build of 0 blocks nobody", () => {
  it("the SHIPPED policy is 0/0 and refuses no one", () => {
    expect(CLIENT_SUPPORT_POLICY.minSupportedBuild).toEqual({ ios: 0, android: 0 });
    for (const id of [SHIPPED_IOS, SHIPPED_ANDROID,
                      { platform: "ios", appVersion: "0.0.1", build: 0 } as ClientIdentity]) {
      expect(evaluateClientSupport(id), `${id.platform}+${id.build}`).toBe("supported");
    }
  });

  it("build 0 against minimum 0 is SUPPORTED — the boundary is not off by one", () => {
    const id: ClientIdentity = { platform: "android", appVersion: "1.0.0", build: 0 };
    expect(evaluateClientSupport(id, { minSupportedBuild: { ios: 0, android: 0 } })).toBe("supported");
  });

  it("a policy missing a platform gates nothing for that platform", () => {
    const partial = { minSupportedBuild: { ios: 100 } } as unknown as ClientSupportPolicy;
    expect(evaluateClientSupport(SHIPPED_ANDROID, partial)).toBe("supported");
    // ANTI-VACUITY: the platform that IS in the policy still gates.
    expect(evaluateClientSupport(SHIPPED_IOS, partial)).toBe("unsupported");
  });
});

describe("5 — semantic app version can never be confused with the native build", () => {
  it("appVersion does not affect the verdict, at all", () => {
    // THE REAL TRAP. The shipped iOS artifact is 1.0.0 build 71 and the
    // shipped Android artifact is 1.0.0 build 1 — the SAME app version, 70
    // builds apart. Anything that compared "1.0.0" would call them equal.
    const policy: ClientSupportPolicy = { minSupportedBuild: { ios: 50, android: 50 } };
    const verdicts = ["0.0.1", "1.0.0", "9.9.9", "2026.1.0", "1.0.0-rc.1"].map((v) =>
      evaluateClientSupport({ platform: "ios", appVersion: v, build: 71 }, policy),
    );
    expect(new Set(verdicts)).toEqual(new Set(["supported"]));
    // ...and the same build below the line is unsupported regardless of how
    // high the app version reads.
    expect(evaluateClientSupport(
      { platform: "ios", appVersion: "99.99.99", build: 4 }, policy,
    )).toBe("unsupported");
  });

  it("the two fields are different TYPES, so a swap is a compile error", () => {
    const id = parseClientHeader("ios/1.0.0+71")!;
    expect(typeof id.appVersion).toBe("string");
    expect(typeof id.build).toBe("number");
  });
});

describe("6 — iOS and Android build identities are judged separately", () => {
  it("each platform is compared only against its own minimum", () => {
    // The shipped reality: iOS 71, Android 1. A single global minimum of 50
    // would pass iOS and fail Android for no reason connected to the app.
    const policy: ClientSupportPolicy = { minSupportedBuild: { ios: 50, android: 0 } };
    expect(evaluateClientSupport(SHIPPED_IOS, policy)).toBe("supported");
    expect(evaluateClientSupport(SHIPPED_ANDROID, policy)).toBe("supported");
  });

  it("an Android build number is never measured against the iOS threshold", () => {
    const iosOnly: ClientSupportPolicy = { minSupportedBuild: { ios: 71, android: 0 } };
    // Android build 1 is far below 71 and must be untouched by it.
    expect(evaluateClientSupport(SHIPPED_ANDROID, iosOnly)).toBe("supported");
    // ANTI-VACUITY: raising ANDROID's own minimum does gate it.
    expect(evaluateClientSupport(SHIPPED_ANDROID, {
      minSupportedBuild: { ios: 0, android: 2 },
    })).toBe("unsupported");
  });
});

describe("7 — a server or network failure cannot manufacture a mandatory upgrade", () => {
  it("there is no input to the evaluator that means 'assume unsupported'", () => {
    // The client's half of this is its own law; the server's half is that the
    // only way to reach `unsupported` is a PARSED identity measured against a
    // POSITIVE minimum. Absence, junk, and an unknown platform all land on
    // `unknown`, which the client treats as supported.
    const strict: ClientSupportPolicy = { minSupportedBuild: { ios: 9999, android: 9999 } };
    for (const raw of [undefined, null, "", "garbage", "web/1.0.0+1", 42, {}, []]) {
      expect(evaluateClientSupport(parseClientHeader(raw), strict)).not.toBe("unsupported");
    }
  });

  it("an absent or non-numeric minimum is treated as no gate", () => {
    for (const min of [undefined, null, NaN, Infinity, -1, "50"] as unknown[]) {
      const p = { minSupportedBuild: { ios: min, android: min } } as unknown as ClientSupportPolicy;
      expect(evaluateClientSupport(SHIPPED_IOS, p), `min=${String(min)}`).toBe("supported");
    }
  });
});

describe("8 — the gate cannot be bypassed by accident once activated", () => {
  it("a positive minimum genuinely refuses a build below it", () => {
    // The other direction: having proven the gate cannot fire wrongly, prove
    // it CAN fire. A gate that never fires is not a safe gate, it is a no-op.
    expect(evaluateClientSupport(SHIPPED_IOS, {
      minSupportedBuild: { ios: 72, android: 0 },
    })).toBe("unsupported");
    expect(evaluateClientSupport(SHIPPED_ANDROID, {
      minSupportedBuild: { ios: 0, android: 2 },
    })).toBe("unsupported");
  });

  it("the verdict is exactly `build >= min`, with no slack at the boundary", () => {
    const p: ClientSupportPolicy = { minSupportedBuild: { ios: 71, android: 0 } };
    expect(evaluateClientSupport({ ...SHIPPED_IOS, build: 70 }, p)).toBe("unsupported");
    expect(evaluateClientSupport({ ...SHIPPED_IOS, build: 71 }, p)).toBe("supported");
    expect(evaluateClientSupport({ ...SHIPPED_IOS, build: 72 }, p)).toBe("supported");
  });

  it("the published payload is a COPY — a consumer cannot mutate the policy", () => {
    const published = clientPolicyPayload();
    published.minSupportedBuild.ios = 9999;
    expect(CLIENT_SUPPORT_POLICY.minSupportedBuild.ios, "the shipped policy is unchanged").toBe(0);
    expect(clientPolicyPayload().minSupportedBuild.ios).toBe(0);
  });

  it("the header name is lowercase — Express normalises, and we must match", () => {
    expect(CLIENT_HEADER).toBe(CLIENT_HEADER.toLowerCase());
  });
});
