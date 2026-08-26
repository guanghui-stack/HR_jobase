import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { interestLevelValues, jobStatusValues } from "../../drizzle/schema";
import {
  createCommunityMessage,
  createJob,
  getJobById,
  getJobInterests,
  getJobPreference,
  listAdminJobs,
  listCommunityMessages,
  listPublishedJobs,
  queueMatchedJobEmailDispatches,
  queuePreferenceConfirmation,
  updateJob,
  upsertJobInterest,
  upsertJobPreference,
} from "../db";
import { deliverJobMatchNotifications, deliverPreferenceConfirmation, isGmailConnected } from "../gmail";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Chỉ quản trị viên mới có thể thực hiện thao tác này." });
  }
  return next({ ctx });
});

const jobPayload = z.object({
  title: z.string().trim().min(3).max(180),
  company: z.string().trim().min(2).max(160),
  field: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(160),
  employmentType: z.string().trim().min(2).max(80),
  workMode: z.string().trim().min(2).max(80),
  summary: z.string().trim().min(10).max(1000),
  description: z.string().trim().min(20).max(8000),
  salaryLabel: z.string().trim().max(120).nullable(),
  status: z.enum(jobStatusValues),
});

export const jobaseRouter = {
  jobs: router({
    list: publicProcedure
      .input(z.object({ field: z.string().trim().optional() }))
      .query(({ input }) => listPublishedJobs(input.field)),
    listAdmin: adminProcedure.query(() => listAdminJobs()),
    create: adminProcedure.input(jobPayload).mutation(async ({ ctx, input }) => {
      const job = await createJob({
        ...input,
        salaryLabel: input.salaryLabel || null,
        createdBy: ctx.user.id,
        publishedAt: input.status === "published" ? new Date() : null,
      });
      if (!job) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Không thể tạo công việc." });
      if (job.status === "published") {
        await queueMatchedJobEmailDispatches(job);
        await deliverJobMatchNotifications(job);
      }
      return job;
    }),
    update: adminProcedure
      .input(jobPayload.partial().extend({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const { id, ...changes } = input;
        const current = await getJobById(id);
        if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Không tìm thấy công việc." });
        const nextStatus = changes.status ?? current.status;
        const job = await updateJob(id, {
          ...changes,
          salaryLabel: changes.salaryLabel === undefined ? undefined : changes.salaryLabel || null,
          publishedAt: current.status !== "published" && nextStatus === "published" ? new Date() : current.publishedAt,
        });
        if (job && current.status !== "published" && job.status === "published") {
          await queueMatchedJobEmailDispatches(job);
          await deliverJobMatchNotifications(job);
        }
        return job;
      }),
  }),
  preferences: router({
    get: protectedProcedure.query(({ ctx }) => getJobPreference(ctx.user.id)),
    save: protectedProcedure
      .input(
        z.object({
          contactEmail: z.string().trim().email().max(320),
          fields: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
          emailEnabled: z.enum(["yes", "no"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const fields = Array.from(new Set(input.fields));
        const preference = await upsertJobPreference({
          userId: ctx.user.id,
          contactEmail: input.contactEmail,
          fields: JSON.stringify(fields),
          emailEnabled: input.emailEnabled,
        });
        await queuePreferenceConfirmation(ctx.user.id, input.contactEmail);
        await deliverPreferenceConfirmation({
          userId: ctx.user.id,
          recipient: input.contactEmail,
          fields,
          emailEnabled: input.emailEnabled,
        });
        return preference;
      }),
  }),
  interests: router({
    list: protectedProcedure.query(({ ctx }) => getJobInterests(ctx.user.id)),
    save: protectedProcedure
      .input(z.object({ jobId: z.number().int().positive(), level: z.enum(interestLevelValues) }))
      .mutation(async ({ ctx, input }) => {
        const job = await getJobById(input.jobId);
        if (!job || job.status !== "published") {
          throw new TRPCError({ code: "NOT_FOUND", message: "Công việc này hiện không khả dụng." });
        }
        await upsertJobInterest({ userId: ctx.user.id, jobId: input.jobId, level: input.level });
        return { success: true } as const;
      }),
  }),
  community: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
      .query(({ input }) => listCommunityMessages(input.limit)),
    send: protectedProcedure
      .input(z.object({ content: z.string().trim().min(1).max(1000) }))
      .mutation(async ({ ctx, input }) => {
        await createCommunityMessage(ctx.user.id, input.content);
        return { success: true } as const;
      }),
  }),
  gmail: router({
    status: adminProcedure.query(async () => ({ connected: await isGmailConnected() })),
  }),
};
