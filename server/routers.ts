import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { jobaseRouter } from "./routers/jobase";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // Dang xuat thuc hien client-side (supabase.auth.signOut()).
    // Mutation giu lai de useAuth hien tai khong vo.
    logout: publicProcedure.mutation(() => ({ success: true }) as const),
  }),
  ...jobaseRouter,
});

export type AppRouter = typeof appRouter;
