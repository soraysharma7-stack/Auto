import { beforeEach, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, generatePairingCode, hashToken } from "@/lib/security/secrets";

describe("secret protection", () => {
  beforeEach(() => {
    process.env.PROVIDER_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("encrypts with a unique nonce and decrypts correctly", () => {
    const first = encryptSecret("provider-secret");
    const second = encryptSecret("provider-secret");
    expect(first).not.toBe(second);
    expect(first).not.toContain("provider-secret");
    expect(decryptSecret(first)).toBe("provider-secret");
    expect(decryptSecret(second)).toBe("provider-secret");
  });

  it("rejects tampered ciphertext", () => {
    const encrypted = encryptSecret("provider-secret");
    const parts = encrypted.split(".");
    parts[2] = `${parts[2].slice(0, -2)}xx`;
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });

  it("hashes device tokens and generates one-time code shapes", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
    expect(hashToken("abc")).not.toBe(hashToken("abd"));
    expect(generatePairingCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    expect(generatePairingCode()).not.toBe(generatePairingCode());
  });
});
