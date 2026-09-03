-- HR_jobase initial schema (Supabase / Postgres)
-- Chay trong Supabase Dashboard > SQL Editor (paste toan bo file, Run).
-- Mirror tu drizzle/schema.ts (MySQL): doi camelCase sang snake_case.

create type role as enum ('user', 'admin');
create type job_status as enum ('draft', 'published', 'paused', 'closed');
create type interest_level as enum ('following', 'interested', 'high');
create type email_enabled as enum ('yes', 'no');
create type dispatch_kind as enum ('job_match', 'preference_confirmation');
create type dispatch_status as enum ('queued', 'sent', 'failed');

create table users (
  id integer generated always as identity primary key,
  supabase_id varchar(64),
  open_id varchar(64),
  name text,
  email varchar(320),
  login_method varchar(64),
  role role default 'user' not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  last_signed_in timestamptz default now() not null
);
create unique index users_supabase_id_unique on users (supabase_id);

create table jobs (
  id integer generated always as identity primary key,
  title varchar(180) not null,
  company varchar(160) not null,
  field varchar(80) not null,
  location varchar(160) not null,
  employment_type varchar(80) not null,
  work_mode varchar(80) not null,
  summary text not null,
  description text not null,
  salary_label varchar(120),
  status job_status default 'draft' not null,
  created_by integer not null references users (id),
  published_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
create index jobs_status_idx on jobs (status);
create index jobs_field_idx on jobs (field);

create table job_preferences (
  id integer generated always as identity primary key,
  user_id integer not null references users (id) on delete cascade,
  contact_email varchar(320) not null,
  fields text not null,
  email_enabled email_enabled default 'yes' not null,
  updated_at timestamptz default now() not null,
  unique (user_id)
);

create table job_interests (
  id integer generated always as identity primary key,
  user_id integer not null references users (id) on delete cascade,
  job_id integer not null references jobs (id) on delete cascade,
  level interest_level not null,
  updated_at timestamptz default now() not null,
  unique (user_id, job_id)
);
create index job_interests_job_idx on job_interests (job_id);

create table community_messages (
  id integer generated always as identity primary key,
  user_id integer not null references users (id) on delete cascade,
  content varchar(1000) not null,
  created_at timestamptz default now() not null
);
create index community_messages_created_at_idx on community_messages (created_at);

create table email_dispatches (
  id integer generated always as identity primary key,
  user_id integer not null references users (id) on delete cascade,
  job_id integer references jobs (id) on delete set null,
  kind dispatch_kind not null,
  recipient varchar(320) not null,
  status dispatch_status default 'queued' not null,
  error_message text,
  created_at timestamptz default now() not null
);
create index email_dispatches_user_id_idx on email_dispatches (user_id);
create index email_dispatches_job_id_idx on email_dispatches (job_id);

create table gmail_oauth_credentials (
  id integer generated always as identity primary key,
  encrypted_refresh_token text not null,
  scope text not null,
  sender_email varchar(320) not null,
  updated_at timestamptz default now() not null
);
