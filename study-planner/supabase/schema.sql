-- Run this entire script in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.study_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  goal_year integer not null check (goal_year between 2000 and 2100),
  target_hours numeric not null default 120 check (target_hours >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.study_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text not null default '',
  study_date date not null default current_date,
  planned_minutes integer not null default 0 check (planned_minutes >= 0),
  actual_minutes integer not null default 0 check (actual_minutes >= 0),
  completed boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists study_goals_user_year_idx on public.study_goals(user_id, goal_year);
create index if not exists study_tasks_user_date_idx on public.study_tasks(user_id, study_date);

alter table public.study_goals enable row level security;
alter table public.study_tasks enable row level security;

drop policy if exists "Users manage their own study goals" on public.study_goals;
create policy "Users manage their own study goals" on public.study_goals
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own study tasks" on public.study_tasks;
create policy "Users manage their own study tasks" on public.study_tasks
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Monthly and weekly study goals
create table if not exists public.study_period_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_type text not null check (goal_type in ('month','week')),
  period_key text not null,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, goal_type, period_key)
);
create index if not exists study_period_goals_user_period_idx on public.study_period_goals(user_id, goal_type, period_key);
alter table public.study_period_goals enable row level security;
drop policy if exists "Users manage their own study period goals" on public.study_period_goals;
create policy "Users manage their own study period goals" on public.study_period_goals
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
