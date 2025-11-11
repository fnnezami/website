-- Tables
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  path text not null,
  title text,
  entity_type text,
  entity_id text,
  referrer text,
  referrer_host text,
  user_agent text,
  client_id text
);

create index if not exists analytics_events_ts_idx on public.analytics_events (ts);
create index if not exists analytics_events_path_idx on public.analytics_events (path);
create index if not exists analytics_events_entity_idx on public.analytics_events (entity_type, entity_id);
create index if not exists analytics_events_client_idx on public.analytics_events (client_id);

-- Functions
create or replace function public.analytics_summary(p_since interval)
returns table(views bigint, unique_clients bigint)
language sql
stable
as $$
  select
    count(*)::bigint as views,
    count(distinct client_id)::bigint as unique_clients
  from public.analytics_events
  where ts >= now() - p_since
$$;

create or replace function public.analytics_top_paths(
  p_since interval,
  p_entity_type text default null,
  p_entity_id text default null,
  p_limit int default 20
)
returns table(path text, entity_type text, entity_id text, views bigint)
language sql
stable
as $$
  select
    path,
    entity_type,
    entity_id,
    count(*)::bigint as views
  from public.analytics_events
  where ts >= now() - p_since
    and (p_entity_type is null or entity_type = p_entity_type)
    and (p_entity_id is null or entity_id = p_entity_id)
  group by path, entity_type, entity_id
  order by views desc
  limit p_limit
$$;

create or replace function public.analytics_timeseries(
  p_since interval,
  p_bucket text default 'day',
  p_entity_type text default null,
  p_entity_id text default null
)
returns table(bucket_ts timestamptz, views bigint)
language sql
stable
as $$
  select
    date_trunc(p_bucket, ts) as bucket_ts,
    count(*)::bigint as views
  from public.analytics_events
  where ts >= now() - p_since
    and (p_entity_type is null or entity_type = p_entity_type)
    and (p_entity_id is null or entity_id = p_entity_id)
  group by 1
  order by 1
$$;