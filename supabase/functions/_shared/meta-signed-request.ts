// Verifies the `signed_request` Meta sends to callbacks such as data deletion.
// Format: <base64url HMAC-SHA256 of payload>.<base64url JSON payload>, signed
// with the app secret. Uses only Web Crypto so it can be unit tested outside Deno.

export interface MetaSignedRequest {
  user_id: string;
  algorithm: string;
  issued_at?: number;
  expires?: number;
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** Returns the payload if the signature is valid, otherwise null. */
export async function parseMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): Promise<MetaSignedRequest | null> {
  const parts = signedRequest.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [encodedSignature, encodedPayload] = parts;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(encodedSignature),
      encoder.encode(encodedPayload),
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
    if (payload?.algorithm !== "HMAC-SHA256") return null;
    if (typeof payload.user_id !== "string" || !payload.user_id) return null;
    return payload as MetaSignedRequest;
  } catch {
    return null;
  }
}
