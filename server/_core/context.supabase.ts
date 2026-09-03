import { supabaseAdmin } from "../supabase";
import { getUserBySupabaseId } from "../db.pg";

// Context moi cho Vercel serverless: doc Bearer token (Supabase JWT) tu header,
// verify qua Supabase Auth, roi map sang public.users de giu nguyen
// protectedProcedure/adminProcedure hien tai.
// TODO(b2): thay db.pg stub bang implement day du + RLS policies.
export async function createSupabaseContext(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return { user: null };

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return { user: null };
    const user = await getUserBySupabaseId(data.user.id).catch(() => null);
    return { user: user ?? null };
  } catch {
    return { user: null };
  }
}
