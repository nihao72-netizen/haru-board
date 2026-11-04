# 하루정리 (Haru Board) — 통합 제품 요구사항 정의서 (PRD)

- 버전: **1.3 통합본** (기존 v1.1 전체 설계 + v1.2 보완 + 개발 전 충돌 수정)
- 추가: **v1.4 추가 확정 규칙** (2026-11-03~04, 구현 중 사용자 확정) — 맨 아래 절 참조. 본문과 다르면 v1.4 절이 우선.
- 기준일: 2026-11-03
- 상태: 개발 명세. 구현·테스트·배포 완료를 의미하지 않음.
- 단일 기준 문서: 이 파일을 개발의 원본 요구사항으로 사용. 충돌 시 아래 **확정 운영 규칙** 우선.

## 0. 에이전트에게 필수 지시

1. **전체 범위 유지**: 아래 17개 서비스 전용 테이블과 모든 기능이 최종 개발 목표다. 기능을 임의로 없애지 않는다. 다만 순차 구현한다.
2. **첫 배포 우선**: Next.js 기본 화면 → 로컬 빌드 → GitHub 푸시 → Vercel 배포·접속 확인을 **DB 구축 전** 실행한다. 이후 기능 완성마다 재배포한다.
3. 실제 DB 변경, 계정 생성, 외부 GitHub/Vercel 변경 전에 대상 및 영향 범위를 보고하고 승인을 받는다. 기존 프로젝트/파일을 함부로 덮어쓰지 않는다.
4. 초깃값인 한자는 **10자만** 적재한다. 3,000자는 장기 확장 목표이며 초기 데이터에 넣지 않는다. **정확한 10자 목록은 아직 사용자 확정 전**이므로 검증 가능한 기초 한자 10자 후보를 제안하고 사용자 승인 후 적재한다. 한자당 최소 한 개의 검증된 4지선다 문제를 준비한다. 관련 단어·예문 자료도 검증한다.
5. 이메일·비밀번호 가입, Supabase Auth. 실험 환경에서만 **Confirm Email 비활성화**. 평가자는 **배포 사이트에서 직접 가입**하도록 README에 안내한다. 공개 README에 데모 비밀번호를 적지 않는다.
6. 배포 환경에서는 Supabase Authentication URL Configuration의 Site URL에 실제 Vercel 프로덕션 URL을, 필요한 Redirect URLs에 콜백 및 개발용 주소를 설정·검증한다. 비밀번호 재설정 발송은 별도 테스트한다.
7. 한국 날짜 기준은 `Asia/Seoul`이다. 퀴즈/주간 복습은 서버 채점·소유권 검사·중복 요청 방지가 필수다.
8. 개발 중 **2026-11-04 15:00 KST**는 기능 추가 중단을 권장하는 시점이다(사용자가 변경 가능). 이후 기존 동작 안정화, 빌드/배포, README, 테스트 우선. 마감 시 미완성 기능을 README에 정확히 표시한다.
9. PRD의 실제 구현 범위 또는 상태에 관한 판단은 거짓 보고하지 않는다. 프로덕션 배포 URL에서 테스트한다.

---

# 1. 서비스 개요

## 1.1 서비스 정의

**하루정리 (Haru Board)**: 할 일·메모, 가계부/예산, 매일 한자 한 글자/퀴즈/주간 복습, 날짜별 생활 기록과 자유 일기를 한곳에서 관리하는 개인 반응형 웹 대시보드.

## 1.2 목표

- 생활 기록을 흩어진 앱 대신 한 서비스에 입력·조회한다.
- 홈에서 오늘과 이전 미완료 할 일을 보고, 가계부·학습·일기 상태를 확인한다.
- 수입/지출과 이유(거래명·메모)를 함께 남겨 맥락을 유지한다.
- 매일 한자를 학습하고 지난주 오답을 월요일부터 복습한다.
- 날짜를 선택해 하루 기록을 되돌아보고 자유 일기를 쓴다.
- 계정별 기록이 안전하게 분리되고 로그아웃/재로그인 후에도 유지된다.

# 2. 사용자 및 문제 정의

## 2.1 사용자

일정·지출·학습·회고를 통합하고 싶은 개인 사용자. 초기 대상은 일상과 공부를 함께 관리하는 성인 학습자.

## 2.2 페르소나

- 할 일과 공부 계획을 기록하지만 여러 앱으로 이동하기 번거롭다.
- 가계부에 금액만 남으면 소비 이유와 상황을 기억하기 어렵다.
- 전날 미완료한 할 일을 오늘 놓치기 쉽다.
- 한자를 조금씩 공부하고 오답을 복습하고 싶다.
- 저녁에는 하루 활동을 확인하고 자유 일기를 쓰고 싶다.

## 2.3 사용 상황

아침에 홈에서 미완료 할 일 확인 → 낮에 기록/지출 입력 → 한자 학습·퀴즈 → 저녁에 날짜별 기록과 일기 → 월요일엔 지난주 오답 복습.

# 3. 범위·우선순위·기술

## 3.1 전체 개발 목표 (삭제 금지)

1. 이메일·비밀번호 계정 관리
2. 할 일·메모 CRUD·카테고리·날짜·검색
3. 가계부 수입·지출 CRUD, 분류, 일/주/월 목록·합계·월별 통계
4. 월 전체 예산, 지출 분류별 예산 및 경고
5. 한자 **초기 10자**, 매일 한 글자·학습 상태
6. 4지선다 퀴즈·서버 채점·풀이 기록
7. 직전 월~일 오답의 월요일 복습·미접속 회차 유지
8. 날짜별 통합 생활 기록·자유 일기 CRUD
9. 홈 대시보드
10. 첫 배포 및 기능별 지속 배포

## 3.2 구현 순서

**반드시 최초 배포 먼저**: Next.js 기본 화면 → GitHub → Vercel → Supabase 연결 → 인증 및 DB 마이그레이션(필요한 의존성 순서) → 할 일·메모 → 가계부 → 예산/통계 → 한자 → 퀴즈/복습 → 하루 마무리/홈 통합. 단계별 빌드·스모크 테스트·재배포.

## 3.3 기술 스택

- Next.js App Router + React + TypeScript
- Tailwind CSS
- Next.js Route Handlers (서버 API)
- Supabase PostgreSQL, Supabase Auth, PostgreSQL RLS
- Git/GitHub, Vercel
- Windows 로컬 개발; 별도 로컬 PostgreSQL·SQLite 도입 불필요
- 데이터베이스의 스키마 변경은 **검토된 SQL migration 파일로 버전 관리**. 파일 생성과 실제 적용은 다른 작업이다.

# 4. 기능 요구사항

## 4.1 회원가입·로그인

- 이메일, 비밀번호, 비밀번호 확인; 닉네임 선택.
- Supabase Auth `signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser` 이용.
- 초기 실험 환경: Confirm Email 비활성화. 운영 전 재활성화 여부 검토.
- `profiles`는 `auth.users.id`와 동일 UUID. 신규 회원 가입 시 안전한 DB 트리거로 프로필 및 기본 카테고리 생성. 트리거 오류로 회원가입 실패 가능성을 테스트하고 재시도/복구 방안 마련.
- 기본 entry 카테고리: `공부`, `업무`, `일상`.
- 기본 expense 카테고리: `식비`, `교통`, `쇼핑`, `생활`, `문화`.
- 기본 income 카테고리: `급여`, `부수입`, `용돈`.
- 데모 평가 기본 접근: 배포 사이트에서 이메일 확인 없이 평가자가 직접 가입. 공개 README에 데모 비밀번호 게시 금지. 선택적 데모 계정은 가상 데이터만 사용.

## 4.2 할 일·메모

- 공통 `entries` 테이블의 `type=todo|memo`; 기록 날짜(`record_date`), 분류, 제목(1~200자, 공백 불가), 상세 내용, 선택 마감일(`due_date`).
- 할 일: `is_completed=true|false`; 메모: `is_completed=NULL`.
- 추가/목록/상세/수정/삭제, todo 완료 체크; 분류/날짜/유형/완료·마감·검색 필터. 사용 중인 카테고리 삭제 제한.
- **홈의 오늘 할 일 조회 집합**: `type=todo AND (record_date=오늘 OR (record_date<오늘 AND is_completed=false))`. 따라서 오늘 등록한 완료·미완료 할 일은 모두 포함하고, 과거 기록은 미완료만 포함하며, 미래 기록은 제외한다. 화면의 강조 목록은 이 집합 중 미완료 항목, 접기·펼치기 완료 목록은 오늘 날짜의 완료 항목만 사용한다. **오늘 전체/완료/미완료 건수**는 `record_date=오늘`인 todo를 기준으로, **이전 미완료 건수**는 `record_date<오늘 AND is_completed=false`를 기준으로 별도 집계한다.
- **하루 마무리**: 선택 날짜와 `record_date`가 일치하는 기록만 표시한다.
- `entries.completed_at`이 없으므로 완료한 **시점의 이력**은 알 수 없으며 과거 날짜 조회에서도 현재 완료 상태가 표시된다. 홈의 이전 미완료를 오늘 완료해도 원래 record_date는 변경하지 않는다.
- 기록 종류 변경 시 memo는 `is_completed=NULL`, todo는 값 없을 때 false.

## 4.3 가계부

- `income|expense` 거래 입력: 날짜, 카테고리, 거래명, 양의 정수 금액(원), 선택 메모.
- 수입·지출 카테고리는 구분되며 신규 카테고리를 저장·재사용. '기타'는 새 분류 입력 UI 선택지(필수 실제 DB 분류 아님).
- 조회: day/week(Mon-Sun)/month, 분류, 유형, 검색, 페이지. 각 기간 총수입·총지출·차액. **목록 유형 필터와 기간 전체 합계는 독립**.
- 통계·예산 탭: 월별 지출 비교, 전월 대비 증감(전월 지출 0이면 비교 불가), 분류별 차트.
- 금액은 `BIGINT > 0`; income/expense는 type으로 구분; 카테고리의 소유자/유형이 거래와 일치해야 한다.

## 4.4 예산

- 월 전체 예산 (`monthly_budgets`): 사용자별·월별 하나, `budget_month`는 매월 1일.
- 분류별 예산 (`category_budgets`): 해당 월 예산 아래 지출 카테고리별 하나. 전체 예산이 먼저 존재해야 함.
- 전체 예산과 분류 예산은 **더하지 않음**. 분류 예산이 없는 거래도 전체 지출에 포함.
- 사용률 = 해당 월 `expense` 거래 실제 합계 ÷ 설정 예산 × 100. 남은 예산 = 예산 - 실제 지출(음수 가능).
- `normal` <80%, `warning` 80% 이상~100% 미만, `limit_reached` 정확히 100%, `exceeded` >100%, `not_set` 미설정. 판정은 반올림 전 금액 기준. 사용률 표시 반올림 가능.
- 초과해도 지출 저장은 차단하지 않음. 전체 예산 삭제 시 자식 분류 예산만 삭제; 거래·카테고리 보존.

## 4.5 한자 (초기 **10자**)

- DB·API는 추후 약 3,000자로 확대 가능하되 최초 시드에는 **검증된 10자만**.
- 정확한 10자는 사용자 미확정: 에이전트가 후보·근거·음·뜻·설명·관련 단어·예문·4지선다 문제 초안을 제시해 승인받는다.
- 매일(월요일 포함) 서울 날짜 기준 새 한 글자. 같은 날 재접속 시 동일 한자. 이전 배정 한자는 다시 신규 배정 금지.
- 10개 소진되면 신규 배정 없음 상태 안내; 기존 학습·퀴즈·복습 기록은 계속 이용.
- 학습 상태: `assigned`(배정 시) → `studying`(사용자가 학습 시작 버튼 선택 시 PATCH) → `completed`(사용자가 학습 완료 버튼 선택 시 PATCH). 단순 GET이나 퀴즈 제출로 자동 변경하지 않음. 완료 상태 단순 재방문으로 역행 금지.
- 한자별 글자, 한국어 음, 기본 뜻, 구성 설명, 난이도, 관련 단어/독음/뜻 및 예문 조회.

## 4.6 퀴즈

- 한자당 **최소 1개의 검증된 4지선다 문제**. 문제 유형 `reading|meaning`. 네 선택지 A-D, 정답 하나.
- 최초 MVP에서는 보기 순서 고정. `quiz_questions` 정답 원본을 클라이언트가 직접 읽지 못하게 함.
- 서버가 출제 대상·선택지의 유효성을 검증, 채점·풀이 이력 기록 후 정답/해설 반환.
- **일일 문제 반복 풀이 허용**: 정상적인 제출마다 별도 시도 기록. 같은 요청의 네트워크 재시도만 `request_id`로 멱등 처리. **초기 10자에 대해서는 한자당 정확히 1문제**를 준비하고, `/api/hanja/quizzes/today`는 그 하나의 문제를 반환한다. 추후 한자당 여러 문제를 추가하기 전에는 API 응답을 배열로 바꾸거나 선택 규칙을 별도 확정한다.
- 한 주 중 한 번이라도 틀린 문제는 나중에 맞혀도 복습 대상.

## 4.7 주간 오답 복습

- 한국 시간 기준 **직전 종료된 월요일 00:00~그다음 월요일 00:00 미만**에 풀이한 `attempt_type=daily AND is_correct=false`만 수집.
- 문제 ID 기준 중복 제거; 서로 다른 문제라면 같은 한자여도 별개.
- 사용자 **첫 학습 날짜(`MIN(hanja_learning.learning_date)`)가 속한 주부터, 이미 종료된 주만** 회차 생성 가능. 퀴즈 첫 풀이 날짜가 기준이 아니다. 회차의 `review_week`는 복습을 시작할 월요일 날짜.
- 월요일에 접속하지 않아도 나중에 미생성된 과거 회차 준비. 첫 생성 후 해당 회차 문제 목록 고정. 미완료 회차 유지.
- 월요일 신규 한자 배정과 복습은 독립적.
- 복습 항목은 정답/오답과 상관없이 제출하면 `completed`, 동일 회차 항목은 한 번만 제출. `quiz_attempts` 삽입과 `weekly_review_items` 상태 및 회차 완료 전환을 **하나의 DB 트랜잭션**으로 처리.
- 복습 시 오답을 다음 주에 자동 재이월하지 않음(후속 확장).
- 자연 경과를 기다리지 않고 검증: **별도 테스트 사용자**와 지난주 `attempted_at`을 가진 관리자 권한 시드 데이터로 복습 생성·중복 제거·완료 테스트. 일반 API에서 attempted_at 조작 금지.

## 4.8 하루 마무리·일기

- 사용자가 `YYYY-MM-DD` 날짜를 선택.
- `entries.record_date`, `transactions.transaction_date`, `hanja_learning.learning_date`, `quiz_attempts.attempted_at`의 서울 날짜를 기준으로 그날 기록을 **원본에서 실시간 조회**.
- 오늘 배정 한자가 없어도 그날 퀴즈·복습 시도 기록은 반환 가능.
- `daily_reviews`에는 **자유 일기 본문만** 사용자+날짜 당 1건 저장/수정/삭제(UPSERT). 생활 기록을 중복 저장하지 않음.
- 과거 시점의 완료 상태가 아닌 현재 DB의 상태를 반영한다.

## 4.9 홈

- 가장 크게: 오늘 기록 및 이전 미완료 todo의 제목, 완료 체크, 빠른 추가, 건수, 완료 목록 접기.
- 작은 카드: 오늘 수입/지출 및 이번 달 지출/전체 예산 상태; 오늘 한자·학습 상태와 미완료 복습 회차 수; 오늘 일기 작성 여부.
- 홈 GET은 **조회 전용**, 한자 배정/복습 회차 생성하지 않음. 별도 POST API 사용.

# 5. 화면·사용자 흐름

| 화면 | 핵심 요소 |
|---|---|
| 회원가입 | 이메일, 비밀번호, 확인, 닉네임(선택) |
| 로그인 | 이메일·비밀번호, 비밀번호 재설정 요청 링크 |
| 새 비밀번호 설정 | 재설정 링크 접속 후 새 비밀번호 입력·확인·저장, 유효한 복구 세션 검증 |
| 홈 | 대형 미완료 할 일, 소형 가계부·한자·일기 카드 |
| 할 일·메모 | 유형 전환, 기록 입력, 분류 관리, 목록·검색·필터·완료 |
| 가계부 거래 내역 탭 | 수입·지출 입력, 일/주/월 목록, 분류, 합계 |
| 가계부 통계·예산 탭 | 월 비교, 분류별 지출, 전체·분류 예산, 사용률/경고 |
| 한자 오늘의 학습 | 큰 한자, 음·뜻·설명·한자어·예문, 상태 변경 |
| 한자 퀴즈 | 4지선다 선택·제출·해설·반복 응시 |
| 한자 오답 복습 | 과거 회차 목록, 문제, 진행률, 결과 |
| 하루 마무리 | 날짜 선택, 생활 기록 통합 표시, 자유 일기 CRUD |
| 내 계정 | 닉네임, 로그아웃 |

주요 흐름: 가입 → 로그인 → 홈 → 기록/가계부/한자 입력 → 하루 마무리. 매주 월요일 신규 학습 + 직전 종료된 주의 오답 복습.

# 6. UI/UX

- 데스크톱·모바일 반응형, 한글 중심, 단순한 입력·목록 구조.
- 제목/금액/날짜 필수 표시. 제출 전 검증 안내, 저장 성공·실패 메시지, 삭제 확인.
- 로딩·빈 결과·오류 상태 구분. 색 외에도 '주의/초과/완료' 텍스트 사용.
- 할 일 홈 우선(큰 영역), 가계부·한자·일기 보조 카드. 완료 목록 접기·펼치기.
- 가계부 2탭: 거래 내역 / 통계·예산.
- 한자 3영역: 일일 학습 / 퀴즈 / 오답 복습.
- 하루 마무리: 할 일 → 메모 → 가계부 → 한자/퀴즈 → 자유 일기. 회고 질문 강제 없음.

# 7. DB 스키마 — 서비스 전용 **17개**

인증 테이블 `auth.users`, `auth.identities`는 Supabase 관리 테이블이며 **17개에 포함하지 않는다**. 아래 타입은 PostgreSQL용 설계. PK는 지정하지 않은 경우 UUID, 시간은 `TIMESTAMPTZ`.

## 7.1 전 테이블 컬럼 및 제약

### 1. `profiles`
- `id UUID PK REFERENCES auth.users(id)` (동일 UUID)
- `display_name VARCHAR(50) NULL`
- `avatar_url TEXT NULL`
- `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- `auth.users`와 1:1. 사용자 자신의 프로필만 접근.

### 2. `entry_categories`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `name VARCHAR(50) NOT NULL`, `created_at TIMESTAMPTZ`
- `UNIQUE(user_id,name)`, trim 후 공백 금지. FK용 `UNIQUE(user_id,id)`.
- 기본: 공부/업무/일상. 참조 중 삭제 제한.

### 3. `entries`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `category_id UUID NOT NULL`, `type TEXT NOT NULL CHECK IN ('todo','memo')`
- `record_date DATE NOT NULL`, `due_date DATE NULL`, `title VARCHAR(200) NOT NULL`, `content TEXT NULL`, `is_completed BOOLEAN NULL`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- `FOREIGN KEY (user_id,category_id) REFERENCES entry_categories(user_id,id)`.
- `CHECK ((type='todo' AND is_completed IS NOT NULL) OR (type='memo' AND is_completed IS NULL))`; trim 제목 필수. 1:N category→entries.

### 4. `transaction_categories`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `type TEXT NOT NULL CHECK IN ('income','expense')`, `name VARCHAR(50) NOT NULL`, `created_at TIMESTAMPTZ`
- `UNIQUE(user_id,type,name)` 및 참조용 `UNIQUE(user_id,id,type)`. 거래 또는 예산이 참조 중인 분류 삭제는 FK RESTRICT 및 API 409로 차단한다.
- 지출 기본: 식비/교통/쇼핑/생활/문화; 수입: 급여/부수입/용돈.

### 5. `transactions`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `category_id UUID NOT NULL`, `type TEXT NOT NULL CHECK IN ('income','expense')`
- `transaction_date DATE NOT NULL`, `name VARCHAR(200) NOT NULL`, `amount BIGINT NOT NULL CHECK(amount>0)`, `memo TEXT NULL`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- `FOREIGN KEY(user_id,category_id,type) REFERENCES transaction_categories(user_id,id,type)`; 거래명 trim 필수. **거래가 참조 중인 분류는 삭제 금지(HTTP 409)**. category_budgets에서 참조 중인 분류도 삭제 금지(HTTP 409). 삭제 시 거래·예산을 연쇄 삭제하지 않는다.

### 6. `monthly_budgets`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `budget_month DATE NOT NULL`, `amount BIGINT NOT NULL CHECK(amount>0)`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- `UNIQUE(user_id,budget_month)`; 월의 1일인지 CHECK. 자식 참조용 `UNIQUE(user_id,id)`.

### 7. `category_budgets`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `monthly_budget_id UUID NOT NULL`, `category_id UUID NOT NULL`, `amount BIGINT NOT NULL CHECK(amount>0)`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- `UNIQUE(monthly_budget_id,category_id)`.
- `(user_id,monthly_budget_id)`는 같은 사용자 `monthly_budgets` 참조; `(user_id,category_id)`는 같은 사용자 `transaction_categories` 참조.
- **expense만 허용**: `category_type TEXT NOT NULL DEFAULT 'expense' CHECK (category_type = 'expense')` 컬럼을 추가한다. `transaction_categories`에 존재하는 `UNIQUE(user_id,id,type)`를 대상으로 `FOREIGN KEY(user_id,category_id,category_type) REFERENCES transaction_categories(user_id,id,type)` 복합 FK를 걸어 DB에서 지출 분류만 허용한다. `FOREIGN KEY(user_id,monthly_budget_id) REFERENCES monthly_budgets(user_id,id)`도 적용한다. category_type은 사용자 입력으로 수정하지 못하도록 한다.
- `monthly_budgets` 삭제 시 category_budgets만 연쇄 삭제; 거래는 유지.

### 8. `hanja_characters`
- `id UUID PK`, `character VARCHAR(4) NOT NULL UNIQUE`, `reading VARCHAR(50) NOT NULL`, `meaning TEXT NOT NULL`, `explanation TEXT NULL`, `difficulty SMALLINT NULL`, `sort_order INTEGER NOT NULL`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- **초기 10자만 적재**. 약 3,000자는 추후. 정렬은 `sort_order,id`.

### 9. `hanja_words`
- `id UUID PK`, `word VARCHAR(50) NOT NULL`, `reading VARCHAR(100) NOT NULL`, `meaning TEXT NOT NULL`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- 동형이의어 가능, 완전 동일 표기/독음/뜻 중복은 방지.

### 10. `hanja_word_characters`
- `word_id UUID NOT NULL FK hanja_words`, `character_id UUID NOT NULL FK hanja_characters`, `position SMALLINT NOT NULL CHECK(position>0)`
- `PRIMARY KEY(word_id,position)`; 한 단어의 구성 한자 순서를 반영. 여러 한자어와 한자는 N:M.

### 11. `hanja_word_examples`
- `id UUID PK`, `word_id UUID NOT NULL FK hanja_words`, `sentence TEXT NOT NULL`, `explanation TEXT NULL`, `created_at TIMESTAMPTZ`.

### 12. `hanja_learning`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `character_id UUID NOT NULL FK hanja_characters`, `learning_date DATE NOT NULL`, `status TEXT NOT NULL CHECK IN ('assigned','studying','completed')`, `completed_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ`
- `UNIQUE(user_id,learning_date)`, `UNIQUE(user_id,character_id)`; 상태 전환은 지정된 API로 관리.

### 13. `quiz_questions`
- `id UUID PK`, `character_id UUID NOT NULL FK hanja_characters`, `question_type TEXT NOT NULL CHECK IN ('reading','meaning')`, `question_text TEXT NOT NULL`, `options JSONB NOT NULL`, `correct_option_id TEXT NOT NULL CHECK IN ('A','B','C','D')`, `explanation TEXT NULL`, `created_at TIMESTAMPTZ`
- 보기 구조: `[ {"id":"A","text":"..."}, {"id":"B","text":"..."}, {"id":"C","text":"..."}, {"id":"D","text":"..."} ]`. 정확히 네 고유 ID와 정답 1개 보장. 문제 수정 시 이미 존재하는 풀이와 의미 충돌 방지.
- **정답·해설 포함 원본을 일반 사용자에게 직접 SELECT 허용하지 않는다.** 문제 제공용 서버 API만 제한된 필드 반환.

### 14. `quiz_attempts`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `question_id UUID NOT NULL FK quiz_questions`, `selected_option_id TEXT NOT NULL`, `is_correct BOOLEAN NOT NULL`, `attempt_type TEXT NOT NULL CHECK IN ('daily','review')`, `request_id UUID NULL`, `attempted_at TIMESTAMPTZ NOT NULL`
- `UNIQUE(user_id,request_id)` (NULL은 다중 허용). 일일 퀴즈 제출 시 request_id는 UUID 필수로 요구하며 중복 재시도는 기존 결과를 반환한다. 복습은 item_id당 한 번만 저장하는 원자적 처리와 동일 요청 재시도 시 기존 결과 반환을 적용한다. 각 시도 기록 유지. 선택지와 정답 여부는 서버만 검증/기록. 클라이언트의 직접 임의 INSERT·UPDATE 금지.
- 리뷰 항목과 같은 사용자/문제인지 확인할 수 있도록 적절한 FK/트랜잭션 검증.

### 15. `weekly_reviews`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `review_week DATE NOT NULL`, `status TEXT NOT NULL CHECK IN ('pending','in_progress','completed')`, `completed_at TIMESTAMPTZ NULL`, `created_at TIMESTAMPTZ`
- `UNIQUE(user_id,review_week)`; 월요일 날짜만 허용. 자식 접근 권한은 상위 회차의 소유자를 통해 검사.

### 16. `weekly_review_items`
- `id UUID PK`, `weekly_review_id UUID NOT NULL FK weekly_reviews`, `question_id UUID NOT NULL FK quiz_questions`, `status TEXT NOT NULL CHECK IN ('pending','completed')`, `quiz_attempt_id UUID NULL FK quiz_attempts`, `completed_at TIMESTAMPTZ NULL`
- `UNIQUE(weekly_review_id,question_id)`. `quiz_attempt_id`가 채워진 항목에 대한 신규 채점은 거부한다. 동일 항목·동일 선택지의 단순 재전송은 기존 채점 결과를 반환하고 추가 풀이 기록을 생성하지 않으며, 다른 선택지를 제출하면 409를 반환한다. 각 최초 제출은 DB 트랜잭션으로 시도 삽입 + 항목 완료 + 회차 완료. 리뷰 시도는 회차 소유자 및 question_id가 일치해야 함. 동시 제출은 행 잠금 등으로 차단한다.

### 17. `daily_reviews`
- `id UUID PK`, `user_id UUID NOT NULL FK auth.users`, `review_date DATE NOT NULL`, `content TEXT NOT NULL`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- `UNIQUE(user_id,review_date)`; trim 후 공백 금지. 일기 텍스트만 저장.

## 7.2 무결성·인덱스·사용자 권한

- 모든 개인 public 테이블 **RLS ON**, 필요한 최소 GRANT, 사용자 소유 검증. SELECT/INSERT/UPDATE/DELETE 별 정책; UPDATE는 USING + WITH CHECK. 사용자 ID 클라이언트로부터 신뢰하지 않음.
- `weekly_review_items`처럼 user_id 없는 개인 자식은 상위 `weekly_reviews`의 소유권을 기준으로 보호.
- 공통 한자 사전은 일반 사용자 쓰기 금지. `quiz_questions` 원본은 정답이 포함되어 직접 읽기 제한. 서비스 권한 키는 절대 브라우저/공개 GitHub에 노출 금지.
- 가입 프로필 및 기본 카테고리 **DB 트리거**. 안전한 함수 실행 권한, search_path, 중복 호출 방지, 실패 시 회원가입 영향 테스트.
- 인덱스 예시: `entries(user_id,record_date)`, `transactions(user_id,transaction_date)`, `transactions(user_id,category_id,transaction_date)`, `hanja_learning(user_id,learning_date)`, `quiz_attempts(user_id,attempted_at)`, `weekly_reviews(user_id,review_week)`. PK/UNIQUE와 중복 인덱스 피함.
- RLS·복합 FK·유형 체크는 SQL 적용 후 **두 사용자 계정으로 실제 테스트**. 스키마와 정책 변경은 migration으로 관리하고 실행 전 승인 요청.

## 7.3 원자적 작업 구현 및 함수 보안 (개발 전 확정)

- 여러 DB 작업이 함께 성공하거나 함께 실패해야 하는 경우 **PostgreSQL 트랜잭션 안에서 실행되는 함수/서버 작업**을 이용한다. `supabase-js`의 개별 쿼리 여러 개를 순서대로 호출하는 것만으로는 단일 트랜잭션이 되지 않는다.
- 필수 원자적 처리: (1) 오늘의 신규 한자 후보 선택·배정 및 동시 요청 방지, (2) 퀴즈의 비공개 정답 조회·서버 채점·시도 저장, (3) 복습 풀이 저장·항목 완료·회차 상태 전환. 가입 초기화는 auth.users 생성 트리거 안에서 원자적으로 처리한다.
- **모든 DB 함수를 일괄 `SECURITY DEFINER`로 만들지 않는다.** 기본값은 `SECURITY INVOKER`이며 필요한 경우에만 최소 권한의 `SECURITY DEFINER`를 사용한다.
- 정답 원본 접근이 필요한 채점처럼 권한 상승이 불가피하면, 안전한 비노출(private) 스키마의 `SECURITY DEFINER` 함수 또는 접근 통제가 확실한 서버 전용 경로를 채택한다. `SECURITY DEFINER` 함수는 `SET search_path = ''`와 명시적 스키마명을 사용하고, `EXECUTE` 권한을 `PUBLIC`/`anon`에서 회수한 뒤 필요한 역할에만 부여한다. `auth.uid()`로 인증 사용자와 입력 행 소유권을 함수 안에서 직접 검증하며, 클라이언트의 user_id·is_correct·attempted_at 값은 신뢰하지 않는다.
- private 함수를 직접 호출할 수 없는 환경에서는 공개 Data API에 특권 함수를 무심코 노출하지 말고, **검증된 Next.js Route Handler → 제한된 서버 전용 DB 호출** 또는 감사된 invoker 래퍼를 설계한다. 서비스 역할 키는 서버에서만 보관하고 키 보유 자체를 권한 검사 대체 수단으로 취급하지 않는다.
- DB 함수 배포 전 SQL 권한·RLS·중복 제출·동시 요청·다른 사용자 접근을 테스트한다. 필요한 기술적 접근 경로는 에이전트가 SQL 변경 전에 제안·보고하고 승인받는다.

# 8. API 계약

## 8.1 API 공통 원칙

- 모든 개인 API는 서버에서 인증과 사용자 소유권을 검증하며 JSON으로 응답한다.
- GET은 읽기 전용, POST는 생성/제출, PATCH는 부분 수정, PUT은 지정 자원 저장(UPSERT), DELETE는 삭제이다.
- SQL 트랜잭션이 필요한 경로는 7.3의 안전한 PostgreSQL 함수/서버 작업으로 구현한다.

- Next.js App Router Route Handlers, JSON.
- 성공: `{ "success": true, "data": ... }` ; 에러: `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- 코드: `200` 조회/수정, `201` 생성, `204` 삭제 (본문 없음), `400` 유효성 오류, `401` 로그인 필요, `403` 금지, `404` 없음/접근 불가, `409` 중복·상태 충돌, `500` 서버 오류.
- 개인 데이터는 검증된 로그인 사용자의 행만 처리. 목록은 `page`,`limit` (서버 최대치), 안정적인 정렬, 빈 목록과 DB 오류 구분.
- 날짜 DATE `YYYY-MM-DD`, 월 `YYYY-MM`, 시각 TIMESTAMPTZ (한국 날짜 변환).

## 8.2 인증: Supabase Auth SDK

- `signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser`.
- 별도 자체 비밀번호 DB/API 만들지 않음. 닉네임 profiles.

## 8.3 할 일·메모 API

| HTTP | 경로 | 목적 |
|---|---|---|
| GET | `/api/entries` | 목록: `type,category_id,status,date,due,search,page,limit` |
| POST | `/api/entries` | 등록 |
| GET | `/api/entries/{id}` | 상세 |
| PATCH | `/api/entries/{id}` | 수정·완료 처리 |
| DELETE | `/api/entries/{id}` | 삭제 |

등록 요청 예시:
```json
{"type":"todo","category_id":"<uuid>","record_date":"2026-11-03","due_date":"2026-11-04","title":"장보기","content":"우유와 계란"}
```
서버가 user_id 결정. todo 기본 false, memo NULL. 카테고리 같은 사용자, 제목 공백 금지. PATCH 예: `{"is_completed":true}`. 홈은 별도 대시보드 API에서 오늘+이전 미완료 목록 집계.

## 8.4 할 일·메모 카테고리

| HTTP | 경로 |
|---|---|
| GET/POST | `/api/entry-categories` |
| PATCH/DELETE | `/api/entry-categories/{id}` |

등록: `{"name":"공부"}`; 사용자당 중복 금지, 참조 중 삭제 409.

## 8.5 표준 응답·검증

- 성공: `{ "success": true, "data": ... }`; 오류: `{ "success": false, "error": { "code": "...", "message": "..." } }`.
- 삭제 성공 204는 본문 없음. 입력 누락 400, 미인증 401, 접근 불가 403/404, 중복·상태 충돌 409, 내부 오류 500.
- `page`, `limit`의 최대값, 날짜·UUID 형식, 금액 범위, 안정적인 정렬, 빈 목록과 서버 오류 구분을 통일한다.

## 8.6 인증·권한

- Supabase Auth로 검증된 사용자 ID만 사용한다. RLS와 SQL GRANT 권한을 함께 적용한다.
- 서버 내부 권한 상승 및 `SECURITY DEFINER`의 사용은 7.3을 따른다.
- 클라이언트가 `is_correct`, 다른 사용자의 `user_id`, 퀴즈의 정답 원본을 조작하지 못하게 한다.

## 8.7 공통 통합 테스트

- 서로 다른 두 계정의 조회·등록·수정·삭제 권한을 테스트한다.
- 동일 요청 재시도·동시 요청·삭제 제한·로그아웃 후 접근 차단을 시험한다.
- 로컬과 배포 URL에서 데이터 지속성과 인증 세션을 검증한다.

## 8.8 가계부 카테고리와 거래

| HTTP | 경로 | 목적 |
|---|---|---|
| GET/POST | `/api/transaction-categories` | 분류 목록(`type` 필터)/등록 |
| PATCH/DELETE | `/api/transaction-categories/{id}` | 분류 수정/삭제 |
| GET/POST | `/api/transactions` | 거래 목록/등록 |
| GET/PATCH/DELETE | `/api/transactions/{id}` | 상세/수정/삭제 |
| GET | `/api/transactions/summary` | 기간별 전체 수입·지출 합계 |

거래 등록:
```json
{"type":"expense","category_id":"<uuid>","transaction_date":"2026-11-03","name":"점심","amount":12000,"memo":"식당"}
```
목록: `period=day|week|month&date=YYYY-MM-DD&type=all|income|expense&category_id=...&search=...&page=1&limit=20`. 주는 월~일. **거래 또는 분류 예산에서 사용 중인 transaction_categories 분류 삭제는 409**. 요약 `GET /api/transactions/summary?period=month&date=2026-11-03` 응답 `total_income,total_expense,balance,start_date,end_date`. 목록 유형 필터에 영향 받지 않는 전체 기간 합계.

## 8.9 예산

| HTTP | 경로 |
|---|---|
| GET | `/api/budgets?month=YYYY-MM` |
| PUT/DELETE | `/api/budgets/{month}` |
| PUT/DELETE | `/api/budgets/{month}/categories/{category_id}` |
| GET | `/api/budgets/{month}/summary` |

전체/분류별 저장 요청: `{"amount":1000000}`. PUT 기존 있으면 200, 없으면 201. 분류별 예산 전 전체 예산 필수. summary는 전체 `overall` 및 `categories[]`, 각각 `budget,spent,remaining,usage_rate,status`. 미설정 사용률 `null`.

## 8.10 한자·퀴즈

| HTTP | 경로 | 목적 |
|---|---|---|
| GET | `/api/hanja/today` | 오늘 배정 조회만, 없으면 data:null |
| POST | `/api/hanja/today/assign` | 중복 없는 오늘 한자 배정, 재요청 시 기존 결과 |
| PATCH | `/api/hanja/learning/{id}` | `{"status":"studying"}` 또는 `{"status":"completed"}` |
| GET | `/api/hanja/{id}` | 음·뜻·설명·단어·예문 |
| GET | `/api/hanja/quizzes/today` | 오늘 학습 문제와 보기(정답·해설 제외) |
| POST | `/api/hanja/quizzes/attempts` | 서버 채점 및 시도 저장 |
| GET | `/api/hanja/quizzes/attempts` | 개인 풀이 기록 |
| GET | `/api/hanja/progress` | 배정/완료/시도/정답률 통계 |

배정 응답 주요 필드: `learning_id,learning_date,status,character:{id,character,reading,meaning},is_new_assignment`. 한자 10개 모두 배정되면 소진 안내 및 오류 상태(추가 신규 없음).

퀴즈 조회는 **초기 한자당 한 문제**를 반환한다. 동일 한자에 여러 문제가 등록되기 전까지 추가 출제 선택 규칙은 적용하지 않는다.

퀴즈 조회 예:
```json
{"success":true,"data":{"question_id":"<uuid>","question_type":"reading","question":"學의 음은 무엇인가요?","options":[{"id":"A","text":"교"},{"id":"B","text":"문"},{"id":"C","text":"학"},{"id":"D","text":"습"}]}}
```
제출 요청:
```json
{"question_id":"<uuid>","selected_option_id":"C","request_id":"<uuid>"}
```
제출 후 응답: `attempt_id,is_correct,selected_option_id,correct_option_id,correct_answer,explanation`. **제출은 request_id 필수, 서버에서 채점**, 같은 request_id 재시도는 같은 결과, 새로운 request_id라면 동일 문제 재응시 허용.

## 8.11 월요일 오답 복습

| HTTP | 경로 | 목적 |
|---|---|---|
| GET | `/api/hanja/reviews` | 내 복습 회차 목록 |
| POST | `/api/hanja/reviews/prepare` | 종료된 주 중 누락 회차 생성, 기존 재사용 |
| GET | `/api/hanja/reviews/{id}` | 미완료 문제 보기(정답 제외), 완료 항목 결과 및 진행률 |
| POST | `/api/hanja/reviews/{id}/items/{item_id}/answer` | `{"selected_option_id":"C"}`, 채점·완료 원자적 처리. 동일 항목·답안 재시도는 기존 결과 반환 |
| GET | `/api/hanja/reviews/{id}/summary` | `total_questions,completed_questions,correct_count,incorrect_count,accuracy_rate,status` |

복습 준비 응답: `review_id,review_week,source_start_date,source_end_date,total_questions,completed_questions,status,is_new`. 문제 0개면 completed, 정답률 null. 복습 항목 첫 정상 제출만 허용; **같은 항목·같은 선택지로 재전송하면 기존 결과를 반환**하고 새 풀이 기록은 생성하지 않는다. 완료 항목에 다른 선택지로 제출하면 409. 지난주 시드 데이터로 테스트.

## 8.12 하루 마무리·홈

| HTTP | 경로 | 목적 |
|---|---|---|
| GET | `/api/daily-summary?date=YYYY-MM-DD` | 해당 날짜의 todos/memos/finance/hanja·퀴즈 결과 통합 조회 |
| GET | `/api/daily-reviews?date=YYYY-MM-DD` | 날짜별 일기, 없으면 data:null |
| PUT | `/api/daily-reviews` | `{"review_date":"2026-11-03","content":"..."}` UPSERT |
| DELETE | `/api/daily-reviews?date=YYYY-MM-DD` | 일기만 삭제 |
| GET | `/api/dashboard` | 오늘 + 이전 미완료 todo, 가계부 현황, 한자·복습·일기 작성 상태 |

`GET /api/dashboard` 및 `GET /api/daily-summary`는 **읽기 전용**. GET으로 한자 신규 배정/주간 복습 생성 금지.

# 9. 검증·배포·README

## 9.1 테스트 관문

- 회원 A/B로 다른 사람의 개인 레코드 조회·변경·삭제 차단. 분류·예산·복습/퀴즈 관계도 소유권 검사.
- Todo/memo CRUD·완료·검색·카테고리 재사용, 재로그인 후 유지.
- 수입/지출 CRUD·일/주/월 합계·유형 불일치 차단.
- 예산 계산 및 80%, 100%, >100% 경계·삭제 시 원본 거래 보존.
- 한자 하루 1개·재방문 동일·중복 배정 금지·10개 소진 처리·상태 전환.
- 퀴즈 4보기·정답 사전 비공개·서버 채점·반복 응시·request_id 중복 방지.
- 지난주 시드 오답으로 복습 회차 생성·문제 ID 중복 제거·미접속 회차 복구·동시 제출 차단·완료 상태.
- 하루 마무리 날짜별 조회, 일기 사용자별 날짜 1건 UPSERT 및 삭제, 홈 GET 조회 전용.
- 로컬 및 Vercel 배포 URL에서 핵심 동작, 빌드, 환경변수, 인증 URL 확인. 비밀번호 재설정 화면 존재와 복구 세션/리다이렉트 검증; SMTP 미설정 시 외부 수신 불가를 README 제한 사항에 표시.

## 9.2 단계별 배포

1. 기본 화면 GitHub 푸시 후 **Vercel 최초 배포**. 배포 URL과 빌드 확인.
2. Supabase Auth, PostgreSQL 테이블 및 RLS를 검토된 SQL 마이그레이션으로 적용. SQL 적용 전 사용자 승인.
3. 기능별 구현 후 테스트, GitHub 푸시 및 Vercel 재배포.
4. 실패 시 마지막 정상 배포 보전, 오류 수정, 재검증.

## 9.3 인증 및 README

- Supabase **Confirm Email**: 실험·평가 환경에서 비활성화. 실제 운영 전 보안 재검토.
- Supabase **Site URL**: Vercel 프로덕션 URL로 변경. Redirect URLs에 필요한 경로 추가, 비밀번호 재설정/리다이렉트 별도 검증.
- README: 서비스 소개, 구현 기능/개발 중 기능 구분, 기술 스택, GitHub·배포 URL, 로그인 방법, 평가자용 **직접 회원가입(이메일 확인 없음)** 안내, 데모 절차, 제한 사항, 후속 계획. **기본 SMTP를 사용할 때 프로젝트 팀원 외 이메일로 재설정 메일 발송이 제한된다는 점**을 구현 상태에 따라 명시한다. 외부 메일 발송이 필수라면 사용자 승인 후 커스텀 SMTP를 설정한다.
- 공개 저장소에 데모 비밀번호, 비밀 키, `.env.local` 업로드 금지. `NEXT_PUBLIC_`에는 공개해도 되는 키만 사용. 서비스 역할 키는 서버 전용으로만 보관.
- 과제 제출은 요구된 GitHub URL과 Vercel URL을 제공. 실제 제출 폼 항목은 사용자 제공 지침과 대조.

## 9.4 개발 중단 기준

- **2026-11-04 15:00 KST 이후**: 새 기능보다 오류 수정, 빌드/DB 연결/배포 안정화, README와 시연 준비를 우선한다. 전체 기능 개발 목표 자체는 삭제하지 않는다.

## 9.5 개발 완료 정의

작동하는 UI뿐 아니라 실제 API·DB CRUD, RLS 권한, 브라우저 새로고침 후 유지, 배포 URL 실동작을 확인해야 완료로 판단한다. 구현하지 못한 사항은 README에 솔직히 표시한다.

---

## 현재 미확정 항목 (에이전트가 임의로 최종 결정하지 말 것)

- 초기 한자 **정확한 10자 목록**과 각 항목의 검증된 학습 자료·퀴즈: 제안 후 승인받아 시드 생성.
- 실제 Supabase 프로젝트 URL/공개 키, GitHub 저장소 주소, Vercel 배포 URL: 프로젝트 생성·연결 후 확인.
- 비밀번호 재설정 메일의 외부 수신은 커스텀 SMTP 설정 전에는 보장하지 않는다. 관련 화면/코드는 구현하되 README에 제한사항을 구분한다.
- 평가용 데모 계정: 선택 사항이며 공개 비밀번호는 두지 않는다.
- 배포 중단/일정 변경은 사용자 최종 판단.


---

## v1.3 정정 이력 (2026-11-03)

1. 홈 todo 조회 집합은 오늘 날짜 완료·미완료 전체와 이전 미완료를 포함. 현재 완료 건수는 오늘 record_date 기준으로만 계산.
2. 이메일 재설정 수신 제약 확인; 새 비밀번호 설정 화면 및 README 제한사항 추가.
3. PostgreSQL 원자적 처리와 최소 권한 원칙 추가. SECURITY DEFINER를 무조건 사용하지 않음.
4. 한자 10자에는 각각 정확히 한 문제를 최초 준비.
5. 첫 학습 날짜는 `MIN(hanja_learning.learning_date)`.
6. 복습 동일 항목·동일 선택지 재전송은 기존 결과 반환, 다른 선택지는 409.
7. 거래/예산에서 참조하는 분류의 삭제 금지.
8. 분류별 예산은 `category_type='expense'`와 복합 FK로 DB에서 강제.
9. '이메일 인증 계정 관리'를 '이메일·비밀번호 계정 관리'로 변경.
10. 누락된 8.1, 8.5~8.7 절 보완. 기존 마크다운 표 형식을 유지.

---

## v1.4 추가 확정 규칙 (2026-11-03~04, 구현 중 사용자 확정)

v1.3 본문 이후 개발하면서 사용자가 확정한 규칙이다. **본문과 다른 내용은 이 절이 우선한다.**

### A. 운영·보안 규칙

1. 비밀 키와 데이터베이스 비밀번호는 소스 코드나 GitHub에 올리지 않는다. `.env.local`은 커밋하지 않으며, 브라우저(`NEXT_PUBLIC_`)에는 Supabase URL과 공개(publishable) 키만 둔다. `service_role`/`sb_secret_` 키는 쓰지 않는다.
2. 테스트 계정에는 가상 데이터만 사용하고, 테스트용 이메일·비밀번호는 공개 GitHub나 README에 기록하지 않는다.
3. DB 변경은 `supabase/migrations`의 마이그레이션 파일로 관리한다. 적용 전 대상 프로젝트·파일·영향을 보고하고 승인을 받는다(계정 생성, GitHub·Vercel 외부 변경도 같음).
4. 새 Supabase 프로젝트를 만들거나 기존 프로젝트를 삭제하지 않는다. 사용 프로젝트는 `haru-board` 하나다.
5. 기존 코드와 커밋을 보존한다. `AGENTS.md`의 한국어 번역은 덮어쓰지 않는다(개발 서버 `next dev`는 사용자가 직접 실행).
6. GitHub 푸시는 커밋마다 사용자 승인 후 한다. 푸시하면 Vercel이 자동 배포하며, 배포 URL에서 테스트를 다시 실행한다.
7. 커밋 작성자 이메일은 GitHub noreply 주소를 사용한다(개인 이메일 비공개).
8. 0장 8항의 기능 추가 중단 시점(2026-11-04 15:00)은 사용자가 해제했다(2026-11-03, 할 일 화면 개편 요청 시).
9. **데모 계정 공개(2026-11-04 사용자 결정)**: 데모 계정 `aaa@aaa.com`의 이메일·비밀번호를 README에 공개해 누구나 채워진 화면을 확인할 수 있게 한다. 0장 5항, 4.1, 9.3, '현재 미확정 항목'의 '공개 README에 데모 비밀번호를 적지 않는다'는 이 결정으로 대체한다. 데모 계정에는 가상 데이터만 둔다. 테스트 계정 A/B의 정보는 계속 공개하지 않는다.
10. **샘플 계정 보기 전용(2026-11-04 사용자 결정)**: 공개한 데모 계정은 DB가 보기 전용으로 강제한다(C-8). 이 계정에서는 데이터 추가·수정·삭제와 비밀번호·이메일 변경이 거부된다. 해제는 관리자가 SQL로만 한다.

### B. 해소된 미확정 항목

| 항목 | 확정 내용 |
|---|---|
| 초기 한자 10자 | 천자문 첫 10자 `天地玄黃 宇宙洪荒 日月` (2026-11-03 승인) |
| 한자 추가 | 천자문 11~110번째 100자 추가(110자) 후, 같은 날 **3,000자**로 확장 (2026-11-04). 0장 4항·4.5의 '10자만'은 이 결정으로 대체 |
| 저장소·배포·DB | GitHub `nihao72-netizen/haru-board`(master), Vercel `https://haru-board-navy.vercel.app`, Supabase 프로젝트 `haru-board` |
| 데모 계정 | `aaa@aaa.com` 계정과 비밀번호를 README에 공개(A-9, 2026-11-04 변경). 직접 가입도 계속 가능 |

### C. 기능 규칙

1. **주간 복습 상태**: 첫 항목을 제출한 뒤 미완료 항목이 남으면 `in_progress`, 마지막 항목을 제출하면 바로 `completed`. (4.7 보완)
2. **오늘의 퀴즈**: 오늘 배정된 한자만 대상이다. 오늘 배정이 없으면 `/api/hanja/quizzes/today`는 `data: null`. (4.6 보완)
3. **한자 3,000자** (2026-11-04 확장): `sort_order` 1~3,000 순서로 하루 한 글자 배정. 천자문 1,000자 → 한문 교육용 기초 한자 중 나머지 1,031자 → 자주 쓰이는 한자 969자. 한자마다 4지선다 문제 정확히 1개. 대표 단어·예문은 처음 110자만. 훈은 위키낱말사전(CC BY-SA), 음은 Unicode Unihan으로 검증. 모두 배정되면 신규 배정 없음 안내. (4.5, 4.6 대체)
4. **할 일 화면 개편(Todoist형)**: 사용자 명세서(UI·기능 명세서) MVP + 월간 캘린더. (4.2 확장)
   - `entries` 추가 열: `scheduled_time`(시각), `priority`(1~4, 1이 가장 높음, 기본 4), `remind_at`(미리 알림), `parent_id`(하위 작업).
   - 하위 작업은 한 단계만, 같은 사용자의 할 일만 부모가 될 수 있고, 부모를 삭제하면 함께 삭제된다. 메모는 하위 작업이 될 수 없다.
   - 명세서 용어 대응: '날짜' = `record_date`(+`scheduled_time`), '프로젝트(#)' = 기존 분류, '설명' = `content`, `due_date`는 '마감일'로 유지.
   - 빠른 추가: 입력 문장에서 날짜·시각·우선순위(p1~p4)·#분류를 해석해 칩으로 보여 준다(한글 조합 중 Enter는 제출하지 않음).
   - 보기: 오늘 / 다음(빈 날짜 포함 21일) / 캘린더(월간) / 분류별 / 전체 기록·메모. 보기와 열린 작업은 주소에 유지.
   - '오늘' 보기는 **오늘 해야 할 일 → 기한 지난 일 → 남은 일(내일 이후)** 순서. 기한 지난 일·남은 일은 처음 5개만 보이고 '더 보기'.
   - 완료 시 실행 취소 토스트. 미리 알림은 화면이 열려 있을 때만 브라우저 알림·배너로 표시(서버 푸시 없음).
5. **홈 할 일 카드**: **한 일**(최근 완료순)·**오늘 할 일**(시간순)·**해야 될 일**(기한 지남 + 내일 이후, 오늘과 가까운 날짜순) 세 칸, 칸마다 최대 5개와 '전체 보기'. 하위 작업은 제외. (4.9 첫 항목 대체)
6. **일기 제목·목록·잠금**: (4.8, 7.1-17 보완)
   - `daily_reviews.title` 추가(선택, 1~100자). 기존 일기는 제목 없음.
   - 일기 본문(`content`)은 사용자가 직접 SELECT할 수 없다. 본문은 `read_diary` 함수로만 읽으며, 로그인 토큰(JWT `amr`)의 비밀번호 확인 시각이 **10분 이내**일 때만 반환한다(아니면 403 `REAUTH_REQUIRED`).
   - 화면: 이미 쓴 일기는 잠긴 상태로 제목만 보이고, 로그인 비밀번호를 한 번 더 입력해야 본문이 열린다. 확인 후 10분 동안 유지, '잠그기'로 즉시 잠금.
   - '내 일기' 목록: 날짜·제목만 최근순으로 보여 주고, 고르면 그 날짜로 이동해 비밀번호를 묻는다.
7. **하루 마무리 화면 배치**: 홈처럼 왼쪽(넓게) 자유 일기·내 일기 목록, 오른쪽 할 일·메모·가계부·한자·퀴즈. 좁은 화면에서는 일기 → 목록 → 기록 순. (5장 보완)
8. **샘플 확인(보기 전용)**: 소개 화면과 로그인 화면의 '샘플 확인' 버튼으로 가입 없이 샘플 계정에 들어간다. 모든 화면 위에 '샘플 보기 중' 안내 띠와 '내 계정 만들고 시작하기'(로그아웃 후 회원가입)를 보인다. 쓰기 시도는 "샘플 계정은 보기만 할 수 있어요" 안내로 거부(DB 트리거, HB403). 일기 비밀번호 확인 창은 샘플 비밀번호를 미리 채운다. 샘플 계정은 비밀번호 변경 화면 대신 안내를 보인다.
9. **디자인 체계**: 사용자 디자인 명세(Clean Minimal + Soft Emotional)의 색·글꼴(Pretendard)·모서리·그림자·초점·움직임 토큰을 전 화면에 적용. 로그인 전 홈은 소개 화면(히어로·기능 카드·데모 목록·마지막 안내). '오늘의 할 일'에 진행률(숫자+막대).

### D. 마이그레이션 이력

| 순서 | 파일 | 내용 |
|---|---|---|
| 1 | `20261103120000_init_schema.sql` | 17개 테이블, 제약, 트리거, 인덱스, RLS, 열 단위 권한 |
| 2 | `20261103120100_atomic_functions.sql` | 원자적 처리 함수(`app_private` DEFINER + 공개 INVOKER 래퍼) |
| 3 | `20261103120200_seed_hanja_initial_10.sql` | 초기 한자 10자·단어·예문·문제 |
| 4 | `20261103130000_entries_time_priority_reminder_subtask.sql` | 할 일 시각·우선순위·미리 알림·하위 작업 |
| 5 | `20261104120000_seed_hanja_chars_11_110.sql` | 천자문 11~110번째 한자 100자 |
| 6 | `20261104130000_daily_reviews_title_locked_content.sql` | 일기 제목, 본문 직접 조회 차단, `read_diary` |
| 7 | `20261104140000_read_only_sample_account.sql` | 보기 전용 샘플 계정(쓰기·비밀번호·이메일 변경 차단) |
| 8 | `20261104150000_seed_hanja_chars_111_3000.sql` | 한자 111~3,000번째 2,890자와 문제 |
