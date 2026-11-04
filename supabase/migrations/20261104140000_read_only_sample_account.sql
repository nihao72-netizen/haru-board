-- =============================================================================
-- 하루정리 — 보기 전용 샘플 계정 (2026-11-04 사용자 요청: "샘플 확인")
--   공개된 샘플 계정(aaa@aaa.com)으로 누구나 로그인해 내용을 볼 수 있게 하되,
--   DB가 쓰기를 막아 데이터·비밀번호·이메일을 바꿀 수 없게 한다.
--
--   1) app_private.read_only_users: 보기 전용 계정 목록 (Data API에 노출되지 않는 스키마)
--   2) 사용자 데이터 테이블 12개에 BEFORE INSERT/UPDATE/DELETE 행 트리거
--      - 요청한 사용자(auth.uid())가 보기 전용이면 거부 (HB403)
--      - 직접 쓰기뿐 아니라 SECURITY DEFINER 함수(한자 배정·퀴즈·복습 제출) 안의 쓰기도 막힘
--      - 가입 초기화·관리자 작업(auth.uid() 없음)과 다른 사용자에게는 영향 없음
--   3) auth.users BEFORE UPDATE 트리거: 보기 전용 계정의 비밀번호·이메일 변경 거부
--      (로그인 시각 갱신 등 다른 변경은 허용)
--
-- 보기 전용 해제(관리자, SQL Editor): delete from app_private.read_only_users where user_id = '<id>';
-- 기존 데이터는 바꾸지 않는다.
-- =============================================================================

-- 1) 보기 전용 계정 목록
create table app_private.read_only_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);
revoke all on app_private.read_only_users from public, anon, authenticated;

insert into app_private.read_only_users (user_id, note)
select u.id, '공개 샘플 계정'
  from auth.users u
 where lower(u.email) = 'aaa@aaa.com'
on conflict (user_id) do nothing;

-- 지금 요청한 사용자가 보기 전용인지 (로그인하지 않았거나 관리자 작업이면 false)
create or replace function app_private.is_read_only()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app_private.read_only_users r where r.user_id = auth.uid()
  );
$$;
revoke all on function app_private.is_read_only() from public, anon;
grant execute on function app_private.is_read_only() to authenticated;

-- 공개 래퍼: 화면에서 '샘플 보기 중' 안내를 보일지 판단 (본인 여부만 알려 줌)
create or replace function public.is_read_only()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select app_private.is_read_only(); $$;
revoke all on function public.is_read_only() from public, anon;
grant execute on function public.is_read_only() to authenticated;

-- 2) 데이터 쓰기 차단 트리거
create or replace function app_private.block_read_only_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app_private.is_read_only() then
    raise exception '샘플 계정은 보기만 할 수 있어요. 직접 써 보려면 계정을 만들어 주세요.' using errcode = 'HB403';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function app_private.block_read_only_write() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'entry_categories', 'entries', 'transaction_categories', 'transactions',
    'monthly_budgets', 'category_budgets', 'hanja_learning', 'quiz_attempts',
    'weekly_reviews', 'weekly_review_items', 'daily_reviews'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function app_private.block_read_only_write()',
      t || '_read_only_guard', t
    );
  end loop;
end;
$$;

-- 3) 샘플 계정의 비밀번호·이메일 변경 차단
create or replace function app_private.guard_read_only_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from app_private.read_only_users r where r.user_id = old.id)
     and (new.encrypted_password is distinct from old.encrypted_password
          or new.email is distinct from old.email) then
    raise exception '샘플 계정의 비밀번호와 이메일은 바꿀 수 없어요.' using errcode = 'HB403';
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_read_only_auth_user() from public, anon, authenticated;

create trigger on_auth_user_read_only_guard
  before update on auth.users
  for each row execute function app_private.guard_read_only_auth_user();
