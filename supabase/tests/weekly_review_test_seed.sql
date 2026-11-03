-- =============================================================================
-- 주간 복습 검증용 테스트 시드 (PRD v1.3 4.7, 8.11)
-- - Supabase 대시보드 SQL Editor(관리자 권한)에서만 실행. 일반 API로는 과거 날짜 입력 불가.
-- - 대상: 이메일이 haru.test.a.%@example.com 인 테스트 계정 1개만. 실제 사용자에는 영향 없음.
-- - 한 번만 실행 (이미 시드된 계정이면 오류로 중단, 아무것도 바꾸지 않음).
-- - 실행 후 앱(또는 API)에서 POST /api/hanja/reviews/prepare → 복습 풀이 순으로 확인.
-- - 검증이 끝나면 아래 [정리] 블록을 실행.
--
-- 만들어지는 데이터 (W = 이번 주 월요일, 서울 기준)
--   학습: 가장 이른 기존 학습을 W-19(3주 전 수요일)로 이동(없으면 새로 배정) → 한자 C0
--         다음 한자 2개를 W-7(지난주 월), W-4(지난주 목)에 배정(완료 상태) → 한자 CX, CY
--         ※ 복습 문제는 반드시 사용자에게 배정된 한자의 문제여야 함 (quiz_questions RLS)
--   오답(daily):
--     C0 문제: W-8 23:59:59 오답        → 2주 전 원본 주의 마지막 순간 → W-7 회차 1문제
--     C0 문제: W   00:00:00 오답        → 이번 주 시작 순간 → 지난주 회차에서 제외되어야 함
--     CX 문제: W-7 09:00, W-1 23:59 오답 → 같은 문제 2회 → 중복 제거로 1문제
--     CY 문제: W-4 20:00 오답, 20:05 정답 → 한 번이라도 틀렸으므로 복습 대상
-- 기대 결과 (prepare 후)
--   W-14 회차: 원본 W-21~W-15, 오답 없음 → 0문제, 바로 completed
--   W-7  회차: 원본 W-14~W-8,  C0 1문제, pending
--   W    회차: 원본 W-7~W-1,   CX·CY 2문제, pending
-- =============================================================================

-- [시드]
do $$
declare
  v_uid    uuid;
  v_today  date := (now() at time zone 'Asia/Seoul')::date;
  v_monday date := v_today - (extract(isodow from v_today)::int - 1);  -- 이번 주 월요일 (W)
  v_c0 uuid; v_cx uuid; v_cy uuid;
  v_q0 uuid; v_qx uuid; v_qy uuid;
  v_wrong text;
begin
  select id into v_uid from auth.users where email like 'haru.test.a.%@example.com' limit 1;
  if v_uid is null then
    raise exception '테스트 계정(haru.test.a.*@example.com)을 찾을 수 없습니다';
  end if;
  if exists (select 1 from public.quiz_attempts where user_id = v_uid and attempted_at < (v_monday::timestamp at time zone 'Asia/Seoul')) then
    raise exception '이미 지난 주 풀이 기록이 있습니다. 시드는 한 번만 실행하세요.';
  end if;
  if exists (select 1 from public.hanja_learning where user_id = v_uid and learning_date in (v_monday - 19, v_monday - 7, v_monday - 4)) then
    raise exception '시드 날짜에 이미 학습 기록이 있습니다. 시드는 한 번만 실행하세요.';
  end if;

  -- C0: 가장 이른 학습을 W-19로 이동 (없으면 첫 한자를 배정)
  select character_id into v_c0 from public.hanja_learning where user_id = v_uid order by learning_date, id limit 1;
  if v_c0 is null then
    select id into v_c0 from public.hanja_characters order by sort_order, id limit 1;
    insert into public.hanja_learning (user_id, character_id, learning_date, status)
    values (v_uid, v_c0, v_monday - 19, 'assigned');
  else
    update public.hanja_learning set learning_date = v_monday - 19
     where user_id = v_uid and character_id = v_c0;
  end if;

  -- CX, CY: 아직 배정되지 않은 다음 한자 2개를 지난주에 배정 (학습 완료 상태)
  select id into v_cx from public.hanja_characters c
   where not exists (select 1 from public.hanja_learning hl where hl.user_id = v_uid and hl.character_id = c.id)
   order by sort_order, id limit 1;
  insert into public.hanja_learning (user_id, character_id, learning_date, status, completed_at)
  values (v_uid, v_cx, v_monday - 7, 'completed', ((v_monday - 7)::timestamp at time zone 'Asia/Seoul') + interval '21 hours');

  select id into v_cy from public.hanja_characters c
   where not exists (select 1 from public.hanja_learning hl where hl.user_id = v_uid and hl.character_id = c.id)
   order by sort_order, id limit 1;
  insert into public.hanja_learning (user_id, character_id, learning_date, status, completed_at)
  values (v_uid, v_cy, v_monday - 4, 'completed', ((v_monday - 4)::timestamp at time zone 'Asia/Seoul') + interval '21 hours');

  select id into v_q0 from public.quiz_questions where character_id = v_c0 order by id limit 1;
  select id into v_qx from public.quiz_questions where character_id = v_cx order by id limit 1;
  select id into v_qy from public.quiz_questions where character_id = v_cy order by id limit 1;
  if v_q0 is null or v_qx is null or v_qy is null then
    raise exception '한자 문제를 찾을 수 없습니다 (시드 마이그레이션 확인)';
  end if;

  -- 오답 보기: 정답이 A면 B, 아니면 A
  insert into public.quiz_attempts (user_id, question_id, selected_option_id, is_correct, attempt_type, request_id, attempted_at)
  select v_uid, v.qid,
         case when v.correct then q.correct_option_id
              when q.correct_option_id = 'A' then 'B' else 'A' end,
         v.correct, 'daily', gen_random_uuid(), v.at
    from (values
      (v_q0, false, ((v_monday - 7)::timestamp at time zone 'Asia/Seoul') - interval '1 second'),
      (v_q0, false, (v_monday::timestamp at time zone 'Asia/Seoul')),
      (v_qx, false, ((v_monday - 7)::timestamp at time zone 'Asia/Seoul') + interval '9 hours'),
      (v_qx, false, ((v_monday - 1)::timestamp at time zone 'Asia/Seoul') + interval '23 hours 59 minutes'),
      (v_qy, false, ((v_monday - 4)::timestamp at time zone 'Asia/Seoul') + interval '20 hours'),
      (v_qy, true,  ((v_monday - 4)::timestamp at time zone 'Asia/Seoul') + interval '20 hours 5 minutes')
    ) as v(qid, correct, at)
    join public.quiz_questions q on q.id = v.qid;

  raise notice '테스트 시드 완료: 첫 학습일 %, 지난주 % ~ %', v_monday - 19, v_monday - 7, v_monday - 1;
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
