-- =============================================================================
-- 하루정리 — 자유 일기 제목 + 본문 잠금 (2026-11-04 사용자 요청)
--   1) daily_reviews.title 추가 (선택, 1~100자). 기존 일기는 제목 없음(NULL)
--   2) 본문(content)은 직접 SELECT 불가: 컬럼 단위 SELECT 권한에서 content 제외
--   3) 본문은 public.read_diary(date)로만 읽는다.
--      최근 10분 안에 비밀번호로 다시 로그인한 세션(JWT amr의 password 시각)일 때만 반환
--      → 화면이 아니라 DB가 '비밀번호 재확인'을 강제한다.
-- 기존 행·권한 외 데이터는 바꾸지 않는다.
-- =============================================================================

-- 1) 제목
alter table public.daily_reviews add column title text;
alter table public.daily_reviews
  add constraint daily_reviews_title_check
  check (title is null or (length(btrim(title)) > 0 and char_length(title) <= 100));

grant insert (title) on public.daily_reviews to authenticated;
grant update (title) on public.daily_reviews to authenticated;

-- 2) 본문 직접 조회 차단: 표 단위 SELECT를 회수하고 content를 뺀 컬럼만 허용
revoke select on public.daily_reviews from authenticated;
grant select (id, user_id, review_date, title, created_at, updated_at) on public.daily_reviews to authenticated;

-- 3) 최근 비밀번호 확인 여부 (JWT amr 중 method=password 의 가장 최근 시각이 10분 이내)
create or replace function app_private.diary_reauth_ok()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select max((e ->> 'timestamp')::bigint)
      from jsonb_array_elements(
             case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
           ) e
     where e ->> 'method' = 'password'
  ), 0) >= extract(epoch from now())::bigint - 600;
$$;

-- 본문 읽기: 본인 일기 + 최근 비밀번호 확인일 때만
create or replace function app_private.read_diary(p_date date)
returns table (id uuid, review_date date, title text, content text, created_at timestamptz, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'HB401';
  end if;
  if not app_private.diary_reauth_ok() then
    raise exception 'reauth_required' using errcode = 'HB428';
  end if;
  return query
    select d.id, d.review_date, d.title, d.content, d.created_at, d.updated_at
      from public.daily_reviews d
     where d.user_id = v_uid and d.review_date = p_date;
end;
$$;

revoke all on function app_private.diary_reauth_ok()    from public, anon;
revoke all on function app_private.read_diary(date)     from public, anon;
grant execute on function app_private.diary_reauth_ok() to authenticated;
grant execute on function app_private.read_diary(date)  to authenticated;

-- 공개 래퍼 (SECURITY INVOKER) — supabase.rpc('read_diary') 호출 대상
create or replace function public.read_diary(p_date date)
returns table (id uuid, review_date date, title text, content text, created_at timestamptz, updated_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from app_private.read_diary(p_date); $$;

revoke all on function public.read_diary(date) from public, anon;
grant execute on function public.read_diary(date) to authenticated;
