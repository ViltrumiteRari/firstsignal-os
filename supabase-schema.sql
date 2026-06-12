-- FirstSignal OS Database Schema

-- Trade log
create table if not exists trades (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  session_date date default current_date,
  ticker text not null,
  strike text,
  expiry text,
  entry_price numeric,
  exit_price numeric,
  result_pct numeric,
  status text check (status in ('open', 'win', 'loss')),
  thesis text,
  notes text,
  phase text check (phase in ('premarket', 'market', 'postmarket'))
);

-- Session log
create table if not exists sessions (
  id uuid default gen_random_uuid() primary key,
  session_date date default current_date unique,
  premarket_started_at timestamptz,
  market_started_at timestamptz,
  postmarket_started_at timestamptz,
  completed boolean default false,
  notes text,
  tickers_scanned text[],
  top_picks text[]
);

-- Denylist
create table if not exists denylist (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  ticker text unique not null,
  reason text
);

-- Insert default denylist
insert into denylist (ticker, reason) values
  ('TMHC', 'Signal corruption confirmed'),
  ('RAMP', 'Signal corruption confirmed'),
  ('GRRR', 'Signal corruption confirmed')
on conflict (ticker) do nothing;

-- Scan history
create table if not exists scans (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  session_date date default current_date,
  ticker text not null,
  verdict text check (verdict in ('GO', 'NO-GO', 'WATCHLIST')),
  raw_output text,
  phase text
);
