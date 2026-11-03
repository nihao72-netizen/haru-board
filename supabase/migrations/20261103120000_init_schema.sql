-- =============================================================================
-- 하루정리 (Haru Board) — 초기 스키마 (PRD v1.3 7장)
-- 상태: 초안. 실제 Supabase 적용 전 사용자 승인 필요 (PRD 0장 3항, 9.2).
--
-- 포함: 서비스 전용 17개 테이블, 제약, 인덱스, RLS 정책, 최소 GRANT,
--       updated_at 트리거, 기록 유형 정규화, 학습 상태 전환 가드,
--       회원가입 초기화 트리거(auth.users).
-- 미포함: 원자적 처리 함수(퀴즈 채점, 한자 배정, 복습) → 20261103120100 파일,
--         한자 초기 10자 시드 → supabase/seeds (승인 후 적용).
--
-- 오류 코드 규칙 (Route Handler에서 HTTP 상태로 변환):
--   HB400 유효성 오류, HB401 미인증, HB403 금지, HB404 없음, HB409 충돌
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 비공개 스키마 (Data API에 노출하지 않음)
-- -----------------------------------------------------------------------------
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 0-1. 공통 트리거 함수 (트리거 전용, RPC로 호출 불가)
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.set_updated_at() from public, anon, authenticated;

-- =============================================================================
-- 1. profiles
-- =============================================================================
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name varchar(50) check (display_name is null or length(btrim(display_name)) > 0),
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =============================================================================
-- 2. entry_categories
-- =============================================================================
create table public.entry_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       varchar(50) not null check (length(name) > 0 and name = btrim(name)),
  created_at timestamptz not null default now(),
  constraint entry_categories_user_name_key unique (user_id, name),
  constraint entry_categories_user_id_id_key unique (user_id, id)
);

-- =============================================================================
-- 3. entries
-- =============================================================================
create table public.entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id  uuid not null,
  type         text not null check (type in ('todo', 'memo')),
  record_date  date not null,
  due_date     date,
  title        varchar(200) not null check (length(btrim(title)) > 0),
  content      text,
  is_completed boolean,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- 같은 사용자의 분류만 참조. NO ACTION = 참조 중 삭제 차단(회원 탈퇴 연쇄 삭제는 허용)
  constraint entries_category_fkey
    foreign key (user_id, category_id) references public.entry_categories (user_id, id),
  constraint entries_completed_by_type_check check (
    (type = 'todo' and is_completed is not null) or
    (type = 'memo' and is_completed is null)
  )
);

-- 기록 유형 정규화: memo → is_completed NULL, todo + 값 없음 → false (PRD 4.2)
create or replace function public.normalize_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type = 'memo' then
    new.is_completed := null;
  elsif new.is_completed is null then
    new.is_completed := false;
  end if;
  return new;
end;
$$;
revoke all on function public.normalize_entry() from public, anon, authenticated;

create trigger entries_normalize
  before insert or update on public.entries
  for each row execute function public.normalize_entry();

-- =============================================================================
-- 4. transaction_categories
-- =============================================================================
create table public.transaction_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type       text not null check (type in ('income', 'expense')),
  name       varchar(50) not null check (length(name) > 0 and name = btrim(name)),
  created_at timestamptz not null default now(),
  constraint transaction_categories_user_type_name_key unique (user_id, type, name),
  constraint transaction_categories_user_id_type_key unique (user_id, id, type)
);

-- =============================================================================
-- 5. transactions
-- =============================================================================
create table public.transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id      uuid not null,
  type             text not null check (type in ('income', 'expense')),
  transaction_date date not null,
  name             varchar(200) not null check (length(btrim(name)) > 0),
  amount           bigint not null check (amount > 0),
  memo             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- 같은 사용자 + 같은 유형(income/expense)의 분류만 참조. 참조 중 분류 삭제 차단
  constraint transactions_category_fkey
    foreign key (user_id, category_id, type)
    references public.transaction_categories (user_id, id, type)
);

-- =============================================================================
-- 6. monthly_budgets
-- =============================================================================
create table public.monthly_budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_month date not null check (extract(day from budget_month) = 1),
  amount       bigint not null check (amount > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint monthly_budgets_user_month_key unique (user_id, budget_month),
  constraint monthly_budgets_user_id_id_key unique (user_id, id)
);

-- =============================================================================
-- 7. category_budgets
-- =============================================================================
create table public.category_budgets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  monthly_budget_id uuid not null,
  category_id       uuid not null,
  -- 지출 분류만 허용: 고정값 컬럼 + 복합 FK (PRD 7.1-7)
  category_type     text not null default 'expense' check (category_type = 'expense'),
  amount            bigint not null check (amount > 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint category_budgets_month_category_key unique (monthly_budget_id, category_id),
  -- 전체 예산 삭제 시 분류 예산만 연쇄 삭제
  constraint category_budgets_monthly_budget_fkey
    foreign key (user_id, monthly_budget_id)
    references public.monthly_budgets (user_id, id) on delete cascade,
  -- 예산이 참조 중인 분류 삭제 차단
  constraint category_budgets_category_fkey
    foreign key (user_id, category_id, category_type)
    references public.transaction_categories (user_id, id, type)
);

-- =============================================================================
-- 8. hanja_characters (공통 사전)
-- =============================================================================
create table public.hanja_characters (
  id          uuid primary key default gen_random_uuid(),
  character   varchar(4) not null unique,
  reading     varchar(50) not null,
  meaning     text not null,
  explanation text,
  difficulty  smallint check (difficulty between 1 and 5),
  sort_order  integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =============================================================================
-- 9. hanja_words
-- =============================================================================
create table public.hanja_words (
  id         uuid primary key default gen_random_uuid(),
  word       varchar(50) not null,
  reading    varchar(100) not null,
  meaning    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 동형이의어는 허용, 표기·독음·뜻 완전 동일 중복은 금지
  constraint hanja_words_word_reading_meaning_key unique (word, reading, meaning)
);

-- =============================================================================
-- 10. hanja_word_characters (단어 ↔ 한자 N:M, 구성 순서)
-- =============================================================================
create table public.hanja_word_characters (
  word_id      uuid not null references public.hanja_words (id) on delete cascade,
  character_id uuid not null references public.hanja_characters (id),
  position     smallint not null check (position > 0),
  primary key (word_id, position)
);

-- =============================================================================
-- 11. hanja_word_examples
-- =============================================================================
create table public.hanja_word_examples (
  id          uuid primary key default gen_random_uuid(),
  word_id     uuid not null references public.hanja_words (id) on delete cascade,
  sentence    text not null check (length(btrim(sentence)) > 0),
  explanation text,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- 12. hanja_learning
-- =============================================================================
create table public.hanja_learning (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  character_id  uuid not null references public.hanja_characters (id),
  learning_date date not null,
  status        text not null check (status in ('assigned', 'studying', 'completed')),
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint hanja_learning_user_date_key unique (user_id, learning_date),
  constraint hanja_learning_user_character_key unique (user_id, character_id),
  constraint hanja_learning_completed_at_check
    check ((status = 'completed') = (completed_at is not null))
);

-- 학습 상태 전환 가드 (PRD 4.5): assigned → studying → completed, 역행 금지.
-- 같은 상태로의 PATCH는 변경 없이 통과(멱등). completed_at은 DB가 기록.
create or replace function public.guard_hanja_learning_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = old.status then
    new.completed_at := old.completed_at;
    return new;
  end if;

  if not (
    (old.status = 'assigned' and new.status = 'studying') or
    (old.status = 'studying' and new.status = 'completed')
  ) then
    raise exception 'invalid_status_transition: % -> %', old.status, new.status
      using errcode = 'HB409';
  end if;

  new.completed_at := case when new.status = 'completed' then now() else null end;
  return new;
end;
$$;
revoke all on function public.guard_hanja_learning_status() from public, anon, authenticated;

create trigger hanja_learning_status_guard
  before update on public.hanja_learning
  for each row execute function public.guard_hanja_learning_status();

-- =============================================================================
-- 13. quiz_questions (정답 포함 원본 — 일반 사용자 직접 열람 제한)
-- =============================================================================
create or replace function app_private.is_valid_quiz_options(o jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when o is null or jsonb_typeof(o) <> 'array' or jsonb_array_length(o) <> 4 then false
    else
      (select count(distinct e ->> 'id')
         from jsonb_array_elements(o) e
        where e ->> 'id' in ('A', 'B', 'C', 'D')) = 4
      and not exists (
        select 1 from jsonb_array_elements(o) e
         where coalesce(btrim(e ->> 'text'), '') = ''
      )
  end;
$$;
revoke all on function app_private.is_valid_quiz_options(jsonb) from public, anon, authenticated;

create table public.quiz_questions (
  id                uuid primary key default gen_random_uuid(),
  character_id      uuid not null references public.hanja_characters (id),
  question_type     text not null check (question_type in ('reading', 'meaning')),
  question_text     text not null check (length(btrim(question_text)) > 0),
  options           jsonb not null check (app_private.is_valid_quiz_options(options)),
  correct_option_id text not null check (correct_option_id in ('A', 'B', 'C', 'D')),
  explanation       text,
  created_at        timestamptz not null default now()
);

-- =============================================================================
-- 14. quiz_attempts
-- =============================================================================
create table public.quiz_attempts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  question_id        uuid not null references public.quiz_questions (id),
  selected_option_id text not null check (selected_option_id in ('A', 'B', 'C', 'D')),
  is_correct         boolean not null,
  attempt_type       text not null check (attempt_type in ('daily', 'review')),
  request_id         uuid,
  attempted_at       timestamptz not null default now(),
  -- 같은 요청의 재시도 중복 저장 방지 (NULL은 다중 허용)
  constraint quiz_attempts_user_request_key unique (user_id, request_id),
  -- 복습 항목이 같은 문제의 시도를 가리키는지 FK로 보장하기 위한 키
  constraint quiz_attempts_id_question_key unique (id, question_id),
  constraint quiz_attempts_daily_request_check
    check (attempt_type <> 'daily' or request_id is not null)
);

-- 풀이가 존재하는 문제의 보기/정답 변경 차단 (PRD 7.1-13: 기존 풀이와 의미 충돌 방지)
create or replace function public.guard_quiz_question_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.options is distinct from old.options
      or new.correct_option_id is distinct from old.correct_option_id
      or new.character_id is distinct from old.character_id)
     and exists (select 1 from public.quiz_attempts a where a.question_id = old.id) then
    raise exception 'question_has_attempts' using errcode = 'HB409';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_quiz_question_update() from public, anon, authenticated;

create trigger quiz_questions_update_guard
  before update on public.quiz_questions
  for each row execute function public.guard_quiz_question_update();

-- =============================================================================
-- 15. weekly_reviews
-- =============================================================================
create table public.weekly_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  review_week  date not null check (extract(isodow from review_week) = 1),
  status       text not null check (status in ('pending', 'in_progress', 'completed')),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint weekly_reviews_user_week_key unique (user_id, review_week),
  constraint weekly_reviews_completed_at_check
    check ((status = 'completed') = (completed_at is not null))
);

-- =============================================================================
-- 16. weekly_review_items
-- =============================================================================
create table public.weekly_review_items (
  id               uuid primary key default gen_random_uuid(),
  weekly_review_id uuid not null references public.weekly_reviews (id) on delete cascade,
  question_id      uuid not null references public.quiz_questions (id),
  status           text not null check (status in ('pending', 'completed')),
  quiz_attempt_id  uuid unique,
  completed_at     timestamptz,
  constraint weekly_review_items_review_question_key unique (weekly_review_id, question_id),
  -- 연결된 시도는 반드시 같은 문제에 대한 것
  constraint weekly_review_items_attempt_fkey
    foreign key (quiz_attempt_id, question_id)
    references public.quiz_attempts (id, question_id),
  constraint weekly_review_items_state_check check (
    (status = 'pending'   and quiz_attempt_id is null     and completed_at is null) or
    (status = 'completed' and quiz_attempt_id is not null and completed_at is not null)
  )
);

-- =============================================================================
-- 17. daily_reviews (자유 일기)
-- =============================================================================
create table public.daily_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  review_date date not null,
  content     text not null check (length(btrim(content)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint daily_reviews_user_date_key unique (user_id, review_date)
);

-- =============================================================================
-- updated_at 트리거
-- =============================================================================
create trigger profiles_set_updated_at          before update on public.profiles          for each row execute function public.set_updated_at();
create trigger entries_set_updated_at           before update on public.entries           for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at      before update on public.transactions      for each row execute function public.set_updated_at();
create trigger monthly_budgets_set_updated_at   before update on public.monthly_budgets   for each row execute function public.set_updated_at();
create trigger category_budgets_set_updated_at  before update on public.category_budgets  for each row execute function public.set_updated_at();
create trigger hanja_characters_set_updated_at  before update on public.hanja_characters  for each row execute function public.set_updated_at();
create trigger hanja_words_set_updated_at       before update on public.hanja_words       for each row execute function public.set_updated_at();
create trigger daily_reviews_set_updated_at     before update on public.daily_reviews     for each row execute function public.set_updated_at();

-- =============================================================================
-- 인덱스 (PK/UNIQUE와 중복되지 않는 것만)
-- =============================================================================
create index entries_user_record_date_idx           on public.entries (user_id, record_date);
create index entries_user_category_idx              on public.entries (user_id, category_id);
create index transactions_user_date_idx             on public.transactions (user_id, transaction_date);
create index transactions_user_category_date_idx    on public.transactions (user_id, category_id, transaction_date);
create index category_budgets_user_category_idx     on public.category_budgets (user_id, category_id);
create index category_budgets_user_month_idx        on public.category_budgets (user_id, monthly_budget_id);
create index hanja_word_characters_character_idx    on public.hanja_word_characters (character_id);
create index hanja_word_examples_word_idx           on public.hanja_word_examples (word_id);
create index hanja_learning_character_idx           on public.hanja_learning (character_id);
create index quiz_questions_character_idx           on public.quiz_questions (character_id);
create index quiz_attempts_user_attempted_at_idx    on public.quiz_attempts (user_id, attempted_at);
create index quiz_attempts_question_idx             on public.quiz_attempts (question_id);
create index weekly_review_items_question_idx       on public.weekly_review_items (question_id);

-- =============================================================================
-- RLS 활성화 (17개 전부)
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.entry_categories       enable row level security;
alter table public.entries                enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.transactions           enable row level security;
alter table public.monthly_budgets        enable row level security;
alter table public.category_budgets       enable row level security;
alter table public.hanja_characters       enable row level security;
alter table public.hanja_words            enable row level security;
alter table public.hanja_word_characters  enable row level security;
alter table public.hanja_word_examples    enable row level security;
alter table public.hanja_learning         enable row level security;
alter table public.quiz_questions         enable row level security;
alter table public.quiz_attempts          enable row level security;
alter table public.weekly_reviews         enable row level security;
alter table public.weekly_review_items    enable row level security;
alter table public.daily_reviews          enable row level security;

-- =============================================================================
-- 최소 GRANT: Supabase 기본 권한을 먼저 회수하고 필요한 것만 부여
-- (service_role은 관리·시드용으로 유지)
-- =============================================================================
revoke all on
  public.profiles, public.entry_categories, public.entries,
  public.transaction_categories, public.transactions,
  public.monthly_budgets, public.category_budgets,
  public.hanja_characters, public.hanja_words, public.hanja_word_characters,
  public.hanja_word_examples, public.hanja_learning, public.quiz_questions,
  public.quiz_attempts, public.weekly_reviews, public.weekly_review_items,
  public.daily_reviews
from anon, authenticated;

-- 1. profiles: 생성은 가입 트리거, 삭제는 auth.users 연쇄
grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- 2. entry_categories
grant select, delete on public.entry_categories to authenticated;
grant insert (user_id, name) on public.entry_categories to authenticated;
grant update (name) on public.entry_categories to authenticated;

-- 3. entries
grant select, delete on public.entries to authenticated;
grant insert (user_id, category_id, type, record_date, due_date, title, content, is_completed)
  on public.entries to authenticated;
grant update (category_id, type, record_date, due_date, title, content, is_completed)
  on public.entries to authenticated;

-- 4. transaction_categories: 유형(type)은 생성 후 변경 불가
grant select, delete on public.transaction_categories to authenticated;
grant insert (user_id, type, name) on public.transaction_categories to authenticated;
grant update (name) on public.transaction_categories to authenticated;

-- 5. transactions
grant select, delete on public.transactions to authenticated;
grant insert (user_id, category_id, type, transaction_date, name, amount, memo)
  on public.transactions to authenticated;
grant update (category_id, type, transaction_date, name, amount, memo)
  on public.transactions to authenticated;

-- 6. monthly_budgets
grant select, delete on public.monthly_budgets to authenticated;
grant insert (user_id, budget_month, amount) on public.monthly_budgets to authenticated;
grant update (amount) on public.monthly_budgets to authenticated;

-- 7. category_budgets: category_type은 입력·수정 권한 없음 (기본값 'expense' 고정)
grant select, delete on public.category_budgets to authenticated;
grant insert (user_id, monthly_budget_id, category_id, amount) on public.category_budgets to authenticated;
grant update (amount) on public.category_budgets to authenticated;

-- 8~11. 한자 공통 사전: 로그인 사용자 읽기 전용
grant select on public.hanja_characters, public.hanja_words,
                public.hanja_word_characters, public.hanja_word_examples to authenticated;

-- 12. hanja_learning: 생성은 배정 함수만, 사용자는 status만 변경 (전환 가드 트리거 적용)
grant select on public.hanja_learning to authenticated;
grant update (status) on public.hanja_learning to authenticated;

-- 13. quiz_questions: 정답·해설 컬럼 제외한 열만 읽기 허용
grant select (id, character_id, question_type, question_text, options)
  on public.quiz_questions to authenticated;

-- 14~16. 풀이·복습: 읽기만. 쓰기는 서버 채점 함수만
grant select on public.quiz_attempts, public.weekly_reviews, public.weekly_review_items to authenticated;

-- 17. daily_reviews
grant select, delete on public.daily_reviews to authenticated;
grant insert (user_id, review_date, content) on public.daily_reviews to authenticated;
grant update (content) on public.daily_reviews to authenticated;

-- =============================================================================
-- RLS 정책 (auth.uid()는 (select ...)로 감싸 행마다 재평가하지 않도록 함)
-- =============================================================================

-- profiles
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 사용자 소유 테이블 공통 패턴: select / insert / update / delete 각각
-- entry_categories
create policy entry_categories_select_own on public.entry_categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy entry_categories_insert_own on public.entry_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy entry_categories_update_own on public.entry_categories
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy entry_categories_delete_own on public.entry_categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- entries
create policy entries_select_own on public.entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy entries_insert_own on public.entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy entries_update_own on public.entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy entries_delete_own on public.entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- transaction_categories
create policy transaction_categories_select_own on public.transaction_categories
  for select to authenticated using (user_id = (select auth.uid()));
create policy transaction_categories_insert_own on public.transaction_categories
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy transaction_categories_update_own on public.transaction_categories
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transaction_categories_delete_own on public.transaction_categories
  for delete to authenticated using (user_id = (select auth.uid()));

-- transactions
create policy transactions_select_own on public.transactions
  for select to authenticated using (user_id = (select auth.uid()));
create policy transactions_insert_own on public.transactions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy transactions_update_own on public.transactions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy transactions_delete_own on public.transactions
  for delete to authenticated using (user_id = (select auth.uid()));

-- monthly_budgets
create policy monthly_budgets_select_own on public.monthly_budgets
  for select to authenticated using (user_id = (select auth.uid()));
create policy monthly_budgets_insert_own on public.monthly_budgets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy monthly_budgets_update_own on public.monthly_budgets
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy monthly_budgets_delete_own on public.monthly_budgets
  for delete to authenticated using (user_id = (select auth.uid()));

-- category_budgets
create policy category_budgets_select_own on public.category_budgets
  for select to authenticated using (user_id = (select auth.uid()));
create policy category_budgets_insert_own on public.category_budgets
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy category_budgets_update_own on public.category_budgets
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy category_budgets_delete_own on public.category_budgets
  for delete to authenticated using (user_id = (select auth.uid()));

-- 한자 공통 사전: 로그인 사용자 읽기
create policy hanja_characters_select_all on public.hanja_characters
  for select to authenticated using (true);
create policy hanja_words_select_all on public.hanja_words
  for select to authenticated using (true);
create policy hanja_word_characters_select_all on public.hanja_word_characters
  for select to authenticated using (true);
create policy hanja_word_examples_select_all on public.hanja_word_examples
  for select to authenticated using (true);

-- hanja_learning: 본인 행 읽기, status 변경 (insert/delete 정책 없음)
create policy hanja_learning_select_own on public.hanja_learning
  for select to authenticated using (user_id = (select auth.uid()));
create policy hanja_learning_update_own on public.hanja_learning
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- quiz_questions: 본인에게 배정된 한자의 문제만 (정답 컬럼은 GRANT로 차단)
create policy quiz_questions_select_assigned on public.quiz_questions
  for select to authenticated
  using (exists (
    select 1 from public.hanja_learning hl
     where hl.user_id = (select auth.uid())
       and hl.character_id = quiz_questions.character_id
  ));

-- quiz_attempts / weekly_reviews: 본인 행 읽기만
create policy quiz_attempts_select_own on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()));
create policy weekly_reviews_select_own on public.weekly_reviews
  for select to authenticated using (user_id = (select auth.uid()));

-- weekly_review_items: user_id가 없으므로 상위 회차 소유권으로 검사
create policy weekly_review_items_select_own on public.weekly_review_items
  for select to authenticated
  using (exists (
    select 1 from public.weekly_reviews r
     where r.id = weekly_review_items.weekly_review_id
       and r.user_id = (select auth.uid())
  ));

-- daily_reviews
create policy daily_reviews_select_own on public.daily_reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy daily_reviews_insert_own on public.daily_reviews
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy daily_reviews_update_own on public.daily_reviews
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy daily_reviews_delete_own on public.daily_reviews
  for delete to authenticated using (user_id = (select auth.uid()));

-- =============================================================================
-- 회원가입 초기화 (PRD 7장 보완, 4.1)
-- auth.users INSERT는 supabase_auth_admin 역할로 실행되어 public 테이블 권한이 없으므로
-- 이 함수만 SECURITY DEFINER가 불가피하다. search_path 비움 + 스키마 명시,
-- 충돌 무시(ON CONFLICT DO NOTHING)로 재실행해도 중복 생성되지 않는다.
-- =============================================================================
create or replace function app_private.initialize_user(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (p_user_id, nullif(btrim(left(p_display_name, 50)), ''))
  on conflict (id) do nothing;

  insert into public.entry_categories (user_id, name)
  select p_user_id, n from unnest(array['공부', '업무', '일상']) as n
  on conflict on constraint entry_categories_user_name_key do nothing;

  insert into public.transaction_categories (user_id, type, name)
  select p_user_id, t.type, t.name
    from (values
      ('expense', '식비'), ('expense', '교통'), ('expense', '쇼핑'),
      ('expense', '생활'), ('expense', '문화'),
      ('income',  '급여'), ('income',  '부수입'), ('income', '용돈')
    ) as t(type, name)
  on conflict on constraint transaction_categories_user_type_name_key do nothing;
end;
$$;
revoke all on function app_private.initialize_user(uuid, text) from public, anon, authenticated;

create or replace function app_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app_private.initialize_user(new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- 복구 절차 (SQL Editor에서 관리자 권한으로 실행): 초기화가 누락된 사용자 재초기화
--   select app_private.initialize_user(u.id, u.raw_user_meta_data ->> 'display_name')
--     from auth.users u
--    where not exists (select 1 from public.profiles p where p.id = u.id);
