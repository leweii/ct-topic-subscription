-- Subscriptions table
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  topic_intent text not null,
  time_window text not null check (time_window in ('3d', '7d', '30d')),
  output_mode text not null check (output_mode in ('brief', 'report')),
  frequency text not null check (frequency in ('once', 'daily', 'weekly', 'monthly')),
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,

  unique(user_id)
);

-- Artifacts table
create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content jsonb not null,
  pipeline_log jsonb,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.subscriptions enable row level security;
alter table public.artifacts enable row level security;

-- RLS Policies for subscriptions
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert own subscriptions"
  on public.subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own subscriptions"
  on public.subscriptions for update
  using (auth.uid() = user_id);

create policy "Users can delete own subscriptions"
  on public.subscriptions for delete
  using (auth.uid() = user_id);

-- RLS Policies for artifacts
create policy "Users can view own artifacts"
  on public.artifacts for select
  using (auth.uid() = user_id);

create policy "Users can insert own artifacts"
  on public.artifacts for insert
  with check (auth.uid() = user_id);

-- Updated_at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.handle_updated_at();

-- Indexes
create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
create index if not exists idx_subscriptions_next_run_at on public.subscriptions(next_run_at);
create index if not exists idx_artifacts_user_id on public.artifacts(user_id);
create index if not exists idx_artifacts_subscription_id on public.artifacts(subscription_id);
create index if not exists idx_artifacts_created_at on public.artifacts(created_at desc);
