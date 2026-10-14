-- Brain Stash shared AI content library
-- Run once in your Supabase project's SQL Editor.
-- The browser never uses the service-role key. All reads/writes go through Vercel API routes.

create table if not exists public.brain_stash_items (
  id text primary key,
  discipline_id text not null,
  title text not null,
  normalized_title text not null,
  content jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'ai' check (source in ('ai', 'admin')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (discipline_id, normalized_title)
);

create index if not exists brain_stash_items_public_feed_idx
  on public.brain_stash_items (status, discipline_id, created_at desc);

create table if not exists public.brain_stash_generation_usage (
  usage_day date not null default current_date,
  actor_key text not null,
  used integer not null default 0 check (used >= 0),
  primary key (usage_day, actor_key)
);

alter table public.brain_stash_items enable row level security;
alter table public.brain_stash_generation_usage enable row level security;

-- Atomic per-actor and global daily quota. If the global budget is exhausted,
-- the actor increment is rolled back inside this function.
create or replace function public.consume_brain_stash_quota(
  p_actor_hash text,
  p_actor_limit integer,
  p_global_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_day date := (now() at time zone 'utc')::date;
  v_actor_used integer;
  v_global_used integer;
begin
  if p_actor_hash is null or length(p_actor_hash) < 5
     or p_actor_limit < 1 or p_global_limit < 1 then
    return false;
  end if;

  insert into public.brain_stash_generation_usage (usage_day, actor_key, used)
  values (v_usage_day, p_actor_hash, 1)
  on conflict (usage_day, actor_key) do update
    set used = public.brain_stash_generation_usage.used + 1
    where public.brain_stash_generation_usage.used < p_actor_limit
  returning used into v_actor_used;

  if v_actor_used is null then
    return false;
  end if;

  insert into public.brain_stash_generation_usage (usage_day, actor_key, used)
  values (v_usage_day, '__global__', 1)
  on conflict (usage_day, actor_key) do update
    set used = public.brain_stash_generation_usage.used + 1
    where public.brain_stash_generation_usage.used < p_global_limit
  returning used into v_global_used;

  if v_global_used is null then
    update public.brain_stash_generation_usage
      set used = greatest(0, used - 1)
      where usage_day = v_usage_day and actor_key = p_actor_hash;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.consume_brain_stash_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_brain_stash_quota(text, integer, integer) to service_role;

-- Shared Q&A cache. Identical normalized questions about the same topic reuse one answer.
create table if not exists public.brain_stash_qa_cache (
  id text primary key,
  discipline_id text not null,
  topic_id text not null,
  topic_title text not null,
  normalized_question text not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (discipline_id, topic_id, normalized_question)
);

create index if not exists brain_stash_qa_cache_topic_idx
  on public.brain_stash_qa_cache (discipline_id, topic_id, created_at desc);

create table if not exists public.brain_stash_question_usage (
  usage_day date not null default current_date,
  actor_topic_key text not null,
  used integer not null default 0 check (used >= 0),
  primary key (usage_day, actor_topic_key)
);

alter table public.brain_stash_qa_cache enable row level security;
alter table public.brain_stash_question_usage enable row level security;

-- Atomic per-IP/topic and global daily question budget. Actor identifiers are salted hashes.
create or replace function public.consume_brain_stash_question_quota(
  p_actor_topic_key text,
  p_actor_limit integer,
  p_global_limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usage_day date := (now() at time zone 'utc')::date;
  v_actor_used integer;
  v_global_used integer;
begin
  if p_actor_topic_key is null or length(p_actor_topic_key) < 5
     or p_actor_limit < 1 or p_global_limit < 1 then
    return false;
  end if;

  insert into public.brain_stash_question_usage (usage_day, actor_topic_key, used)
  values (v_usage_day, p_actor_topic_key, 1)
  on conflict (usage_day, actor_topic_key) do update
    set used = public.brain_stash_question_usage.used + 1
    where public.brain_stash_question_usage.used < p_actor_limit
  returning used into v_actor_used;

  if v_actor_used is null then
    return false;
  end if;

  insert into public.brain_stash_question_usage (usage_day, actor_topic_key, used)
  values (v_usage_day, '__global__', 1)
  on conflict (usage_day, actor_topic_key) do update
    set used = public.brain_stash_question_usage.used + 1
    where public.brain_stash_question_usage.used < p_global_limit
  returning used into v_global_used;

  if v_global_used is null then
    update public.brain_stash_question_usage
      set used = greatest(0, used - 1)
      where usage_day = v_usage_day and actor_topic_key = p_actor_topic_key;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.consume_brain_stash_question_quota(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_brain_stash_question_quota(text, integer, integer) to service_role;
