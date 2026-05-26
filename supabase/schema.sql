create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  title text not null,
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  transaction_date date not null,
  receipt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.monthly_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  budget numeric(12, 2) not null default 1200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month_start)
);

alter table public.transactions enable row level security;
alter table public.monthly_settings enable row level security;

create policy "Users can read own transactions"
on public.transactions
for select
using (auth.uid() = user_id);

create policy "Users can add own transactions"
on public.transactions
for insert
with check (auth.uid() = user_id);

create policy "Users can update own transactions"
on public.transactions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own transactions"
on public.transactions
for delete
using (auth.uid() = user_id);

create policy "Users can read own monthly settings"
on public.monthly_settings
for select
using (auth.uid() = user_id);

create policy "Users can add own monthly settings"
on public.monthly_settings
for insert
with check (auth.uid() = user_id);

create policy "Users can update own monthly settings"
on public.monthly_settings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own monthly settings"
on public.monthly_settings
for delete
using (auth.uid() = user_id);
