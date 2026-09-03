import type { TrpcContext } from "./context";
import { createContextFromToken } from "./context";

// Context cho Vercel serverless (fetch adapter): doc Bearer token (Supabase JWT)
// tu header, verify qua Supabase Auth, map sang public.users.
export async function createSupabaseContext(req: Request): Promise<TrpcContext> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const user = await createContextFromToken(token);
  return { user };
}
