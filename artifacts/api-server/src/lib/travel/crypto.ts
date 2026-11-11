import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
/** Purpose-separated encryption; grants and push tokens never enter client responses or logs. */
export function travelCrypto(secret: string | undefined) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret))
    throw new Error("Travel secure storage is not configured.");
  const key = Buffer.from(
    hkdfSync(
      "sha256",
      Buffer.from(secret, "hex"),
      "aforce-travel-v2",
      "grant-and-device-storage",
      32,
    ),
  );
  return {
    encrypt(value: string) {
      const iv = randomBytes(12),
        cipher = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
      ]);
      return [iv, cipher.getAuthTag(), data]
        .map((x) => x.toString("base64url"))
        .join(".");
    },
    decrypt(value: string) {
      const [iv, tag, data] = value
        .split(".")
        .map((x) => Buffer.from(x, "base64url"));
      if (!iv || !tag || !data)
        throw new Error("Invalid encrypted travel value.");
      const cipher = createDecipheriv("aes-256-gcm", key, iv);
      cipher.setAuthTag(tag);
      return Buffer.concat([cipher.update(data), cipher.final()]).toString(
        "utf8",
      );
    },
  };
}
export const travelDigest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
