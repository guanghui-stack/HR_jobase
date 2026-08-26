import { describe, expect, it } from "vitest";
import { createGmailAuthorizationUrl, verifyGmailOAuthState } from "./gmail";

describe("Gmail OAuth state", () => {
  it("builds a narrowly scoped consent URL with an authentic state value", () => {
    const url = new URL(createGmailAuthorizationUrl());

    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.pathname).toBe("/o/oauth2/v2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/gmail.send");
    expect(url.searchParams.get("redirect_uri")).toBe(process.env.GMAIL_OAUTH_REDIRECT_URI);
    expect(verifyGmailOAuthState(url.searchParams.get("state")!)).toBe(true);
  });

  it("rejects a state whose signed payload is altered", () => {
    const url = new URL(createGmailAuthorizationUrl());
    const [issuedAt, nonce, signature] = url.searchParams.get("state")!.split(".");

    expect(verifyGmailOAuthState(`${issuedAt}.${nonce}changed.${signature}`)).toBe(false);
  });
});
