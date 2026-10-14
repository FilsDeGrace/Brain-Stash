-- Brain Stash Q&A cache and quota migration.
-- Run this ONCE in the Supabase project connected to Vercel after deploying the Ask feature.
-- Safe to rerun: objects are created/replaced idempotently.

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
  if v_actor_used is null then return false; end if;

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
