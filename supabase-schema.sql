-- 修仙打卡器 · Supabase 建表脚本
-- 在 Supabase 控制台 → SQL Editor → 新建查询，粘贴全部内容并 Run。

-- 1. 打卡记录表
create table if not exists public.records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  color text not null check (color in ('green', 'red')),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint records_user_date_unique unique (user_id, date_key)
);

-- 2. 用户设置表（背景图/图标 URL）
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  background_url text not null default '',
  icon_url text not null default '',
  updated_at timestamptz not null default now()
);

-- 3. 开启行级安全
alter table public.records enable row level security;
alter table public.settings enable row level security;

-- 4. records 表权限（每人只能读写自己的行）
create policy "records_select_own" on public.records
  for select using (auth.uid() = user_id);
create policy "records_insert_own" on public.records
  for insert with check (auth.uid() = user_id);
create policy "records_update_own" on public.records
  for update using (auth.uid() = user_id);
create policy "records_delete_own" on public.records
  for delete using (auth.uid() = user_id);

-- 5. settings 表权限（每人只能读写自己那行）
create policy "settings_select_own" on public.settings
  for select using (auth.uid() = user_id);
create policy "settings_insert_own" on public.settings
  for insert with check (auth.uid() = user_id);
create policy "settings_update_own" on public.settings
  for update using (auth.uid() = user_id);
