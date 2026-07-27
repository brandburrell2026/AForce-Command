import { describe, it, expect } from "vitest";
import { extractVerifiedPrimaryEmail } from "../verifiedEmail";

const user = (over: object = {}) => ({
  primaryEmailAddressId: "em_1",
  emailAddresses: [
    { id: "em_1", emailAddress: "Buyer@X.com", verification: { status: "verified" } },
    { id: "em_2", emailAddress: "other@x.com", verification: { status: "unverified" } },
  ],
  ...over,
});

describe("extractVerifiedPrimaryEmail (trust root, fail-closed)", () => {
  it("returns the lowercased verified PRIMARY email", () => {
    expect(extractVerifiedPrimaryEmail(user())).toBe("buyer@x.com");
  });
  it("null when the primary is unverified — squatting gains nothing", () => {
    expect(extractVerifiedPrimaryEmail(user({
      emailAddresses: [{ id: "em_1", emailAddress: "victim@x.com", verification: { status: "unverified" } }],
    }))).toBeNull();
  });
  it("null when a verified address exists but is NOT the primary", () => {
    expect(extractVerifiedPrimaryEmail(user({ primaryEmailAddressId: "em_2" }))).toBeNull();
  });
  it("null on missing primary id, empty addresses, null user, junk value", () => {
    expect(extractVerifiedPrimaryEmail(user({ primaryEmailAddressId: null }))).toBeNull();
    expect(extractVerifiedPrimaryEmail(user({ emailAddresses: [] }))).toBeNull();
    expect(extractVerifiedPrimaryEmail(null)).toBeNull();
    expect(extractVerifiedPrimaryEmail(user({
      emailAddresses: [{ id: "em_1", emailAddress: "not-an-email", verification: { status: "verified" } }],
    }))).toBeNull();
  });
  it("supports snake_case API shape", () => {
    expect(extractVerifiedPrimaryEmail({
      primary_email_address_id: "em_9",
      email_addresses: [{ id: "em_9", email_address: "SNAKE@x.com", verification: { status: "verified" } }],
    })).toBe("snake@x.com");
  });
});
