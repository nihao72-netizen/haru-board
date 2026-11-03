-- =============================================================================
-- 하루정리 — 할 일 시각·우선순위·미리 알림·하위 작업 (할 일 화면 개편)
-- 대상: public.entries 열 4개 + 제약 + 인덱스 + 권한. 기존 데이터는 변경하지 않음
--   scheduled_time : 할 일 날짜(record_date)의 시각. 없으면 날짜만 있는 할 일
--   priority       : 1(가장 높음) ~ 4(기본)
--   remind_at      : 미리 알림 시각 (앱 화면이 열려 있을 때 브라우저 알림으로 표시)
--   parent_id      : 하위 작업의 부모 할 일. 같은 사용자의 행만 참조, 부모 삭제 시 함께 삭제
-- 기존 행: scheduled_time·remind_at·parent_id = NULL, priority = 4
-- =============================================================================

alter table public.entries
  add column scheduled_time time,
  add column priority       smallint not null default 4,
  add column remind_at      timestamptz,
  add column parent_id      uuid;

alter table public.entries
  add constraint entries_priority_check check (priority between 1 and 4),
  add constraint entries_parent_not_self_check check (parent_id is null or parent_id <> id),
  -- 하위 작업이 같은 사용자의 할 일만 부모로 갖도록 복합 FK의 참조 대상 키
  add constraint entries_user_id_id_key unique (user_id, id);

alter table public.entries
  add constraint entries_parent_fkey
    foreign key (user_id, parent_id) references public.entries (user_id, id) on delete cascade;

create index entries_user_parent_idx    on public.entries (user_id, parent_id) where parent_id is not null;
create index entries_user_remind_at_idx on public.entries (user_id, remind_at) where remind_at is not null;

-- 사용자 입력·수정 허용 열 추가 (기존 열 단위 권한 방식 유지, RLS 정책은 그대로 적용)
grant insert (scheduled_time, priority, remind_at, parent_id) on public.entries to authenticated;
grant update (scheduled_time, priority, remind_at, parent_id) on public.entries to authenticated;
