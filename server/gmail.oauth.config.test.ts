import { describe, expect, it } from "vitest";

const requiredConfig = [
  "GMAIL_OAUTH_CLIENT_ID",
  "GMAIL_OAUTH_CLIENT_SECRET",
  "GMAIL_OAUTH_REDIRECT_URI",
  "GMAIL_SENDER_EMAIL",
] as const;

describe.skipIf(!process.env.GMAIL_LIVE_TEST)("Gmail OAuth configuration", () => {
  it("is accepted by the Google token endpoint before a real authorization code is supplied", async () => {
    for (const key of requiredConfig) {
      expect(process.env[key], `${key} must be configured`).toBeTruthy();
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GMAIL_OAUTH_CLIENT_ID!,
        client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET!,
        redirect_uri: process.env.GMAIL_OAUTH_REDIRECT_URI!,
        grant_type: "authorization_code",
        code: "jobase-configuration-probe",
      }),
    });

    const payload = (await response.json()) as { error?: string };
    expect(response.status).toBe(400);
    expect(payload.error).toBe("invalid_grant");
  }, 15_000);
});
