import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema.pg";
import { provisionUserFromSupabase } from "../db.pg";
import { supabaseAdmin } from "../supabase";

export type TrpcContext = {
  req?: CreateExpressContextOptions["req"];
  res?: CreateExpressContextOptions["res"];
  user: User | null;
};

function bearerFromHeader(auth: unknown): string | null {
  if (typeof auth !== "string" || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

/** Verify Supabase JWT roi map sang public.users (tu dong tao row lan dau). */
export async function createContextFromToken(token: string | null): Promise<User | null> {
  if (!token) return null;
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return null;
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const name = typeof meta["name"] === "string" ? (meta["name"] as string) : (data.user.email ?? null);
    return await provisionUserFromSupabase({ id: data.user.id, email: data.user.email ?? null, name });
  } catch {
    return null;
  }
}

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const token = bearerFromHeader(opts.req.headers.authorization);
  const user = await createContextFromToken(token);
  return { req: opts.req, res: opts.res, user };
}
