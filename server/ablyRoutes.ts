import type { Express } from "express";
import { createContextFromToken } from "./_core/context";
import { COMMUNITY_CHANNEL } from "./ably";

// Ably token auth: client KHONG bao gio thay API key.
// Client goi GET /api/ably/token (kem Supabase Bearer token) -> server dung
// ABLY_API_KEY (chi co tren server) doi lay mot TokenDetails ngan han, chi co
// quyen subscribe kenh community. Publish van do server lam (server/ably.ts).

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 gio

export function registerAblyRoutes(app: Express) {
  app.get("/api/ably/token", async (req, res) => {
    const key = process.env.ABLY_API_KEY;
    if (!key) {
      res.status(503).json({ error: "Ably chua duoc cau hinh (thieu ABLY_API_KEY)." });
      return;
    }

    const header = req.headers.authorization ?? "";
    const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
    const user = await createContextFromToken(bearer);
    if (!user) {
      res.status(401).json({ error: "Can dang nhap de dung chat realtime." });
      return;
    }

    const keyName = key.split(":")[0];
    if (!keyName) {
      res.status(500).json({ error: "ABLY_API_KEY sai dinh dang (can dang APPID.KEYID:SECRET)." });
      return;
    }

    try {
      const response = await fetch(
        `https://rest.ably.io/keys/${encodeURIComponent(keyName)}/requestToken`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(key).toString("base64")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            clientId: String(user.id),
            ttl: TOKEN_TTL_MS,
            capability: JSON.stringify({ [COMMUNITY_CHANNEL]: ["subscribe"] }),
          }),
        }
      );

      if (!response.ok) {
        console.warn(`[Ably] requestToken failed: ${response.status}`);
        res.status(502).json({ error: "Khong lay duoc token Ably." });
        return;
      }

      // Tra thang TokenDetails cho Ably client (authUrl chap nhan dinh dang nay).
      res.setHeader("Cache-Control", "no-store");
      res.json(await response.json());
    } catch (error) {
      console.warn("[Ably] requestToken error:", error);
      res.status(502).json({ error: "Khong lay duoc token Ably." });
    }
  });
}
