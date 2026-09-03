import { vi } from "vitest";

// Env gia cho unit tests (khong goi Google that).
// Test live Google token endpoint (gmail.oauth.config.test.ts) tu skip
// khi khong co credentials that.
vi.stubEnv("GMAIL_TOKEN_ENCRYPTION_KEY", "test-only-encryption-key-32-chars!!");
vi.stubEnv("GMAIL_OAUTH_CLIENT_ID", "test-client-id.apps.googleusercontent.com");
vi.stubEnv("GMAIL_OAUTH_CLIENT_SECRET", "test-client-secret");
vi.stubEnv("GMAIL_OAUTH_REDIRECT_URI", "http://localhost:3000/api/gmail/oauth/callback");
vi.stubEnv("GMAIL_SENDER_EMAIL", "test@example.com");
