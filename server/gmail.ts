import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import {
  getGmailOAuthCredential,
  listQueuedEmailDispatches,
  listMatchingEmailRecipients,
  updateEmailDispatchById,
  updateEmailDispatchStatus,
  upsertGmailOAuthCredential,
} from "./db";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const SEND_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

function required(name: "GMAIL_OAUTH_CLIENT_ID" | "GMAIL_OAUTH_CLIENT_SECRET" | "GMAIL_OAUTH_REDIRECT_URI" | "GMAIL_SENDER_EMAIL") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return createHash("sha256").update(secret).digest();
}

function stateSignature(payload: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function cleanHeaderValue(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

function createRawMessage(to: string, subject: string, body: string, from: string) {
  const mime = [
    `From: ${cleanHeaderValue(from)}`,
    `To: ${cleanHeaderValue(to)}`,
    `Subject: ${cleanHeaderValue(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");
  return Buffer.from(mime, "utf8").toString("base64url");
}

export function encryptRefreshToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptRefreshToken(payload: string) {
  const [ivEncoded, tagEncoded, encryptedEncoded] = payload.split(".");
  if (!ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error("Stored Gmail credential is malformed");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivEncoded, "base64url"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedEncoded, "base64url")), decipher.final()]).toString("utf8");
}

export function createGmailAuthorizationUrl() {
  const payload = `${Date.now()}.${randomBytes(18).toString("base64url")}`;
  const state = `${payload}.${stateSignature(payload)}`;
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", required("GMAIL_OAUTH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", required("GMAIL_OAUTH_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export function verifyGmailOAuthState(state: string) {
  const [issuedAt, nonce, signature] = state.split(".");
  if (!issuedAt || !nonce || !signature) return false;
  const payload = `${issuedAt}.${nonce}`;
  const expected = Buffer.from(stateSignature(payload));
  const candidate = Buffer.from(signature);
  if (expected.length !== candidate.length || !timingSafeEqual(expected, candidate)) return false;
  return Date.now() - Number(issuedAt) < 15 * 60 * 1000;
}

async function tokenRequest(body: URLSearchParams) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok) throw new Error(payload.error_description || payload.error || "Google OAuth token request failed");
  return payload;
}

export async function exchangeGmailAuthorizationCode(code: string) {
  const token = await tokenRequest(new URLSearchParams({
    code,
    client_id: required("GMAIL_OAUTH_CLIENT_ID"),
    client_secret: required("GMAIL_OAUTH_CLIENT_SECRET"),
    redirect_uri: required("GMAIL_OAUTH_REDIRECT_URI"),
    grant_type: "authorization_code",
  }));
  if (!token.refresh_token) throw new Error("Google did not return a refresh token. Revoke prior Jobase access and grant permission again.");
  await upsertGmailOAuthCredential({
    encryptedRefreshToken: encryptRefreshToken(token.refresh_token),
    scope: token.scope || GMAIL_SCOPE,
    senderEmail: required("GMAIL_SENDER_EMAIL"),
  });
  await flushQueuedEmailDispatches();
}

export async function isGmailConnected() {
  return Boolean(await getGmailOAuthCredential());
}

async function getAccessToken() {
  const credential = await getGmailOAuthCredential();
  if (!credential) return undefined;
  const token = await tokenRequest(new URLSearchParams({
    refresh_token: decryptRefreshToken(credential.encryptedRefreshToken),
    client_id: required("GMAIL_OAUTH_CLIENT_ID"),
    client_secret: required("GMAIL_OAUTH_CLIENT_SECRET"),
    grant_type: "refresh_token",
  }));
  if (!token.access_token) throw new Error("Google did not return an access token");
  return { accessToken: token.access_token, from: credential.senderEmail };
}

export async function sendGmailMessage(input: { to: string; subject: string; body: string }) {
  const credential = await getAccessToken();
  if (!credential) return false;
  const response = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${credential.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: createRawMessage(input.to, input.subject, input.body, credential.from) }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message || "Gmail did not accept the message");
  }
  return true;
}

export async function flushQueuedEmailDispatches() {
  if (!(await isGmailConnected())) return;
  const dispatches = await listQueuedEmailDispatches();
  await Promise.all(dispatches.map(async dispatch => {
    try {
      if (dispatch.kind === "job_match" && dispatch.jobTitle && dispatch.company && dispatch.field && dispatch.location && dispatch.workMode) {
        await sendGmailMessage({
          to: dispatch.recipient,
          subject: `Jobase · ${dispatch.jobTitle} có thể phù hợp với bạn`,
          body: `Chào bạn,\n\nJobase vừa công bố một vai trò mới trong lĩnh vực ${dispatch.field}:\n\n${dispatch.jobTitle} tại ${dispatch.company}\n${dispatch.location} · ${dispatch.workMode}\n\nBạn có thể vào Jobase để xem thêm thông tin và đánh dấu mức độ quan tâm.\n\nJobase`,
        });
      } else {
        await sendGmailMessage({
          to: dispatch.recipient,
          subject: "Jobase · Xác nhận tuỳ chọn nhận tin",
          body: "Chào bạn,\n\nJobase đã ghi nhận tuỳ chọn nhận tin của bạn. Bạn có thể thay đổi tuỳ chọn bất cứ lúc nào trong Jobase.\n\nJobase",
        });
      }
      await updateEmailDispatchById(dispatch.id, "sent");
    } catch (error) {
      await updateEmailDispatchById(dispatch.id, "failed", error instanceof Error ? error.message : "Unknown Gmail error");
    }
  }));
}

export async function deliverJobMatchNotifications(job: { id: number; title: string; company: string; field: string; location: string; workMode: string }) {
  if (!(await isGmailConnected())) return;
  const recipients = await listMatchingEmailRecipients(job.field);
  await Promise.all(recipients.map(async recipient => {
    try {
      await sendGmailMessage({
        to: recipient.contactEmail,
        subject: `Jobase · ${job.title} có thể phù hợp với bạn`,
        body: `Chào bạn,\n\nJobase vừa công bố một vai trò mới trong lĩnh vực ${job.field}:\n\n${job.title} tại ${job.company}\n${job.location} · ${job.workMode}\n\nBạn có thể vào Jobase để xem thêm thông tin và đánh dấu mức độ quan tâm.\n\nJobase`,
      });
      await updateEmailDispatchStatus({ userId: recipient.userId, recipient: recipient.contactEmail, jobId: job.id, kind: "job_match", status: "sent" });
    } catch (error) {
      await updateEmailDispatchStatus({ userId: recipient.userId, recipient: recipient.contactEmail, jobId: job.id, kind: "job_match", status: "failed", errorMessage: error instanceof Error ? error.message : "Unknown Gmail error" });
    }
  }));
}

export async function deliverPreferenceConfirmation(input: { userId: number; recipient: string; fields: string[]; emailEnabled: "yes" | "no" }) {
  if (!(await isGmailConnected())) return;
  try {
    await sendGmailMessage({
      to: input.recipient,
      subject: "Jobase · Xác nhận tuỳ chọn nhận tin",
      body: `Chào bạn,\n\nJobase đã cập nhật tuỳ chọn của bạn.\n\nLĩnh vực theo dõi: ${input.fields.join(", ")}\nNhận email công việc phù hợp: ${input.emailEnabled === "yes" ? "Có" : "Không"}\n\nBạn có thể thay đổi tuỳ chọn bất cứ lúc nào trong Jobase.\n\nJobase`,
    });
    await updateEmailDispatchStatus({ userId: input.userId, recipient: input.recipient, kind: "preference_confirmation", status: "sent" });
  } catch (error) {
    await updateEmailDispatchStatus({ userId: input.userId, recipient: input.recipient, kind: "preference_confirmation", status: "failed", errorMessage: error instanceof Error ? error.message : "Unknown Gmail error" });
  }
}
