-- Singleton table storing the OAuth connection to the business's Google
-- Business Profile account. Contains secrets (access/refresh tokens), so
-- unlike site_settings this must NEVER be readable by anon/authenticated —
-- only the service role (used exclusively by server functions) may touch it.
create table if not exists public.google_business_connection (
  id smallint primary key default 1 check (id = 1),
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  scope text,
  account_name text,
  location_name text,
  location_title text,
  pending_state text,
  pending_state_created_at timestamptz,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.google_business_connection (id) values (1)
on conflict (id) do nothing;

alter table public.google_business_connection enable row level security;
-- No policies are created: RLS with zero policies denies all access to
-- anon/authenticated. Only the service-role key (supabaseAdmin) can read or
-- write this table, which is what every server function in
-- src/lib/admin/google-business.functions.ts uses.
revoke all on public.google_business_connection from anon, authenticated;
