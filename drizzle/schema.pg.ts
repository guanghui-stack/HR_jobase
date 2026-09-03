import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/**
 * Postgres schema cho Supabase — mirror 1-1 tu drizzle/schema.ts (MySQL).
 * Giu file MySQL cu nguyen cho den khi migrate xong, sau do doi
 * drizzle.config.ts sang dialect=postgresql va schema=./drizzle/schema.pg.ts
 * roi rename file nay thanh schema.ts.
 */

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const jobStatusEnum = pgEnum("job_status", ["draft", "published", "paused", "closed"]);
export const interestLevelEnum = pgEnum("interest_level", ["following", "interested", "high"]);
export const emailEnabledEnum = pgEnum("email_enabled", ["yes", "no"]);
export const dispatchKindEnum = pgEnum("dispatch_kind", ["job_match", "preference_confirmation"]);
export const dispatchStatusEnum = pgEnum("dispatch_status", ["queued", "sent", "failed"]);

export const jobStatusValues = ["draft", "published", "paused", "closed"] as const;
export const interestLevelValues = ["following", "interested", "high"] as const;

// Lien ket voi Supabase Auth qua auth.users.id (uuid). Giu them openId
// de tuong thich du lieu cu trong qua trinh chuyen doi.
export const users = pgTable("users", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  supabaseId: varchar("supabase_id", { length: 64 }),
  openId: varchar("open_id", { length: 64 }),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSignedIn: timestamp("last_signed_in").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const jobs = pgTable(
  "jobs",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    title: varchar("title", { length: 180 }).notNull(),
    company: varchar("company", { length: 160 }).notNull(),
    field: varchar("field", { length: 80 }).notNull(),
    location: varchar("location", { length: 160 }).notNull(),
    employmentType: varchar("employment_type", { length: 80 }).notNull(),
    workMode: varchar("work_mode", { length: 80 }).notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    salaryLabel: varchar("salary_label", { length: 120 }),
    status: jobStatusEnum("status").default("draft").notNull(),
    createdBy: integer("created_by").notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  table => [
    index("jobs_status_idx").on(table.status),
    index("jobs_field_idx").on(table.field),
    index("jobs_created_by_idx").on(table.createdBy),
  ]
);

export const jobPreferences = pgTable(
  "job_preferences",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("user_id").notNull(),
    contactEmail: varchar("contact_email", { length: 320 }).notNull(),
    fields: text("fields").notNull(),
    emailEnabled: emailEnabledEnum("email_enabled").default("yes").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  table => [uniqueIndex("job_preferences_user_id_unique").on(table.userId)]
);

export const jobInterests = pgTable(
  "job_interests",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("user_id").notNull(),
    jobId: integer("job_id").notNull(),
    level: interestLevelEnum("level").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("job_interests_user_job_unique").on(table.userId, table.jobId),
    index("job_interests_job_idx").on(table.jobId),
  ]
);

export const communityMessages = pgTable(
  "community_messages",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("user_id").notNull(),
    content: varchar("content", { length: 1000 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [index("community_messages_created_at_idx").on(table.createdAt)]
);

export const emailDispatches = pgTable(
  "email_dispatches",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    userId: integer("user_id").notNull(),
    jobId: integer("job_id"),
    kind: dispatchKindEnum("kind").notNull(),
    recipient: varchar("recipient", { length: 320 }).notNull(),
    status: dispatchStatusEnum("status").default("queued").notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  table => [
    index("email_dispatches_user_id_idx").on(table.userId),
    index("email_dispatches_job_id_idx").on(table.jobId),
  ]
);

export const gmailOAuthCredentials = pgTable("gmail_oauth_credentials", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  encryptedRefreshToken: text("encrypted_refresh_token").notNull(),
  scope: text("scope").notNull(),
  senderEmail: varchar("sender_email", { length: 320 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Job = typeof jobs.$inferSelect;
export type JobPreference = typeof jobPreferences.$inferSelect;
export type JobInterest = typeof jobInterests.$inferSelect;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type GmailOAuthCredential = typeof gmailOAuthCredentials.$inferSelect;
