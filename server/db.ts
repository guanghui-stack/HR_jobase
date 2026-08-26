import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  communityMessages,
  emailDispatches,
  gmailOAuthCredentials,
  jobInterests,
  jobPreferences,
  jobs,
  type InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
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
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "user");
  updateSet.role = values.role;

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listPublishedJobs(field?: string) {
  const db = await getDb();
  if (!db) return [];

  const where = field && field !== "all"
    ? and(eq(jobs.status, "published"), eq(jobs.field, field))
    : eq(jobs.status, "published");

  return db.select().from(jobs).where(where).orderBy(desc(jobs.publishedAt), desc(jobs.createdAt));
}

export async function listAdminJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobs).orderBy(desc(jobs.updatedAt));
}

export async function getJobById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return result[0];
}

export async function createJob(values: typeof jobs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const [result] = await db.insert(jobs).values(values);
  return getJobById(Number(result.insertId));
}

export async function updateJob(id: number, values: Partial<typeof jobs.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(jobs).set(values).where(eq(jobs.id, id));
  return getJobById(id);
}

export async function getJobPreference(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jobPreferences).where(eq(jobPreferences.userId, userId)).limit(1);
  return result[0];
}

export async function upsertJobPreference(values: typeof jobPreferences.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(jobPreferences).values(values).onDuplicateKeyUpdate({
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
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jobInterests).where(eq(jobInterests.userId, userId));
}

export async function upsertJobInterest(values: typeof jobInterests.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(jobInterests).values(values).onDuplicateKeyUpdate({
    set: { level: values.level, updatedAt: new Date() },
  });
}

export async function listCommunityMessages(limit = 50) {
  const db = await getDb();
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
  const db = await getDb();
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
  const db = await getDb();
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
  const db = await getDb();
  if (!db) return;
  await db.insert(emailDispatches).values({
    userId,
    kind: "preference_confirmation",
    recipient,
    status: "queued",
  });
}

export async function getGmailOAuthCredential() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gmailOAuthCredentials).orderBy(desc(gmailOAuthCredentials.updatedAt)).limit(1);
  return result[0];
}

export async function upsertGmailOAuthCredential(values: typeof gmailOAuthCredentials.$inferInsert) {
  const db = await getDb();
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
  const [result] = await db.insert(gmailOAuthCredentials).values(values);
  return Number(result.insertId);
}

export async function updateEmailDispatchStatus(input: {
  userId: number;
  recipient: string;
  kind: "job_match" | "preference_confirmation";
  jobId?: number;
  status: "sent" | "failed";
  errorMessage?: string | null;
}) {
  const db = await getDb();
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

export async function listMatchingEmailRecipients(field: string) {
  const db = await getDb();
  if (!db) return [];
  const preferences = await db.select().from(jobPreferences).where(eq(jobPreferences.emailEnabled, "yes"));
  return preferences.filter(preference => parseFields(preference.fields).includes(field));
}
