-- =============================================================================
-- 주간 복습 검증용 테스트 시드 (PRD v1.3 4.7, 8.11)
-- - Supabase 대시보드 SQL Editor(관리자 권한)에서만 실행. 일반 API로는 과거 날짜 입력 불가.
-- - 대상: 이메일이 haru.test.a.%@example.com 인 테스트 계정 1개만. 실제 사용자에는 영향 없음.
-- - 실행 후 앱(또는 RPC)에서 prepare_weekly_reviews → submit_review_answer 순으로 확인.
-- - 검증이 끝나면 아래 [정리] 블록을 실행.
-- =============================================================================

-- [시드] 첫 학습일을 3주 전으로 옮기고, 지난주 오답 기록을 만든다.
--   지난주: 문제 X 오답 2회(중복 제거 대상), 문제 Y 오답 1회 + 정답 1회 → 복습 2문제
--   2주 전·3주 전: 오답 없음 → 문제 0개 회차(바로 completed)
do $$
declare
  v_uid uuid;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_monday date := v_today - (extract(isodow from v_today)::int - 1);  -- 이번 주 월요일
  v_qx uuid;
  v_qy uuid;
begin
  select id into v_uid from auth.users where email like 'haru.test.a.%@example.com' limit 1;
  if v_uid is null then
    raise exception '테스트 계정(haru.test.a.*@example.com)을 찾을 수 없습니다';
  end if;

  -- 학습 기록이 없으면 지난 3주 전 수요일 날짜로 첫 학습 생성, 있으면 가장 이른 기록을 그 날짜로 이동
  if exists (select 1 from public.hanja_learning where user_id = v_uid) then
    update public.hanja_learning
       set learning_date = v_monday - 19
     where id = (select id from public.hanja_learning where user_id = v_uid order by learning_date limit 1)
       and not exists (select 1 from public.hanja_learning where user_id = v_uid and learning_date = v_monday - 19);
  else
    insert into public.hanja_learning (user_id, character_id, learning_date, status)
    select v_uid, id, v_monday - 19, 'assigned' from public.hanja_characters order by sort_order limit 1;
  end if;

  select id into v_qx from public.quiz_questions order by id limit 1;
  select id into v_qy from public.quiz_questions order by id offset 1 limit 1;

  insert into public.quiz_attempts (user_id, question_id, selected_option_id, is_correct, attempt_type, request_id, attempted_at)
  values
    (v_uid, v_qx, case when (select correct_option_id from public.quiz_questions where id = v_qx) = 'A' then 'B' else 'A' end,
       false, 'daily', gen_random_uuid(), ((v_monday - 7)::timestamp at time zone 'Asia/Seoul') + interval '9 hours'),
    (v_uid, v_qx, case when (select correct_option_id from public.quiz_questions where id = v_qx) = 'A' then 'B' else 'A' end,
       false, 'daily', gen_random_uuid(), ((v_monday - 1)::timestamp at time zone 'Asia/Seoul') + interval '23 hours 59 minutes'),
    (v_uid, v_qy, case when (select correct_option_id from public.quiz_questions where id = v_qy) = 'A' then 'B' else 'A' end,
       false, 'daily', gen_random_uuid(), ((v_monday - 4)::timestamp at time zone 'Asia/Seoul') + interval '20 hours'),
    (v_uid, v_qy, (select correct_option_id from public.quiz_questions where id = v_qy),
       true,  'daily', gen_random_uuid(), ((v_monday - 3)::timestamp at time zone 'Asia/Seoul') + interval '20 hours');

  raise notice '테스트 시드 완료: user %, 첫 학습일 %, 지난주 %~%', v_uid, v_monday - 19, v_monday - 7, v_monday - 1;
end $$;

-- [확인] 회차 생성 후 상태 보기 (앱에서 prepare 실행 뒤)
-- select r.review_week, r.status, count(i.*) as items,
--        count(i.*) filter (where i.status = 'completed') as done
--   from public.weekly_reviews r
--   left join public.weekly_review_items i on i.weekly_review_id = r.id
--  where r.user_id = (select id from auth.users where email like 'haru.test.a.%@example.com' limit 1)
--  group by r.id order by r.review_week desc;

-- [정리] 테스트 계정 2개와 그 데이터 전부 삭제 (auth.users 삭제 시 개인 데이터 연쇄 삭제)
-- delete from auth.users where email like 'haru.test.%@example.com';
