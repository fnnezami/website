-- Add this to your migration or create a new one (003_private_ip_functions.sql)

-- Function to get analytics excluding private IPs (for public analytics)
create or replace function public.analytics_summary_public_only(p_since interval)
returns table(views bigint, unique_clients bigint)
language sql
stable
as $$
  select
    count(*)::bigint as views,
    count(distinct client_id)::bigint as unique_clients
  from public.analytics_events
  where ts >= now() - p_since
    and (ip_is_private = false or ip_is_private is null)
$$;

-- Function to get geographic distribution (excluding private IPs)
create or replace function public.analytics_geographic(
  p_since interval,
  p_limit int default 20
)
returns table(country text, region text, city text, views bigint)
language sql
stable
as $$
  select
    ip_country as country,
    ip_region as region,
    ip_city as city,
    count(*)::bigint as views
  from public.analytics_events
  where ts >= now() - p_since
    and ip_country is not null
    and (ip_is_private = false or ip_is_private is null)
  group by ip_country, ip_region, ip_city
  order by views desc
  limit p_limit
$$;

-- Function to get company/organization analytics
create or replace function public.analytics_organizations(
  p_since interval,
  p_limit int default 20
)
returns table(organization text, views bigint, unique_clients bigint)
language sql
stable
as $$
  select
    coalesce(ip_company, ip_org, 'Unknown') as organization,
    count(*)::bigint as views,
    count(distinct client_id)::bigint as unique_clients
  from public.analytics_events
  where ts >= now() - p_since
    and (ip_is_private = false or ip_is_private is null)
    and (ip_company is not null or ip_org is not null)
  group by coalesce(ip_company, ip_org, 'Unknown')
  order by views desc
  limit p_limit
$$;