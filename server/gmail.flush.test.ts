import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  getGmailOAuthCredential: vi.fn(),
  listMatchingEmailRecipients: vi.fn(),
  listQueuedEmailDispatches: vi.fn(),
  updateEmailDispatchById: vi.fn(),
  updateEmailDispatchStatus: vi.fn(),
  upsertGmailOAuthCredential: vi.fn(),
}));

vi.mock("./db", () => db);

import { encryptRefreshToken, flushQueuedEmailDispatches } from "./gmail";

describe("flushQueuedEmailDispatches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "test-access-token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "gmail-message-id" }) }));
    db.getGmailOAuthCredential.mockReturnValue({
      encryptedRefreshToken: encryptRefreshToken("test-refresh-token"),
      senderEmail: process.env.GMAIL_SENDER_EMAIL,
    });
    db.listQueuedEmailDispatches.mockResolvedValue([{
      id: 5,
      userId: 17,
      jobId: 8,
      kind: "job_match",
      recipient: "candidate@example.com",
      jobTitle: "Product Designer",
      company: "Jobase Labs",
      field: "Design",
      location: "Hồ Chí Minh",
      workMode: "Hybrid",
    }]);
  });

  it("sends queued job email and marks that exact dispatch as sent", async () => {
    await flushQueuedEmailDispatches();

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(db.updateEmailDispatchById).toHaveBeenCalledWith(5, "sent");
  });
});
