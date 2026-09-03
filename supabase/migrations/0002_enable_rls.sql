-- Bat Row Level Security cho toan bo bang trong schema public.
-- Chay trong Supabase Dashboard > SQL Editor (paste toan bo file, Run).
--
-- TAI SAO BAT BUOC: Supabase expose moi bang trong schema `public` ra PostgREST
-- (https://<project>.supabase.co/rest/v1/<table>). Anon key nam san trong bundle
-- JS cong khai, nen neu khong bat RLS thi BAT KY AI cung doc/ghi duoc bang users,
-- jobs, community_messages... chi bang mot lenh curl.
--
-- App nay khong truy cap DB bang anon key: server dung DATABASE_URL (Drizzle,
-- ket noi Postgres truc tiep) va service_role key. Ca hai deu BO QUA RLS, nen
-- bat RLS ma khong tao policy nao se chan sach duong PostgREST cong khai
-- ma KHONG lam hong bat ky chuc nang nao cua app.

alter table public.users                   enable row level security;
alter table public.jobs                    enable row level security;
alter table public.job_preferences         enable row level security;
alter table public.job_interests           enable row level security;
alter table public.community_messages      enable row level security;
alter table public.email_dispatches        enable row level security;
alter table public.gmail_oauth_credentials enable row level security;

-- Chan luon quyen mac dinh o tang GRANT (phong khi sau nay co ai them policy).
-- gmail_oauth_credentials chua refresh token da ma hoa — tuyet doi khong lo.
revoke all on public.users                   from anon, authenticated;
revoke all on public.jobs                    from anon, authenticated;
revoke all on public.job_preferences         from anon, authenticated;
revoke all on public.job_interests           from anon, authenticated;
revoke all on public.community_messages      from anon, authenticated;
revoke all on public.email_dispatches        from anon, authenticated;
revoke all on public.gmail_oauth_credentials from anon, authenticated;

-- Kiem tra: cau lenh duoi phai tra rowsecurity = true cho ca 7 bang.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public';
