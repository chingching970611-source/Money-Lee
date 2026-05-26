alter table public.transactions
add column if not exists money_source text not null default '电子钱包';

alter table public.transactions
add column if not exists receipt_image text;

create table if not exists public.year_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_year integer not null,
  income_amount numeric(12, 2) not null default 0,
  income_source text not null default '薪水',
  budget numeric(12, 2) not null default 1200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, plan_year)
);

alter table public.year_plans enable row level security;

drop policy if exists "Users can read own year plans" on public.year_plans;
drop policy if exists "Users can add own year plans" on public.year_plans;
drop policy if exists "Users can update own year plans" on public.year_plans;
drop policy if exists "Users can delete own year plans" on public.year_plans;

create policy "Users can read own year plans"
on public.year_plans
for select
using (auth.uid() = user_id);

create policy "Users can add own year plans"
on public.year_plans
for insert
with check (auth.uid() = user_id);

create policy "Users can update own year plans"
on public.year_plans
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own year plans"
on public.year_plans
for delete
using (auth.uid() = user_id);
