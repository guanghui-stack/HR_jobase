import type { Express, Request, Response } from "express";
import { createContext } from "./_core/context";
import { createGmailAuthorizationUrl, exchangeGmailAuthorizationCode, verifyGmailOAuthState } from "./gmail";

async function requireAdmin(req: Request, res: Response) {
  const context = await createContext({ req, res } as Parameters<typeof createContext>[0]);
  if (context.user?.role !== "admin") {
    res.status(403).send("Chỉ quản trị viên Jobase mới có thể kết nối Gmail.");
    return false;
  }
  return true;
}

export function registerGmailOAuthRoutes(app: Express) {
  app.get("/api/gmail/oauth/authorize", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    res.redirect(createGmailAuthorizationUrl());
  });

  app.get("/api/gmail/oauth/callback", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const error = typeof req.query.error === "string" ? req.query.error : undefined;
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (error || !code || !state || !verifyGmailOAuthState(state)) {
      res.status(400).send("Không thể xác nhận quyền Gmail. Hãy quay lại Jobase và thử kết nối lại.");
      return;
    }
    try {
      await exchangeGmailAuthorizationCode(code);
      res.redirect("/admin?gmail=connected");
    } catch (oauthError) {
      const message = oauthError instanceof Error ? oauthError.message : "Lỗi không xác định khi kết nối Gmail.";
      res.status(500).send(`Kết nối Gmail chưa hoàn tất: ${message}`);
    }
  });
}
