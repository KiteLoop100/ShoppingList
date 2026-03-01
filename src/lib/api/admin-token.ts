/**
 * HMAC-signed admin session tokens.
 * Replaces the static cookie value "1" with a signed, expiring token.
 * Format: base64url(payload).base64url(HMAC-SHA256 signature)
 */

import { createHmac, timingSafeEqual } from "crypto";

interface AdminTokenPayload {
  exp: number;
}

function toBase64Url(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function fromBase64Url(encoded: string): string {
  return Buffer.from(encoded, "base64url").toString();
}

function computeSignature(secret: string, encoded: string): string {
  return createHmac("sha256", secret).update(encoded).digest("base64url");
}

export function signAdminToken(secret: string, ttlSeconds: number): string {
  const payload: AdminTokenPayload = {
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = computeSignature(secret, encoded);
  return `${encoded}.${signature}`;
}

export function verifyAdminToken(secret: string, token: string): boolean {
  const dotIndex = token.indexOf(".");
  if (dotIndex <= 0) return false;

  const encoded = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);

  const expected = computeSignature(secret, encoded);
  if (expected.length !== signature.length) return false;

  const sigOk = timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
  if (!sigOk) return false;

  try {
    const payload: AdminTokenPayload = JSON.parse(fromBase64Url(encoded));
    if (typeof payload.exp !== "number") return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
