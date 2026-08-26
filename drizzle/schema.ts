import {
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const jobStatusValues = ["draft", "published", "paused", "closed"] as const;
export const interestLevelValues = ["following", "interested", "high"] as const;

export const jobs = mysqlTable(
  "jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 180 }).notNull(),
    company: varchar("company", { length: 160 }).notNull(),
    field: varchar("field", { length: 80 }).notNull(),
    location: varchar("location", { length: 160 }).notNull(),
    employmentType: varchar("employmentType", { length: 80 }).notNull(),
    workMode: varchar("workMode", { length: 80 }).notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    salaryLabel: varchar("salaryLabel", { length: 120 }),
    status: mysqlEnum("status", jobStatusValues).default("draft").notNull(),
    createdBy: int("createdBy").notNull(),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("jobs_status_idx").on(table.status),
    index("jobs_field_idx").on(table.field),
    index("jobs_createdBy_idx").on(table.createdBy),
  ]
);

export const jobPreferences = mysqlTable(
  "job_preferences",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
    fields: text("fields").notNull(),
    emailEnabled: mysqlEnum("emailEnabled", ["yes", "no"]).default("yes").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("job_preferences_userId_unique").on(table.userId)]
);

export const jobInterests = mysqlTable(
  "job_interests",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    jobId: int("jobId").notNull(),
    level: mysqlEnum("level", interestLevelValues).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("job_interests_user_job_unique").on(table.userId, table.jobId),
    index("job_interests_job_idx").on(table.jobId),
  ]
);

export const communityMessages = mysqlTable(
  "community_messages",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    content: varchar("content", { length: 1000 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("community_messages_createdAt_idx").on(table.createdAt)]
);

export const emailDispatches = mysqlTable(
  "email_dispatches",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    jobId: int("jobId"),
    kind: mysqlEnum("kind", ["job_match", "preference_confirmation"]).notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    status: mysqlEnum("status", ["queued", "sent", "failed"]).default("queued").notNull(),
    errorMessage: text("errorMessage"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("email_dispatches_userId_idx").on(table.userId),
    index("email_dispatches_jobId_idx").on(table.jobId),
  ]
);

export const gmailOAuthCredentials = mysqlTable("gmail_oauth_credentials", {
  id: int("id").autoincrement().primaryKey(),
  encryptedRefreshToken: text("encryptedRefreshToken").notNull(),
  scope: text("scope").notNull(),
  senderEmail: varchar("senderEmail", { length: 320 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type JobPreference = typeof jobPreferences.$inferSelect;
export type JobInterest = typeof jobInterests.$inferSelect;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type GmailOAuthCredential = typeof gmailOAuthCredentials.$inferSelect;
