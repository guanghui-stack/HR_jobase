import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers";
import { createSupabaseContext } from "../../server/_core/context.supabase";

// Vercel Serverless entry cho tRPC — thay Express listen(PORT).
// Client giu nguyen url "/api/trpc" (xem client/src/main.tsx).
// Buoc tiep theo: thay createContext (Manus SDK) bang createSupabaseContext
// sau khi Auth Supabase xong. Hien de co che fallback de khong vo build.
export default function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createSupabaseContext(req),
  });
}
