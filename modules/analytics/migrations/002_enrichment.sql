alter table public.analytics_events
  add column if not exists ip_hash text,
  add column if not exists ip_country text,
  add column if not exists ip_region text,
  add column if not exists ip_city text,
  add column if not exists ip_lat double precision,
  add column if not exists ip_lon double precision,
  add column if not exists ip_org text,
  add column if not exists ip_asn text,
  add column if not exists ip_company text,
  add column if not exists skipped_admin boolean default false;

create index if not exists analytics_events_ip_hash_idx on public.analytics_events (ip_hash);