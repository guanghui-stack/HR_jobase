import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const db = vi.hoisted(() => ({
  createCommunityMessage: vi.fn(),
  createJob: vi.fn(),
  getGmailOAuthCredential: vi.fn(),
  getJobById: vi.fn(),
  getJobInterests: vi.fn(),
  getJobPreference: vi.fn(),
  listAdminJobs: vi.fn(),
  listCommunityMessages: vi.fn(),
  listMatchingEmailRecipients: vi.fn(),
  listPublishedJobs: vi.fn(),
  queueMatchedJobEmailDispatches: vi.fn(),
  queuePreferenceConfirmation: vi.fn(),
  updateJob: vi.fn(),
  updateEmailDispatchStatus: vi.fn(),
  upsertJobInterest: vi.fn(),
  upsertJobPreference: vi.fn(),
}));

vi.mock("../db", () => db);

import { appRouter } from "../routers";

function createContext(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: {
      id: 17,
      openId: "jobase-test-user",
      name: "Jobase Tester",
      email: "tester@example.com",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Jobase procedures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trả về danh sách công việc đã công bố theo lĩnh vực", async () => {
    db.listPublishedJobs.mockResolvedValue([{ id: 7, title: "Product Designer", field: "Design" }]);
    const caller = appRouter.createCaller(createContext());

    const result = await caller.jobs.list({ field: "Design" });

    expect(db.listPublishedJobs).toHaveBeenCalledWith("Design");
    expect(result).toEqual([{ id: 7, title: "Product Designer", field: "Design" }]);
  });

  it("ngăn người dùng phổ thông truy cập danh sách quản trị", async () => {
    const caller = appRouter.createCaller(createContext("user"));

    await expect(caller.jobs.listAdmin()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.listAdminJobs).not.toHaveBeenCalled();
  });

  it("tạo và gửi công việc đã công bố vào hàng đợi thông báo phù hợp", async () => {
    const publishedJob = { id: 22, field: "Engineering", status: "published" };
    db.createJob.mockResolvedValue(publishedJob);
    const caller = appRouter.createCaller(createContext("admin"));

    await caller.jobs.create({
      title: "Software Engineer",
      company: "Jobase Labs",
      field: "Engineering",
      location: "Hồ Chí Minh",
      employmentType: "Toàn thời gian",
      workMode: "Hybrid",
      summary: "Xây dựng những trải nghiệm hỗ trợ hành trình nghề nghiệp.",
      description: "Bạn sẽ làm việc cùng nhóm sản phẩm để phát triển các tính năng có chiều sâu cho cộng đồng Jobase.",
      salaryLabel: null,
      status: "published",
    });

    expect(db.createJob).toHaveBeenCalledWith(expect.objectContaining({ createdBy: 17, status: "published" }));
    expect(db.queueMatchedJobEmailDispatches).toHaveBeenCalledWith(publishedJob);
  });

  it("đưa thông báo vào hàng đợi khi công việc chuyển từ bản nháp sang đã công bố", async () => {
    const publishedJob = { id: 31, field: "Product", status: "published" };
    db.getJobById.mockResolvedValue({ id: 31, field: "Product", status: "draft", publishedAt: null });
    db.updateJob.mockResolvedValue(publishedJob);
    const caller = appRouter.createCaller(createContext("admin"));

    await caller.jobs.update({ id: 31, status: "published" });

    expect(db.updateJob).toHaveBeenCalledWith(31, expect.objectContaining({ status: "published", publishedAt: expect.any(Date) }));
    expect(db.queueMatchedJobEmailDispatches).toHaveBeenCalledWith(publishedJob);
  });

  it("đưa thông báo vào hàng đợi khi công việc chuyển từ tạm dừng sang đã công bố", async () => {
    const publishedJob = { id: 32, field: "Design", status: "published" };
    db.getJobById.mockResolvedValue({ id: 32, field: "Design", status: "paused", publishedAt: new Date("2026-01-01") });
    db.updateJob.mockResolvedValue(publishedJob);
    const caller = appRouter.createCaller(createContext("admin"));

    await caller.jobs.update({ id: 32, status: "published" });

    expect(db.updateJob).toHaveBeenCalledWith(32, expect.objectContaining({ status: "published", publishedAt: expect.any(Date) }));
    expect(db.queueMatchedJobEmailDispatches).toHaveBeenCalledTimes(1);
    expect(db.queueMatchedJobEmailDispatches).toHaveBeenCalledWith(publishedJob);
  });

  it("cập nhật tuỳ chọn nhận tin và đưa xác nhận vào hàng đợi", async () => {
    db.upsertJobPreference.mockResolvedValue({ userId: 17, contactEmail: "tester@example.com" });
    const caller = appRouter.createCaller(createContext());

    await caller.preferences.save({
      contactEmail: "tester@example.com",
      fields: ["Design", "Design", "Product"],
      emailEnabled: "yes",
    });

    expect(db.upsertJobPreference).toHaveBeenCalledWith(expect.objectContaining({
      userId: 17,
      fields: JSON.stringify(["Design", "Product"]),
      emailEnabled: "yes",
    }));
    expect(db.queuePreferenceConfirmation).toHaveBeenCalledWith(17, "tester@example.com");
  });

  it("lưu mức độ quan tâm cho công việc công bố", async () => {
    db.getJobById.mockResolvedValue({ id: 7, status: "published" });
    const caller = appRouter.createCaller(createContext());

    await expect(caller.interests.save({ jobId: 7, level: "high" })).resolves.toEqual({ success: true });
    expect(db.upsertJobInterest).toHaveBeenCalledWith({ userId: 17, jobId: 7, level: "high" });
  });

  it("xác thực tuỳ chọn nhận tin trước khi ghi dữ liệu", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.preferences.save({ contactEmail: "tester@example.com", fields: [], emailEnabled: "yes" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.upsertJobPreference).not.toHaveBeenCalled();
  });

  it("lưu tin nhắn cộng đồng đã được trim cho người dùng đăng nhập", async () => {
    db.createCommunityMessage.mockResolvedValue(undefined);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.community.send({ content: "  Chúc mọi người một ngày tốt lành.  " })).resolves.toEqual({ success: true });
    expect(db.createCommunityMessage).toHaveBeenCalledWith(17, "Chúc mọi người một ngày tốt lành.");
  });
});
