-- 경주 여행 페이지 · 의견 보드용 테이블
-- Supabase 대시보드 → SQL Editor에 통째로 붙여 넣고 Run.
-- 로그인 없이(anon 키) 읽기·쓰기만 되고, 글 삭제는 쓴 사람 브라우저에 있는 토큰으로만 됩니다.

create table if not exists public.trip_posts (
  id          bigint generated always as identity primary key,
  trip        text not null check (char_length(trip) between 1 and 40),
  created_at  timestamptz not null default now(),
  author      text not null check (char_length(author) between 1 and 20),
  kind        text not null check (kind in ('food', 'place', 'plan', 'etc')),
  title       text not null check (char_length(title) between 1 and 60),
  body        text check (body is null or char_length(body) <= 300),
  url         text check (url is null or (url ~ '^https?://' and char_length(url) <= 500)),
  token_hash  text check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$')
);
create index if not exists trip_posts_trip_created on public.trip_posts (trip, created_at desc);

create table if not exists public.trip_likes (
  post_id     bigint not null references public.trip_posts (id) on delete cascade,
  voter       text not null check (char_length(voter) between 1 and 20),
  created_at  timestamptz not null default now(),
  primary key (post_id, voter)
);

alter table public.trip_posts enable row level security;
alter table public.trip_likes enable row level security;

drop policy if exists "anyone reads posts" on public.trip_posts;
drop policy if exists "anyone adds posts"  on public.trip_posts;
create policy "anyone reads posts" on public.trip_posts for select to anon, authenticated using (true);
create policy "anyone adds posts"  on public.trip_posts for insert to anon, authenticated with check (true);
-- 수정·삭제 정책은 일부러 없음. 삭제는 아래 함수로만.

drop policy if exists "anyone reads likes"   on public.trip_likes;
drop policy if exists "anyone adds likes"    on public.trip_likes;
drop policy if exists "anyone removes likes" on public.trip_likes;
create policy "anyone reads likes"   on public.trip_likes for select to anon, authenticated using (true);
create policy "anyone adds likes"    on public.trip_likes for insert to anon, authenticated with check (true);
create policy "anyone removes likes" on public.trip_likes for delete to anon, authenticated using (true);

grant select, insert on public.trip_posts to anon, authenticated;
grant select, insert, delete on public.trip_likes to anon, authenticated;

-- 글 삭제: 글을 쓸 때 브라우저가 만든 토큰을 맞혀야만 지워짐 (DB에는 토큰의 해시만 저장)
create or replace function public.delete_trip_post(p_id bigint, p_token text)
returns boolean
language sql
security definer
set search_path = public
as $$
  with d as (
    delete from public.trip_posts
    where id = p_id
      and token_hash is not null
      and token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    returning 1
  )
  select exists (select 1 from d);
$$;
revoke all on function public.delete_trip_post(bigint, text) from public;
grant execute on function public.delete_trip_post(bigint, text) to anon, authenticated;
