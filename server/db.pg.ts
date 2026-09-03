import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users } from "../drizzle/schema.pg";

// DB layer Postgres (Supabase) — song song voi server/db.ts (MySQL).
// TODO(b2): port toan bo ham tu db.ts sang, doi onDuplicateKeyUpdate
// thanh onConflictDoUpdate. Hien chi co ham auth can thiet cho context.
let _db: ReturnType<typeof drizzle> | null = null;

export function getDbPg() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(postgres(process.env.DATABASE_URL));
  }
  return _db;
}

export async function getUserBySupabaseId(supabaseId: string) {
  const db = getDbPg();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.supabaseId, supabaseId)).limit(1);
  return rows[0] ?? null;
}
