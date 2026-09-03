import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  communityMessages,
  emailDispatches,
  gmailOAuthCredentials,
  jobInterests,
  jobPreferences,
  jobs,
  type InsertUser,
  users,
} from "../drizzle/schema.pg";

// DB layer Postgres (Supabase). Mirror 1-1 tu server/db.ts (MySQL):
// onDuplicateKeyUpdate -> onConflictDoUpdate, insertId -> returning().
// server/db.ts hien re-export file nay de giu nguyen duong dan import va mocks.

let _db: ReturnType<typeof drizzle> | null = null;

export function getDbPg() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const url = process.env.DATABASE_URL;
      // Transaction pooler cua Supabase (port 6543) chay pgbouncer o transaction
      // mode -> KHONG ho tro prepared statements. postgres-js mac dinh bat
      // prepare, se loi "prepared statement ... already exists" sau vai request.
      const isTransactionPooler = url.includes(":6543");

      _db = drizzle(
        postgres(url, {
          prepare: !isTransactionPooler,
          // Moi lan goi serverless la mot instance rieng: giu pool that nho de
          // khong dot het connection slot cua Supabase khi Vercel scale ra.
          max: 1,
          idle_timeout: 20,
          connect_timeout: 10,
        })
      );
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// Giu ten ham cu de sdk/oauth chet (dead code) van typecheck.
export async function getDb() {
  return getDbPg();
}

function isAdminEmail(email: string | null | undefined) {
  const admin = process.env.ADMIN_EMAIL;
  return !!email && !!admin && email.toLowerCase() === admin.toLowerCase();
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.supabaseId && !user.openId) throw new Error("User supabaseId or openId is required for upsert");

  const db = getDbPg();
  if (!db) return;

  const values: InsertUser = {
    supabaseId: user.supabaseId ?? null,
    openId: user.openId ?? null,
  };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  const role = user.role ?? (isAdminEmail(user.email ?? null) ? "admin" : "user");
  values.role = role;
  updateSet.role = role;

  if (user.supabaseId) {
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.supabaseId,
      set: updateSet,
    });
    return;
  }

  // Fallback cho du lieu cu chi co openId (khong co unique constraint).
  const existing = await getUserByOpenId(user.openId!);
  if (existing) {
    await db.update(users).set(updateSet).where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values(values);
  }
}

/** Tao hoac cap nhat user tu Supabase Auth (goi o moi request co token). */
export async function provisionUserFromSupabase(input: { id: string; email?: string | null; name?: string | null }) {
  const db = getDbPg();
  if (!db) return null;
  const existing = await getUserBySupabaseId(input.id);
  if (existing) {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, existing.id));
    const refreshed = await getUserBySupabaseId(input.id);
    return refreshed ?? existing;
  }
  const role = isAdminEmail(input.email ?? null) ? "admin" : "user";
  const [row] = await db
    .insert(users)
    .values({
      supabaseId: input.id,
      email: input.email ?? null,
      name: input.name ?? null,
      loginMethod: "supabase",
      role,
      lastSignedIn: new Date(),
    })
    .returning();
  return row ?? null;
}

export async function getUserByOpenId(openId: string) {
  const db = getDbPg();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserBySupabaseId(supabaseId: string) {
  const db = getDbPg();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.supabaseId, supabaseId)).limit(1);
  return result[0] ?? null;
}

export async function listPublishedJobs(field?: string) {
  const db = getDbPg();
  if (!db) return [];

  const where = field && field !== "all"
    ? and(eq(jobs.status, "published"), eq(jobs.field, field))
    : eq(jobs.status, "published");

  return db.select().from(jobs).where(where).orderBy(desc(jobs.publishedAt), desc(jobs.createdAt));
}

export async function listAdminJobs() {
  const db = getDbPg();
  if (!db) return [];
  return db.select().from(jobs).orderBy(desc(jobs.updatedAt));
}

export async function getJobById(id: number) {
  const db = getDbPg();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result[0];
}

export async function createJob(values: typeof jobs.$inferInsert) {
  const db = getDbPg();
  if (!db) throw new Error("Database is unavailable");
  const [row] = await db.insert(jobs).values(values).returning({ id: jobs.id });
  if (!row) throw new Error("Database is unavailable");
  return getJobById(row.id);
}

export async function updateJob(id: number, values: Partial<typeof jobs.$inferInsert>) {
  const db = getDbPg();
  if (!db) throw new Error("Database is unavailable");
  await db.update(jobs).set(values).where(eq(jobs.id, id));
  return getJobById(id);
}

export async function getJobPreference(userId: number) {
  const db = getDbPg();
  if (!db) return undefined;
  const result = await db.select().from(jobPreferences).where(eq(jobPreferences.userId, userId)).limit(1);
  return result[0];
}

export async function upsertJobPreference(values: typeof jobPreferences.$inferInsert) {
  const db = getDbPg();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(jobPreferences).values(values).onConflictDoUpdate({
    target: jobPreferences.userId,
    set: {
      contactEmail: values.contactEmail,
      fields: values.fields,
      emailEnabled: values.emailEnabled,
      updatedAt: new Date(),
    },
  });
  return getJobPreference(values.userId);
}

export async function getJobInterests(userId: number) {
  const db = getDbPg();
  if (!db) return [];
  return db.select().from(jobInterests).where(eq(jobInterests.userId, userId));
}

export async function upsertJobInterest(values: typeof jobInterests.$inferInsert) {
  const db = getDbPg();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(jobInterests).values(values).onConflictDoUpdate({
    target: [jobInterests.userId, jobInterests.jobId],
    set: { level: values.level, updatedAt: new Date() },
  });
}

export async function listCommunityMessages(limit = 50) {
  const db = getDbPg();
  if (!db) return [];

  const rows = await db
    .select({
      id: communityMessages.id,
      content: communityMessages.content,
      createdAt: communityMessages.createdAt,
      userId: communityMessages.userId,
      userName: users.name,
    })
    .from(communityMessages)
    .innerJoin(users, eq(communityMessages.userId, users.id))
    .orderBy(desc(communityMessages.createdAt))
    .limit(limit);

  return rows.reverse();
}

export async function createCommunityMessage(userId: number, content: string) {
  const db = getDbPg();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(communityMessages).values({ userId, content });
}

function parseFields(value: string) {
  try {
    const fields = JSON.parse(value);
    return Array.isArray(fields) ? fields.filter((field): field is string => typeof field === "string") : [];
  } catch {
    return [];
  }
}

export async function queueMatchedJobEmailDispatches(job: { id: number; field: string }) {
  const db = getDbPg();
  if (!db) return;
  const preferences = await db
    .select()
    .from(jobPreferences)
    .where(eq(jobPreferences.emailEnabled, "yes"));
  const recipients = preferences.filter(preference => parseFields(preference.fields).includes(job.field));

  if (recipients.length === 0) return;
  await db.insert(emailDispatches).values(
    recipients.map(preference => ({
      userId: preference.userId,
      jobId: job.id,
      kind: "job_match" as const,
      recipient: preference.contactEmail,
      status: "queued" as const,
    }))
  );
}

export async function queuePreferenceConfirmation(userId: number, recipient: string) {
  const db = getDbPg();
  if (!db) return;
  await db.insert(emailDispatches).values({
    userId,
    kind: "preference_confirmation",
    recipient,
    status: "queued",
  });
}

export async function getGmailOAuthCredential() {
  const db = getDbPg();
  if (!db) return undefined;
  const result = await db.select().from(gmailOAuthCredentials).orderBy(desc(gmailOAuthCredentials.updatedAt)).limit(1);
  return result[0];
}

export async function upsertGmailOAuthCredential(values: typeof gmailOAuthCredentials.$inferInsert) {
  const db = getDbPg();
  if (!db) throw new Error("Database is unavailable");
  const existing = await getGmailOAuthCredential();
  if (existing) {
    await db.update(gmailOAuthCredentials).set({
      encryptedRefreshToken: values.encryptedRefreshToken,
      scope: values.scope,
      senderEmail: values.senderEmail,
      updatedAt: new Date(),
    }).where(eq(gmailOAuthCredentials.id, existing.id));
    return existing.id;
  }
  const [row] = await db.insert(gmailOAuthCredentials).values(values).returning({ id: gmailOAuthCredentials.id });
  if (!row) throw new Error("Database is unavailable");
  return row.id;
}

export async function updateEmailDispatchStatus(input: {
  userId: number;
  recipient: string;
  kind: "job_match" | "preference_confirmation";
  jobId?: number;
  status: "sent" | "failed";
  errorMessage?: string | null;
}) {
  const db = getDbPg();
  if (!db) return;
  const conditions = [
    eq(emailDispatches.userId, input.userId),
    eq(emailDispatches.recipient, input.recipient),
    eq(emailDispatches.kind, input.kind),
    eq(emailDispatches.status, "queued"),
  ];
  if (input.jobId !== undefined) conditions.push(eq(emailDispatches.jobId, input.jobId));
  await db.update(emailDispatches).set({ status: input.status, errorMessage: input.errorMessage ?? null }).where(and(...conditions));
}

export async function listQueuedEmailDispatches(limit = 100) {
  const db = getDbPg();
  if (!db) return [];
  return db
    .select({
      id: emailDispatches.id,
      userId: emailDispatches.userId,
      jobId: emailDispatches.jobId,
      kind: emailDispatches.kind,
      recipient: emailDispatches.recipient,
      jobTitle: jobs.title,
      company: jobs.company,
      field: jobs.field,
      location: jobs.location,
      workMode: jobs.workMode,
    })
    .from(emailDispatches)
    .leftJoin(jobs, eq(emailDispatches.jobId, jobs.id))
    .where(eq(emailDispatches.status, "queued"))
    .orderBy(asc(emailDispatches.createdAt))
    .limit(limit);
}

export async function updateEmailDispatchById(id: number, status: "sent" | "failed", errorMessage?: string | null) {
  const db = getDbPg();
  if (!db) return;
  await db.update(emailDispatches).set({ status, errorMessage: errorMessage ?? null }).where(eq(emailDispatches.id, id));
}

export async function listMatchingEmailRecipients(field: string) {
  const db = getDbPg();
  if (!db) return [];
  const preferences = await db.select().from(jobPreferences).where(eq(jobPreferences.emailEnabled, "yes"));
  return preferences.filter(preference => parseFields(preference.fields).includes(field));
}
