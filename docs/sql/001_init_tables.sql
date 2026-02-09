-- Alter Ego: 초기 테이블 생성
-- Supabase SQL Editor에서 실행

-- 1. personas 테이블
create table public.personas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  personality text not null,
  speaking_style text not null,
  background text,
  system_prompt text,
  created_at timestamptz default now()
);

alter table public.personas enable row level security;

create policy "Users manage own personas"
  on public.personas for all
  using ((select auth.uid()) = user_id);

-- 2. chat_threads 테이블
create table public.chat_threads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  persona_id uuid references public.personas(id) on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

alter table public.chat_threads enable row level security;

create policy "Users manage own threads"
  on public.chat_threads for all
  using ((select auth.uid()) = user_id);

-- 3. chat_messages 테이블
create table public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references public.chat_threads(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

create policy "Users manage own messages"
  on public.chat_messages for all
  using (
    thread_id in (
      select id from public.chat_threads
      where user_id = (select auth.uid())
    )
  );

-- 인덱스 (RLS 성능 최적화)
create index idx_personas_user_id on public.personas(user_id);
create index idx_chat_threads_user_id on public.chat_threads(user_id);
create index idx_chat_threads_persona_id on public.chat_threads(persona_id);
create index idx_chat_messages_thread_id on public.chat_messages(thread_id);
