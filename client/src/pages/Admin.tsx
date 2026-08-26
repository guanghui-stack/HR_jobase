import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, LayoutDashboard, Link2, MailCheck, Plus, Save, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type JobStatus = "draft" | "published" | "paused" | "closed";

const EMPTY_JOB: {
  title: string;
  company: string;
  field: string;
  location: string;
  employmentType: string;
  workMode: string;
  summary: string;
  description: string;
  salaryLabel: string;
  status: JobStatus;
} = {
  title: "",
  company: "",
  field: "Engineering",
  location: "",
  employmentType: "Toàn thời gian",
  workMode: "Hybrid",
  summary: "",
  description: "",
  salaryLabel: "",
  status: "draft",
};

type EditorState = typeof EMPTY_JOB & { id?: number };

function formatStatus(status: string) {
  return ({ draft: "Bản nháp", published: "Đã công bố", paused: "Tạm dừng", closed: "Đã đóng" } as Record<string, string>)[status] || status;
}

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [editor, setEditor] = useState<EditorState>(EMPTY_JOB);
  const utils = trpc.useUtils();
  const jobsQuery = trpc.jobs.listAdmin.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });
  const gmailStatusQuery = trpc.gmail.status.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin" });

  const createJob = trpc.jobs.create.useMutation({
    onSuccess: () => {
      toast.success("Công việc đã được tạo.");
      setEditor(EMPTY_JOB);
      utils.jobs.listAdmin.invalidate();
      utils.jobs.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateJob = trpc.jobs.update.useMutation({
    onSuccess: () => {
      toast.success("Công việc đã được cập nhật.");
      setEditor(EMPTY_JOB);
      utils.jobs.listAdmin.invalidate();
      utils.jobs.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  useEffect(() => {
    if (editor.id && !jobsQuery.data?.some(job => job.id === editor.id)) setEditor(EMPTY_JOB);
  }, [editor.id, jobsQuery.data]);

  function startEdit(job: NonNullable<typeof jobsQuery.data>[number]) {
    setEditor({
      id: job.id,
      title: job.title,
      company: job.company,
      field: job.field,
      location: job.location,
      employmentType: job.employmentType,
      workMode: job.workMode,
      summary: job.summary,
      description: job.description,
      salaryLabel: job.salaryLabel || "",
      status: job.status as JobStatus,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { ...editor, salaryLabel: editor.salaryLabel || null };
    if (editor.id) updateJob.mutate(payload as Parameters<typeof updateJob.mutate>[0]);
    else createJob.mutate(payload as Parameters<typeof createJob.mutate>[0]);
  }

  if (loading) return <div className="admin-page"><div className="admin-loading">Đang kiểm tra quyền truy cập...</div></div>;
  if (!isAuthenticated) return <div className="admin-page"><div className="admin-gate"><ShieldCheck size={28} /><h1>Khu vực quản trị Jobase</h1><p>Đăng nhập bằng tài khoản quản trị để quản lý các công việc được công bố.</p><button className="button-primary" onClick={startLogin}>Đăng nhập</button><Link href="/">Quay về Jobase</Link></div></div>;
  if (user?.role !== "admin") return <div className="admin-page"><div className="admin-gate"><ShieldCheck size={28} /><h1>Bạn chưa có quyền quản trị.</h1><p>Chỉ tài khoản được cấp vai trò quản trị mới có thể thêm, chỉnh sửa hoặc thay đổi trạng thái công việc.</p><Link href="/">Quay về Jobase</Link></div></div>;

  const isSaving = createJob.isPending || updateJob.isPending;
  return <div className="admin-page">
    <header className="admin-header"><div className="container admin-header-inner"><Link className="admin-back" href="/"><ArrowLeft size={16} /> Xem trang công khai</Link><div className="admin-brand"><LayoutDashboard size={17} /> JOBBASE / ADMIN</div><span className="admin-user"><ShieldCheck size={15} /> {user.name || "Quản trị viên"}</span></div></header>
    <main className="container admin-main">
      <div className="admin-intro"><div><p className="eyebrow"><ShieldCheck size={14} /> Quản lý nội dung</p><h1>Giữ nhịp công việc rõ ràng.</h1></div><p>Tạo vai trò mới, chỉnh sửa thông tin và quyết định khi nào một cơ hội được xuất bản đến cộng đồng Jobase.</p></div>
      <div className={gmailStatusQuery.data?.connected ? "gmail-banner is-connected" : "gmail-banner"}><span>{gmailStatusQuery.data?.connected ? <MailCheck size={17} /> : <Link2 size={17} />}</span><div><strong>{gmailStatusQuery.data?.connected ? "Gmail đã sẵn sàng gửi thông báo" : "Kết nối Gmail để tự động gửi thông báo"}</strong><p>{gmailStatusQuery.data?.connected ? "Công việc mới phù hợp và thay đổi tuỳ chọn sẽ được gửi từ hộp thư đã cấp quyền." : "Chỉ cần một lần cấp quyền bằng tài khoản Gmail dùng để gửi email Jobase."}</p></div>{!gmailStatusQuery.data?.connected && <a className="button-primary" href="/api/gmail/oauth/authorize">Kết nối Gmail</a>}</div>
      <div className="admin-grid">
        <form className="admin-editor" onSubmit={handleSubmit}>
          <div className="editor-heading"><div><span className="admin-kicker">{editor.id ? "Chỉnh sửa công việc" : "Công việc mới"}</span><h2>{editor.id ? editor.title || "Cập nhật vai trò" : "Soạn một cơ hội mới"}</h2></div>{editor.id && <button type="button" className="text-link" onClick={() => setEditor(EMPTY_JOB)}>Tạo mới</button>}</div>
          <div className="editor-fields two-col"><label>Tiêu đề<input className="brand-input" required value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} /></label><label>Doanh nghiệp<input className="brand-input" required value={editor.company} onChange={event => setEditor({ ...editor, company: event.target.value })} /></label><label>Lĩnh vực<input className="brand-input" required value={editor.field} onChange={event => setEditor({ ...editor, field: event.target.value })} /></label><label>Địa điểm<input className="brand-input" required value={editor.location} onChange={event => setEditor({ ...editor, location: event.target.value })} /></label><label>Hình thức<input className="brand-input" required value={editor.employmentType} onChange={event => setEditor({ ...editor, employmentType: event.target.value })} /></label><label>Cách làm việc<input className="brand-input" required value={editor.workMode} onChange={event => setEditor({ ...editor, workMode: event.target.value })} /></label><label>Mức thu nhập<input className="brand-input" value={editor.salaryLabel} onChange={event => setEditor({ ...editor, salaryLabel: event.target.value })} placeholder="Tuỳ chọn" /></label><label>Trạng thái<select className="brand-input" value={editor.status} onChange={event => setEditor({ ...editor, status: event.target.value as EditorState["status"] })}><option value="draft">Bản nháp</option><option value="published">Đã công bố</option><option value="paused">Tạm dừng</option><option value="closed">Đã đóng</option></select></label></div>
          <div className="editor-fields"><label>Tóm tắt<textarea className="brand-input" required rows={3} value={editor.summary} onChange={event => setEditor({ ...editor, summary: event.target.value })} /></label><label>Mô tả chi tiết<textarea className="brand-input" required rows={7} value={editor.description} onChange={event => setEditor({ ...editor, description: event.target.value })} /></label></div>
          <button className="button-primary" type="submit" disabled={isSaving}>{editor.id ? <Save size={16} /> : <Plus size={16} />}{editor.id ? "Lưu thay đổi" : "Tạo công việc"}</button>
        </form>
        <section className="admin-list"><div className="admin-list-heading"><div><span className="admin-kicker">Thư viện công việc</span><h2>Các vai trò đang quản lý</h2></div><span className="soft-tag"><Check size={13} /> {jobsQuery.data?.length || 0}</span></div>
          {jobsQuery.isLoading ? <p className="admin-empty">Đang tải danh sách...</p> : jobsQuery.data?.length ? <div className="admin-job-list">{jobsQuery.data.map(job => <button className={editor.id === job.id ? "admin-job-row is-active" : "admin-job-row"} type="button" key={job.id} onClick={() => startEdit(job)}><span><strong>{job.title}</strong><small>{job.company} · {job.field}</small></span><em className={`status-${job.status}`}>{formatStatus(job.status)}</em></button>)}</div> : <div className="admin-empty"><Plus size={19} /><p>Chưa có công việc nào. Hãy tạo vai trò đầu tiên ở biểu mẫu bên trái.</p></div>}
        </section>
      </div>
    </main>
  </div>;
}
