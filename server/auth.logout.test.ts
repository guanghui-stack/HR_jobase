import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      supabaseId: "sample-supabase-id",
      openId: null,
      email: "sample@example.com",
      name: "Sample User",
      loginMethod: "supabase",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
  };
}

describe("auth.logout", () => {
  it("reports success (session is cleared client-side via supabase.auth.signOut)", async () => {
    const caller = appRouter.createCaller(createAuthContext());

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
  });
});
