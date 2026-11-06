import { createHmac } from "node:crypto";
import { describe, it, expect } from "vitest";

import { parseMetaSignedRequest } from "../../supabase/functions/_shared/meta-signed-request";

const SECRET = "test-app-secret";

function sign(payload: unknown, secret = SECRET): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${signature}.${encoded}`;
}

const VALID = { algorithm: "HMAC-SHA256", issued_at: 1291836800, user_id: "218471" };

describe("parseMetaSignedRequest", () => {
  it("returns the payload for a correctly signed request", async () => {
    expect(await parseMetaSignedRequest(sign(VALID), SECRET)).toMatchObject({ user_id: "218471" });
  });

  it("accepts payloads whose base64url encoding uses - and _ without padding", async () => {
    const payload = { ...VALID, note: "ÿÿ>>??~~" };
    expect(await parseMetaSignedRequest(sign(payload), SECRET)).toMatchObject({ user_id: "218471" });
  });

  it("rejects a request signed with another secret", async () => {
    expect(await parseMetaSignedRequest(sign(VALID, "other-secret"), SECRET)).toBeNull();
  });

  it("rejects a payload changed after signing", async () => {
    const [signature] = sign(VALID).split(".");
    const forged = Buffer.from(JSON.stringify({ ...VALID, user_id: "999" })).toString("base64url");
    expect(await parseMetaSignedRequest(`${signature}.${forged}`, SECRET)).toBeNull();
  });

  it("rejects an unexpected algorithm", async () => {
    expect(await parseMetaSignedRequest(sign({ ...VALID, algorithm: "none" }), SECRET)).toBeNull();
  });

  it("rejects a payload without user_id", async () => {
    expect(await parseMetaSignedRequest(sign({ algorithm: "HMAC-SHA256" }), SECRET)).toBeNull();
  });

  it.each(["", "abc", "a.b.c", ".", "%%%.%%%"])("rejects malformed input %j", async (input) => {
    expect(await parseMetaSignedRequest(input, SECRET)).toBeNull();
  });
});
