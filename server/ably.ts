// Publish realtime qua Ably REST (khong can giu socket tren server).
// Neu chua cau hinh ABLY_API_KEY thi bo qua — client van poll 15s nhu cu.

const CHANNEL = "jobase:community";

export type CommunityBroadcast = {
  userId: number;
  userName: string;
  content: string;
  createdAt: string;
};

export async function publishCommunityMessage(message: CommunityBroadcast): Promise<void> {
  const key = process.env.ABLY_API_KEY;
  if (!key) return;
  try {
    const response = await fetch(`https://rest.ably.io/channels/${encodeURIComponent(CHANNEL)}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(key).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "message", data: message }),
    });
    if (!response.ok) {
      console.warn(`[Ably] publish failed: ${response.status}`);
    }
  } catch (error) {
    console.warn("[Ably] publish error:", error);
  }
}
