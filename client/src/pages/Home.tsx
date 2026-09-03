import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Compass,
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Send,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const DEFAULT_FIELDS = ["Product", "Engineering", "Design", "Marketing", "Operations"];
const INTEREST_OPTIONS = [
  { value: "following", label: "Theo dõi" },
  { value: "interested", label: "Quan tâm" },
  { value: "high", label: "Rất quan tâm" },
] as const;

function MeshBackdrop() {
  return (
    <svg className="mesh-backdrop" aria-hidden="true" viewBox="0 0 1600 620" preserveAspectRatio="none">
      <defs>
        <filter id="mesh-blur"><feGaussianBlur stdDeviation="90" /></filter>
      </defs>
      <g filter="url(#mesh-blur)">
        <ellipse cx="98" cy="270" rx="370" ry="240" fill="#F6EEDF" />
        <ellipse cx="420" cy="165" rx="290" ry="245" fill="#DCA16D" opacity="0.77" />
        <ellipse cx="744" cy="270" rx="325" ry="255" fill="#D879D8" opacity="0.62" />
        <ellipse cx="1045" cy="175" rx="325" ry="260" fill="#7377F5" opacity="0.76" />
        <ellipse cx="1440" cy="265" rx="310" ry="245" fill="#E85D75" opacity="0.76" />
      </g>
    </svg>
  );
}

function AppMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </div>
  );
}

/** Header Authorization cho Ably authUrl — server can Supabase JWT de cap token. */
async function buildAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function formatDate(value: Date | string | null) {
  if (!value) return "Mới công bố";
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [selectedField, setSelectedField] = useState("all");
  const [contactEmail, setContactEmail] = useState("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const utils = trpc.useUtils();

  const jobsQuery = trpc.jobs.list.useQuery({ field: selectedField });
  const preferencesQuery = trpc.preferences.get.useQuery(undefined, { enabled: isAuthenticated });
  const interestsQuery = trpc.interests.list.useQuery(undefined, { enabled: isAuthenticated });
  const communityQuery = trpc.community.list.useQuery({ limit: 50 }, { enabled: isAuthenticated, refetchInterval: 15000 });

  useEffect(() => {
    // Realtime qua Ably: co tin moi la refetch ngay, khong doi poll 15s.
    // Token auth — API key chi nam tren server (/api/ably/token). Neu server
    // chua cau hinh ABLY_API_KEY, endpoint tra 503 va poll 15s cu van chay.
    if (!isAuthenticated) return;
    let closed = false;
    let client: { close: () => void } | null = null;
    (async () => {
      try {
        const Ably = await import("ably");
        if (closed) return;
        const realtime = new Ably.Realtime({
          authUrl: "/api/ably/token",
          authMethod: "GET",
          // Supabase JWT de server biet ai dang xin token.
          authHeaders: await buildAuthHeaders(),
        });
        client = realtime;
        const channel = realtime.channels.get("jobase:community");
        await channel.subscribe("message", () => {
          utils.community.list.invalidate();
        });
      } catch (error) {
        console.warn("[Ably] subscribe failed, giu polling:", error);
      }
    })();
    return () => {
      closed = true;
      try {
        client?.close();
      } catch {
        // bo qua loi dong ket noi
      }
    };
  }, [isAuthenticated, utils]);

  useEffect(() => {
    const preference = preferencesQuery.data;
    if (!preference) return;
    setContactEmail(preference.contactEmail);
    setEmailEnabled(preference.emailEnabled === "yes");
    try {
      const fields = JSON.parse(preference.fields);
      if (Array.isArray(fields)) setSelectedFields(fields.filter((field): field is string => typeof field === "string"));
    } catch {
      setSelectedFields([]);
    }
  }, [preferencesQuery.data]);

  useEffect(() => {
    if (!preferencesQuery.data && user?.email) setContactEmail(user.email);
  }, [preferencesQuery.data, user?.email]);

  const availableFields = useMemo(() => {
    const jobFields = jobsQuery.data?.map(job => job.field) ?? [];
    return Array.from(new Set([...DEFAULT_FIELDS, ...jobFields]));
  }, [jobsQuery.data]);

  const fieldFilters = useMemo(() => Array.from(new Set(["all", ...availableFields])), [availableFields]);
  const interestByJob = useMemo(
    () => new Map((interestsQuery.data ?? []).map(interest => [interest.jobId, interest.level])),
    [interestsQuery.data]
  );

  const savePreference = trpc.preferences.save.useMutation({
    onSuccess: () => {
      toast.success("Tùy chọn nhận tin đã được lưu.");
      utils.preferences.get.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const saveInterest = trpc.interests.save.useMutation({
    onSuccess: () => utils.interests.list.invalidate(),
    onError: error => toast.error(error.message),
  });

  const sendMessage = trpc.community.send.useMutation({
    onSuccess: () => {
      setMessage("");
      utils.community.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  function toggleField(field: string) {
    setSelectedFields(current => current.includes(field) ? current.filter(item => item !== field) : [...current, field]);
  }

  function handlePreferenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (selectedFields.length === 0) return toast.error("Hãy chọn ít nhất một lĩnh vực bạn quan tâm.");
    savePreference.mutate({ contactEmail, fields: selectedFields, emailEnabled: emailEnabled ? "yes" : "no" });
  }

  function handleMessageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isAuthenticated) return startLogin();
    if (message.trim()) sendMessage.mutate({ content: message.trim() });
  }

  return (
    <div className="min-h-screen overflow-hidden bg-white text-[#172033]">
      <section className="hero-shell">
        <MeshBackdrop />
        <header className="site-header container">
          <a className="brand-lockup" href="#top" aria-label="Jobase">
            <AppMark />
            <span>jobase</span>
          </a>
          <nav className="header-nav" aria-label="Điều hướng chính">
            <a href="#jobs">Việc làm</a>
            <a href="#preferences">Nhận tin</a>
            <a href="#community">Cộng đồng</a>
          </nav>
          <div className="header-actions">
            {isAuthenticated ? (
              <>
                {user?.role === "admin" && <Link className="nav-admin-link" href="/admin"><LayoutDashboard size={15} /> Quản trị</Link>}
                <button className="account-action" onClick={() => logout()}><LogOut size={16} /><span>{user?.name || "Tài khoản"}</span></button>
              </>
            ) : (
              <button className="button-secondary" onClick={startLogin}>Đăng nhập</button>
            )}
          </div>
        </header>

        <div id="top" className="container hero-content">
          <div className="hero-copy">
            <p className="eyebrow"><Compass size={14} /> Không gian tìm việc có chủ đích</p>
            <h1>Những vai trò phù hợp với cách bạn muốn phát triển.</h1>
            <p className="hero-description">Theo dõi cơ hội do đội ngũ tuyển dụng chọn lọc, giữ nhịp với những lĩnh vực bạn quan tâm và gặp gỡ cộng đồng đang cùng tìm kiếm bước đi tiếp theo.</p>
            <div className="hero-cta-row">
              <a className="button-primary" href="#jobs">Khám phá việc làm <ArrowUpRight size={17} /></a>
              <a className="text-link" href="#preferences">Thiết lập nhận tin <ChevronRight size={17} /></a>
            </div>
          </div>
          <div className="hero-product-card" aria-label="Tổng quan Jobase">
            <div className="product-card-topline"><span>JOB FLOW</span><span className="status-dot">Đang cập nhật</span></div>
            <div className="flow-track"><span /><span /><span /></div>
            <div className="product-card-row"><BriefcaseBusiness size={17} /><span>Cơ hội mới được công bố</span><strong className="tabular">01</strong></div>
            <div className="product-card-row"><Bell size={17} /><span>Lĩnh vực đang theo dõi</span><strong className="tabular">∞</strong></div>
            <div className="product-card-foot">Một không gian bình tĩnh, rõ ràng và luôn có chỗ cho bước tiếp theo.</div>
          </div>
        </div>
      </section>

      <main>
        <section id="jobs" className="section container jobs-section">
          <div className="section-heading split-heading">
            <div>
              <p className="eyebrow"><BriefcaseBusiness size={14} /> Cơ hội đã công bố</p>
              <h2>Việc làm, theo nhịp của bạn.</h2>
            </div>
            <p>Chỉ những vai trò đã được đội ngũ quản trị xuất bản mới hiển thị tại đây. Lọc theo lĩnh vực để tập trung vào điều đáng theo dõi.</p>
          </div>
          <div className="filter-row" aria-label="Lọc theo lĩnh vực">
            <SlidersHorizontal size={16} />
            {fieldFilters.map(field => (
              <button key={field} className={selectedField === field ? "filter-chip is-selected" : "filter-chip"} onClick={() => setSelectedField(field)}>
                {field === "all" ? "Tất cả lĩnh vực" : field}
              </button>
            ))}
          </div>

          {jobsQuery.isLoading ? (
            <div className="job-grid" aria-label="Đang tải công việc"><div className="job-skeleton" /><div className="job-skeleton" /><div className="job-skeleton" /></div>
          ) : jobsQuery.data?.length ? (
            <div className="job-grid">
              {jobsQuery.data.map(job => {
                const currentInterest = interestByJob.get(job.id) ?? "";
                return (
                  <article className="job-card" key={job.id}>
                    <div className="job-card-top"><span className="soft-tag">{job.field}</span><span className="job-date tabular">{formatDate(job.publishedAt)}</span></div>
                    <h3>{job.title}</h3>
                    <p className="job-company">{job.company}</p>
                    <p className="job-summary">{job.summary}</p>
                    <div className="job-meta"><span><MapPin size={14} />{job.location}</span><span>{job.workMode}</span><span>{job.employmentType}</span></div>
                    <div className="job-card-footer">
                      <span className="salary-label tabular">{job.salaryLabel || "Liên hệ để trao đổi"}</span>
                      {isAuthenticated ? (
                        <label className="interest-select"><Heart size={14} /><span className="sr-only">Mức độ quan tâm</span>
                          <select value={currentInterest} onChange={event => { if (event.target.value) saveInterest.mutate({ jobId: job.id, level: event.target.value as "following" | "interested" | "high" }); }}>
                            <option value="">Quan tâm?</option>
                            {INTEREST_OPTIONS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                      ) : (
                        <button className="interest-cta" onClick={startLogin}><Bookmark size={14} /> Lưu để theo dõi</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-jobs"><BriefcaseBusiness size={24} /><h3>Chưa có vai trò nào ở lĩnh vực này.</h3><p>Hãy chọn một lĩnh vực khác hoặc thiết lập nhận tin để không bỏ lỡ lần công bố kế tiếp.</p><a className="text-link" href="#preferences">Thiết lập nhận tin <ChevronRight size={16} /></a></div>
          )}
        </section>

        <section id="preferences" className="preference-band">
          <div className="container preference-layout">
            <div className="preference-copy">
              <p className="eyebrow"><Bell size={14} /> Nhận đúng thông tin</p>
              <h2>Để Jobase lặng lẽ theo dõi giúp bạn.</h2>
              <p>Lưu email và các lĩnh vực bạn đang tìm kiếm. Khi có công việc mới phù hợp được xuất bản, chúng tôi sẽ gửi thông báo đến đúng hộp thư của bạn.</p>
              <div className="preference-note"><Check size={16} /> Bạn có thể thay đổi tuỳ chọn bất cứ lúc nào.</div>
            </div>
            <form className="preference-card" onSubmit={handlePreferenceSubmit}>
              <div className="form-label-row"><label htmlFor="contactEmail">Email nhận thông tin</label>{isAuthenticated && <span className="form-state"><UserRound size={13} /> Đã đăng nhập</span>}</div>
              <input id="contactEmail" className="brand-input" type="email" placeholder="you@example.com" value={contactEmail} onChange={event => setContactEmail(event.target.value)} required />
              <fieldset><legend>Lĩnh vực đang tìm kiếm</legend><div className="field-choice-grid">
                {availableFields.map(field => <label key={field} className={selectedFields.includes(field) ? "field-choice is-checked" : "field-choice"}><input type="checkbox" checked={selectedFields.includes(field)} onChange={() => toggleField(field)} /><span>{field}</span><Check size={14} /></label>)}
              </div></fieldset>
              <label className="email-toggle"><input type="checkbox" checked={emailEnabled} onChange={event => setEmailEnabled(event.target.checked)} /><span>Nhận email khi có vai trò phù hợp</span></label>
              <button type="submit" className="button-primary" disabled={savePreference.isPending}>{isAuthenticated ? "Lưu tuỳ chọn" : "Đăng nhập để lưu"}<ArrowUpRight size={17} /></button>
            </form>
          </div>
        </section>

        <section id="community" className="section container community-section">
          <div className="section-heading split-heading"><div><p className="eyebrow"><MessageCircle size={14} /> Một phòng chung</p><h2>Chia sẻ điều bạn đang tìm kiếm.</h2></div><p>Giữ cuộc trò chuyện gần với hành trình tìm việc: hỏi một điều nhỏ, chia sẻ tín hiệu mới hoặc động viên ai đó đang chuẩn bị cho bước tiếp theo.</p></div>
          <div className="community-shell">
            <div className="community-intro"><div className="community-orb"><MessageCircle size={27} /></div><h3>Nhịp chung của Jobase</h3><p>Luồng chat được lưu lại để người đã đăng nhập có thể tiếp tục cuộc trao đổi, ngay cả khi bạn quay lại sau đó.</p><div className="community-rule"><span /> Tôn trọng, cụ thể và hữu ích.</div></div>
            <div className="community-chat">
              {!isAuthenticated ? (
                <div className="community-gate"><UserRound size={22} /><h3>Đăng nhập để tham gia cuộc trò chuyện.</h3><p>Chúng tôi chỉ mở phần trao đổi cho thành viên đã xác thực để giữ không gian an toàn và có chủ đích.</p><button className="button-primary" onClick={startLogin}>Đăng nhập <ArrowUpRight size={17} /></button></div>
              ) : (
                <>
                  <div className="chat-feed" aria-live="polite">
                    {communityQuery.isLoading ? <p className="chat-empty">Đang tải cuộc trò chuyện...</p> : communityQuery.isError ? <div className="chat-error"><p>Không thể tải cuộc trò chuyện lúc này.</p><button className="button-secondary" type="button" onClick={() => communityQuery.refetch()}>Thử lại</button></div> : communityQuery.data?.length ? communityQuery.data.map(item => <div className={item.userId === user?.id ? "chat-message is-own" : "chat-message"} key={item.id}><div className="chat-message-meta"><span>{item.userName || "Thành viên Jobase"}</span><time className="tabular">{formatDate(item.createdAt)}</time></div><p>{item.content}</p></div>) : <p className="chat-empty">Chưa có tin nhắn. Hãy là người mở đầu một cuộc trò chuyện hữu ích.</p>}
                  </div>
                  <form className="chat-composer" onSubmit={handleMessageSubmit}><input className="brand-input" value={message} onChange={event => setMessage(event.target.value)} maxLength={1000} placeholder="Viết một tin nhắn cho cộng đồng..." /><button className="button-primary" type="submit" disabled={!message.trim() || sendMessage.isPending}><Send size={16} /><span>Gửi</span></button></form>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer"><div className="container footer-grid"><div><a className="brand-lockup" href="#top"><AppMark /><span>jobase</span></a><p>Nơi nhịp tìm việc được giữ nhẹ nhàng, rõ ràng và có cộng đồng đi cùng.</p></div><div><span className="footer-label">Khám phá</span><a href="#jobs">Việc làm</a><a href="#preferences">Nhận tin</a></div><div><span className="footer-label">Không gian chung</span><a href="#community">Cộng đồng</a>{user?.role === "admin" && <Link href="/admin">Quản trị</Link>}</div></div></footer>
    </div>
  );
}
