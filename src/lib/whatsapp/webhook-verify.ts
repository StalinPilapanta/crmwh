import { timingSafeEqual, createHmac } from "crypto";

/**
 * Verifies the HMAC-SHA256 signature from the X-Hub-Signature-256 header
 */
export function verifyWebhookSignature(
  body: string,
  signature: string | null,
  appSecret: string
): boolean {
  if (!signature) return false;

  const expectedSignature = createHmac("sha256", appSecret)
    .update(body)
    .digest("hex");

  const sigHash = signature.replace("sha256=", "");

  try {
    return timingSafeEqual(
      Buffer.from(sigHash, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}
