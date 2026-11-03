-- =============================================================================
-- 하루정리 (Haru Board) — 원자적 처리 함수 (PRD v1.3 7.3)
-- 상태: ★ 검토용 초안 ★ 권한 상승 방식은 사용자 검토 후 적용한다.
--
-- [제안 방식] 비공개 스키마 SECURITY DEFINER + 공개 SECURITY INVOKER 래퍼
--   1) 실제 로직은 app_private 스키마의 SECURITY DEFINER 함수에 둔다.
--      - app_private는 Supabase Data API(노출 스키마: public)에 포함되지 않아
--        브라우저가 직접 호출할 수 없다.
--      - SET search_path = '' + 모든 객체 스키마 명시.
--      - 함수 안에서 auth.uid()로 사용자 확인, 입력 행의 소유권 직접 검증.
--      - 클라이언트가 보낸 user_id / is_correct / attempted_at은 받지 않는다.
--   2) public 스키마에는 같은 이름의 SECURITY INVOKER 래퍼만 둔다.
--      - Route Handler가 로그인 사용자 세션으로 supabase.rpc('...')를 호출하는 유일한 경로.
--      - EXECUTE는 PUBLIC/anon에서 회수하고 authenticated에만 부여.
--   3) 서비스 역할 키는 이 경로에 사용하지 않는다 (사용자 세션 + auth.uid() 검증).
--
-- [SECURITY DEFINER가 필요한 이유]
--   - assign_today_hanja: hanja_learning INSERT 권한을 사용자에게 주면 임의 한자/날짜 배정 가능
--   - submit_daily_quiz / submit_review_answer: 정답 컬럼은 사용자에게 GRANT되지 않음 +
--     quiz_attempts·weekly_review_items 쓰기 권한 없음
--   - prepare_weekly_reviews: weekly_reviews/items 쓰기 권한 없음
--   - get_my_attempt_answers: 이미 푼 문제의 정답·해설만 본인에게 반환
--
-- [DEFINER 없이 처리하는 것]
--   - 학습 상태 PATCH: RLS UPDATE + status 컬럼 GRANT + 전환 가드 트리거 (초기 스키마 파일)
--   - 일반 CRUD, 오늘의 퀴즈 문제 조회(정답 제외 컬럼 GRANT)
--
-- 확정 규칙 반영 (2026-11-03 사용자 확정):
--   - 오늘의 퀴즈는 오늘 배정된 한자만 대상
--   - 복습: 첫 제출 후 미완료가 남으면 in_progress, 마지막 제출 시 바로 completed
-- =============================================================================

grant usage on schema app_private to authenticated;

-- 서울 기준 오늘 날짜
create or replace function app_private.today_kst()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Seoul')::date;
$$;
revoke all on function app_private.today_kst() from public, anon, authenticated;

-- =============================================================================
-- 1. 오늘의 한자 배정 (POST /api/hanja/today/assign)
--    재요청 시 기존 결과, 사용자별 advisory lock으로 동시 요청 직렬화.
-- =============================================================================
create or replace function app_private.assign_today_hanja()
returns table (
  learning_id       uuid,
  learning_date     date,
  status            text,
  character_id      uuid,
  is_new_assignment boolean,
  exhausted         boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_today date := app_private.today_kst();
  v_row   public.hanja_learning%rowtype;
  v_char  uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'HB401';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('assign_hanja:' || v_uid::text, 0));

  select hl.* into v_row
    from public.hanja_learning hl
   where hl.user_id = v_uid and hl.learning_date = v_today;

  if found then
    return query select v_row.id, v_row.learning_date, v_row.status, v_row.character_id, false, false;
    return;
  end if;

  select c.id into v_char
    from public.hanja_characters c
   where not exists (
     select 1 from public.hanja_learning hl
      where hl.user_id = v_uid and hl.character_id = c.id
   )
   order by c.sort_order, c.id
   limit 1;

  if v_char is null then
    -- 10자 소진: 신규 배정 없음
    return query select null::uuid, v_today, null::text, null::uuid, false, true;
    return;
  end if;

  insert into public.hanja_learning (user_id, character_id, learning_date, status)
  values (v_uid, v_char, v_today, 'assigned')
  returning * into v_row;

  return query select v_row.id, v_row.learning_date, v_row.status, v_row.character_id, true, false;
end;
$$;

-- =============================================================================
-- 2. 일일 퀴즈 제출·서버 채점 (POST /api/hanja/quizzes/attempts)
--    - request_id 필수. 같은 request_id 재시도 → 기존 결과 (다른 문제/보기면 409)
--    - 새 request_id → 같은 문제 재응시 허용 (별도 시도 기록)
--    - 오늘 배정된 한자의 문제만 허용
-- =============================================================================
create or replace function app_private.submit_daily_quiz(
  p_question_id        uuid,
  p_selected_option_id text,
  p_request_id         uuid
)
returns table (
  attempt_id         uuid,
  question_id        uuid,
  is_correct         boolean,
  selected_option_id text,
  correct_option_id  text,
  correct_answer     text,
  explanation        text,
  attempted_at       timestamptz,
  is_duplicate       boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_q   public.quiz_questions%rowtype;
  v_a   public.quiz_attempts%rowtype;
  v_dup boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'HB401';
  end if;
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = 'HB400';
  end if;
  if p_question_id is null or p_selected_option_id is null
     or p_selected_option_id not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid_answer' using errcode = 'HB400';
  end if;

  select a.* into v_a
    from public.quiz_attempts a
   where a.user_id = v_uid and a.request_id = p_request_id;

  if found then
    if v_a.question_id <> p_question_id or v_a.selected_option_id <> p_selected_option_id then
      raise exception 'request_id_conflict' using errcode = 'HB409';
    end if;
    v_dup := true;
  else
    select q.* into v_q
      from public.quiz_questions q
     where q.id = p_question_id
       and exists (
         select 1 from public.hanja_learning hl
          where hl.user_id = v_uid
            and hl.learning_date = app_private.today_kst()
            and hl.character_id = q.character_id
       );
    if not found then
      raise exception 'question_not_available_today' using errcode = 'HB404';
    end if;

    insert into public.quiz_attempts
      (user_id, question_id, selected_option_id, is_correct, attempt_type, request_id, attempted_at)
    values
      (v_uid, v_q.id, p_selected_option_id, p_selected_option_id = v_q.correct_option_id,
       'daily', p_request_id, now())
    on conflict on constraint quiz_attempts_user_request_key do nothing
    returning * into v_a;

    if not found then
      -- 같은 request_id가 동시에 들어온 경우: 먼저 저장된 결과 사용
      select a.* into v_a
        from public.quiz_attempts a
       where a.user_id = v_uid and a.request_id = p_request_id;
      if v_a.question_id <> p_question_id or v_a.selected_option_id <> p_selected_option_id then
        raise exception 'request_id_conflict' using errcode = 'HB409';
      end if;
      v_dup := true;
    end if;
  end if;

  select q.* into v_q from public.quiz_questions q where q.id = v_a.question_id;

  return query
    select v_a.id, v_a.question_id, v_a.is_correct, v_a.selected_option_id,
           v_q.correct_option_id,
           (select o ->> 'text' from jsonb_array_elements(v_q.options) o
             where o ->> 'id' = v_q.correct_option_id),
           v_q.explanation, v_a.attempted_at, v_dup;
end;
$$;

-- =============================================================================
-- 3. 주간 복습 회차 준비 (POST /api/hanja/reviews/prepare)
--    - 첫 학습일(MIN(hanja_learning.learning_date))이 속한 주부터, 이미 끝난 주만
--    - 회차 review_week = 원본 주의 다음 월요일
--    - 원본: 서울 기준 [월 00:00, 다음 월 00:00)의 daily 오답, 문제 ID 중복 제거
--    - 이미 있는 회차는 변경하지 않음. 문제 0개 회차는 바로 completed
-- =============================================================================
create or replace function app_private.prepare_weekly_reviews()
returns table (
  review_id           uuid,
  review_week         date,
  source_start_date   date,
  source_end_date     date,
  total_questions     integer,
  completed_questions integer,
  status              text,
  is_new              boolean
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid            uuid := auth.uid();
  v_today          date := app_private.today_kst();
  v_first          date;
  v_week           date;  -- 원본 주의 월요일
  v_current_monday date;
  v_review_id      uuid;
  v_new_ids        uuid[] := '{}';
  v_count          integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'HB401';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('prepare_reviews:' || v_uid::text, 0));

  select min(hl.learning_date) into v_first
    from public.hanja_learning hl
   where hl.user_id = v_uid;

  if v_first is null then
    return;
  end if;

  v_week           := v_first - (extract(isodow from v_first)::int - 1);
  v_current_monday := v_today - (extract(isodow from v_today)::int - 1);

  while v_week < v_current_monday loop
    if not exists (
      select 1 from public.weekly_reviews r
       where r.user_id = v_uid and r.review_week = v_week + 7
    ) then
      insert into public.weekly_reviews (user_id, review_week, status)
      values (v_uid, v_week + 7, 'pending')
      returning id into v_review_id;

      insert into public.weekly_review_items (weekly_review_id, question_id, status)
      select distinct v_review_id, a.question_id, 'pending'
        from public.quiz_attempts a
       where a.user_id = v_uid
         and a.attempt_type = 'daily'
         and a.is_correct = false
         and a.attempted_at >= (v_week::timestamp at time zone 'Asia/Seoul')
         and a.attempted_at <  ((v_week + 7)::timestamp at time zone 'Asia/Seoul');

      get diagnostics v_count = row_count;

      if v_count = 0 then
        update public.weekly_reviews r
           set status = 'completed', completed_at = now()
         where r.id = v_review_id;
      end if;

      v_new_ids := v_new_ids || v_review_id;
    end if;
    v_week := v_week + 7;
  end loop;

  return query
    select r.id, r.review_week, r.review_week - 7, r.review_week - 1,
           (select count(*)::int from public.weekly_review_items i where i.weekly_review_id = r.id),
           (select count(*)::int from public.weekly_review_items i
             where i.weekly_review_id = r.id and i.status = 'completed'),
           r.status,
           r.id = any (v_new_ids)
      from public.weekly_reviews r
     where r.user_id = v_uid
     order by r.review_week desc;
end;
$$;

-- =============================================================================
-- 4. 복습 항목 제출 (POST /api/hanja/reviews/{id}/items/{item_id}/answer)
--    한 트랜잭션: 시도 저장 + 항목 completed + 회차 상태 전환
--    - 회차 행 → 항목 행 순서로 FOR UPDATE 잠금 (동시 제출 직렬화)
--    - 완료 항목에 같은 보기 재전송 → 기존 결과, 다른 보기 → 409
--    - 미완료가 남으면 in_progress, 마지막 항목이면 completed
-- =============================================================================
create or replace function app_private.submit_review_answer(
  p_review_id          uuid,
  p_item_id            uuid,
  p_selected_option_id text
)
returns table (
  attempt_id          uuid,
  item_id             uuid,
  question_id         uuid,
  is_correct          boolean,
  selected_option_id  text,
  correct_option_id   text,
  correct_answer      text,
  explanation         text,
  is_duplicate        boolean,
  review_status       text,
  completed_questions integer,
  total_questions     integer
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_review public.weekly_reviews%rowtype;
  v_item   public.weekly_review_items%rowtype;
  v_q      public.quiz_questions%rowtype;
  v_a      public.quiz_attempts%rowtype;
  v_dup    boolean := false;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'HB401';
  end if;
  if p_selected_option_id is null or p_selected_option_id not in ('A', 'B', 'C', 'D') then
    raise exception 'invalid_answer' using errcode = 'HB400';
  end if;

  select r.* into v_review
    from public.weekly_reviews r
   where r.id = p_review_id and r.user_id = v_uid
   for update;
  if not found then
    raise exception 'review_not_found' using errcode = 'HB404';
  end if;

  select i.* into v_item
    from public.weekly_review_items i
   where i.id = p_item_id and i.weekly_review_id = p_review_id
   for update;
  if not found then
    raise exception 'review_item_not_found' using errcode = 'HB404';
  end if;

  if v_item.status = 'completed' then
    select a.* into v_a from public.quiz_attempts a where a.id = v_item.quiz_attempt_id;
    if v_a.selected_option_id <> p_selected_option_id then
      raise exception 'review_item_already_answered' using errcode = 'HB409';
    end if;
    v_dup := true;
  else
    select q.* into v_q from public.quiz_questions q where q.id = v_item.question_id;

    insert into public.quiz_attempts
      (user_id, question_id, selected_option_id, is_correct, attempt_type, request_id, attempted_at)
    values
      (v_uid, v_q.id, p_selected_option_id, p_selected_option_id = v_q.correct_option_id,
       'review', null, now())
    returning * into v_a;

    update public.weekly_review_items i
       set status = 'completed', quiz_attempt_id = v_a.id, completed_at = now()
     where i.id = v_item.id;

    if exists (
      select 1 from public.weekly_review_items i
       where i.weekly_review_id = p_review_id and i.status = 'pending'
    ) then
      update public.weekly_reviews r
         set status = 'in_progress', completed_at = null
       where r.id = p_review_id;
    else
      update public.weekly_reviews r
         set status = 'completed', completed_at = now()
       where r.id = p_review_id;
    end if;
  end if;

  select q.* into v_q from public.quiz_questions q where q.id = v_a.question_id;
  select r.* into v_review from public.weekly_reviews r where r.id = p_review_id;

  return query
    select v_a.id, v_item.id, v_a.question_id, v_a.is_correct, v_a.selected_option_id,
           v_q.correct_option_id,
           (select o ->> 'text' from jsonb_array_elements(v_q.options) o
             where o ->> 'id' = v_q.correct_option_id),
           v_q.explanation, v_dup, v_review.status,
           (select count(*)::int from public.weekly_review_items i
             where i.weekly_review_id = p_review_id and i.status = 'completed'),
           (select count(*)::int from public.weekly_review_items i
             where i.weekly_review_id = p_review_id);
end;
$$;

-- =============================================================================
-- 5. 이미 푼 시도의 정답·해설 조회 (풀이 기록 / 복습 결과 화면)
--    본인 시도에 한해서만 반환. 풀지 않은 문제의 정답은 노출되지 않는다.
-- =============================================================================
create or replace function app_private.get_my_attempt_answers(p_attempt_ids uuid[])
returns table (
  attempt_id        uuid,
  correct_option_id text,
  correct_answer    text,
  explanation       text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, q.correct_option_id,
         (select o ->> 'text' from jsonb_array_elements(q.options) o
           where o ->> 'id' = q.correct_option_id),
         q.explanation
    from public.quiz_attempts a
    join public.quiz_questions q on q.id = a.question_id
   where a.user_id = auth.uid()
     and a.id = any (p_attempt_ids);
$$;

-- =============================================================================
-- 비공개 함수 권한: PUBLIC/anon 회수, authenticated만 (래퍼 경유 호출용)
-- =============================================================================
revoke all on function app_private.assign_today_hanja()                    from public, anon;
revoke all on function app_private.submit_daily_quiz(uuid, text, uuid)     from public, anon;
revoke all on function app_private.prepare_weekly_reviews()                from public, anon;
revoke all on function app_private.submit_review_answer(uuid, uuid, text)  from public, anon;
revoke all on function app_private.get_my_attempt_answers(uuid[])          from public, anon;

grant execute on function app_private.assign_today_hanja()                   to authenticated;
grant execute on function app_private.submit_daily_quiz(uuid, text, uuid)    to authenticated;
grant execute on function app_private.prepare_weekly_reviews()               to authenticated;
grant execute on function app_private.submit_review_answer(uuid, uuid, text) to authenticated;
grant execute on function app_private.get_my_attempt_answers(uuid[])         to authenticated;

-- =============================================================================
-- 공개 래퍼 (SECURITY INVOKER) — supabase.rpc() 호출 대상
-- =============================================================================
create or replace function public.assign_today_hanja()
returns table (learning_id uuid, learning_date date, status text, character_id uuid,
               is_new_assignment boolean, exhausted boolean)
language sql security invoker set search_path = ''
as $$ select * from app_private.assign_today_hanja(); $$;

create or replace function public.submit_daily_quiz(
  p_question_id uuid, p_selected_option_id text, p_request_id uuid)
returns table (attempt_id uuid, question_id uuid, is_correct boolean, selected_option_id text,
               correct_option_id text, correct_answer text, explanation text,
               attempted_at timestamptz, is_duplicate boolean)
language sql security invoker set search_path = ''
as $$ select * from app_private.submit_daily_quiz(p_question_id, p_selected_option_id, p_request_id); $$;

create or replace function public.prepare_weekly_reviews()
returns table (review_id uuid, review_week date, source_start_date date, source_end_date date,
               total_questions integer, completed_questions integer, status text, is_new boolean)
language sql security invoker set search_path = ''
as $$ select * from app_private.prepare_weekly_reviews(); $$;

create or replace function public.submit_review_answer(
  p_review_id uuid, p_item_id uuid, p_selected_option_id text)
returns table (attempt_id uuid, item_id uuid, question_id uuid, is_correct boolean,
               selected_option_id text, correct_option_id text, correct_answer text,
               explanation text, is_duplicate boolean, review_status text,
               completed_questions integer, total_questions integer)
language sql security invoker set search_path = ''
as $$ select * from app_private.submit_review_answer(p_review_id, p_item_id, p_selected_option_id); $$;

create or replace function public.get_my_attempt_answers(p_attempt_ids uuid[])
returns table (attempt_id uuid, correct_option_id text, correct_answer text, explanation text)
language sql stable security invoker set search_path = ''
as $$ select * from app_private.get_my_attempt_answers(p_attempt_ids); $$;

revoke all on function public.assign_today_hanja()                    from public, anon;
revoke all on function public.submit_daily_quiz(uuid, text, uuid)     from public, anon;
revoke all on function public.prepare_weekly_reviews()                from public, anon;
revoke all on function public.submit_review_answer(uuid, uuid, text)  from public, anon;
revoke all on function public.get_my_attempt_answers(uuid[])          from public, anon;

grant execute on function public.assign_today_hanja()                   to authenticated;
grant execute on function public.submit_daily_quiz(uuid, text, uuid)    to authenticated;
grant execute on function public.prepare_weekly_reviews()               to authenticated;
grant execute on function public.submit_review_answer(uuid, uuid, text) to authenticated;
grant execute on function public.get_my_attempt_answers(uuid[])         to authenticated;
