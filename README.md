# 하루정리 (Haru Board)

할 일·메모, 가계부·예산, 매일 한자 한 글자와 퀴즈·주간 오답 복습, 하루 마무리 일기를 한곳에서 관리하는 개인용 반응형 웹 대시보드입니다.

- **배포 주소:** <https://haru-board-navy.vercel.app>
- **GitHub:** <https://github.com/nihao72-netizen/haru-board>
- **요구사항 문서:** [PRD.md](PRD.md) (v1.3)

## 바로 사용해 보기 (평가자 안내)

1. 배포 주소에서 **회원가입**을 누르고 이메일·비밀번호(닉네임은 선택)를 입력합니다.
   - 평가 편의를 위해 **이메일 확인 절차 없이 바로 가입·로그인**됩니다. 실제로 받지 않는 이메일 주소를 써도 됩니다.
   - 공개 저장소이므로 데모 계정이나 비밀번호는 따로 제공하지 않습니다. 직접 가입해 주세요.
2. 가입하면 기본 분류가 자동으로 만들어집니다.
   - 기록 분류: 공부, 업무, 일상
   - 지출 분류: 식비, 교통, 쇼핑, 생활, 문화
   - 수입 분류: 급여, 부수입, 용돈
3. 아래 순서로 둘러보면 전체 흐름을 볼 수 있습니다.

| 순서 | 화면 | 해 볼 것 |
|---|---|---|
| 1 | 홈 `/` | 오늘 할 일 빠른 추가, 체크로 완료, 가계부·한자·일기 요약 카드 확인 |
| 2 | 할 일 `/todos` | 할 일·메모 작성, 분류 관리, 검색·필터, 수정·삭제 |
| 3 | 가계부 `/ledger` | 수입·지출 입력('기타'로 새 분류 만들기), 일/주/월 이동과 합계 |
| 4 | 가계부 › 통계·예산 탭 | 월 전체 예산과 분류별 예산 설정, 사용률·경고, 월별·분류별 지출 그래프 |
| 5 | 한자 `/hanja` | '오늘의 한자 받기' → 학습 시작 → 학습 완료, 오늘의 퀴즈 풀기(반복 가능) |
| 6 | 하루 마무리 `/daily` | 날짜별 기록 모아 보기, 자유 일기 저장·수정·삭제 |
| 7 | 내 계정 `/account` | 닉네임 변경, 로그아웃 |

> 월요일 오답 복습은 **지난주에 틀린 문제**로 만들어집니다. 새 계정은 지난주 기록이 없으므로 처음에는 "아직 복습 회차가 없습니다"로 보입니다. 개발 중에는 관리자용 테스트 시드로 검증했습니다(아래 '검증' 참고).

## 구현 상태

### 구현 완료

| 기능 | 내용 |
|---|---|
| 인증 | 회원가입(닉네임 선택), 로그인, 로그아웃, 비밀번호 재설정 요청·새 비밀번호 설정 화면, 로그인하지 않으면 개인 화면 접근 차단 |
| 할 일·메모 | 작성·조회·수정·삭제, 할 일 완료 체크, 분류 추가·이름 변경·삭제(사용 중이면 삭제 불가), 날짜·유형·완료·마감·검색 필터 |
| 가계부 | 수입·지출 작성·조회·수정·삭제, 수입/지출 분류 구분과 새 분류 재사용, 일/주(월~일)/월 목록과 총수입·총지출·차액 |
| 예산·통계 | 월 전체 예산, 지출 분류별 예산, 사용률과 상태(정상 / 주의 80%↑ / 한도 도달 100% / 초과), 최근 6개월 지출 비교, 전월 대비 증감(전월 지출 0이면 비교 불가), 분류별 지출 |
| 한자 | 서울 날짜 기준 하루 한 글자 배정(재접속해도 같은 글자, 중복 배정 없음, 10자 소진 안내), 학습 상태(배정 → 학습 중 → 완료), 음·뜻·구성 설명·난이도·관련 단어·예문, 진행 현황 |
| 퀴즈 | 오늘 한자의 4지선다 문제, 정답은 서버만 보관·채점, 반복 풀이, 같은 요청의 재전송 중복 방지(`request_id`), 풀이 기록 |
| 주간 오답 복습 | 끝난 주의 오답을 모아 다음 주 월요일 회차 생성(빠진 과거 회차도 생성), 문제 중복 제거, 한 문제 한 번 제출, 진행률·정답률 |
| 하루 마무리 | 날짜를 골라 할 일 → 메모 → 가계부 → 한자·퀴즈를 원본에서 모아 보기, 날짜별 자유 일기 저장·수정·삭제 |
| 홈 | 오늘 할 일과 이전 미완료(가장 큰 영역), 빠른 추가, 오늘 완료 목록 접기, 가계부·예산·한자·복습·일기 요약 카드 |

### 개발하지 않은 것 / 후속 계획

- 한자는 **천자문 첫 10자**(天地玄黃 宇宙洪荒 日月)만 준비했습니다. DB와 API는 약 3,000자로 늘릴 수 있게 설계했습니다.
- 퀴즈는 한자당 1문제이고 보기 순서는 고정입니다. 여러 문제와 보기 섞기는 후속 과제입니다.
- 복습에서 다시 틀린 문제를 다음 주로 자동으로 넘기는 기능은 없습니다(PRD상 후속 확장).
- 할 일의 '완료한 시각' 이력은 저장하지 않습니다. 과거 날짜를 봐도 현재 완료 상태가 표시됩니다.
- 커스텀 SMTP(외부 이메일 발송), 다크 모드, 데이터 내보내기는 구현하지 않았습니다.

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프런트엔드·API | Next.js 16 (App Router, Route Handlers), React 19, TypeScript, Tailwind CSS 4 |
| 인증·DB | Supabase Auth, PostgreSQL (RLS), `@supabase/ssr`, `@supabase/supabase-js` |
| 배포 | Vercel (GitHub `master` 푸시 시 자동 배포), Supabase (Sydney 리전) |

## 구조와 보안 설계

- **DB 17개 테이블, 모두 RLS 사용.** 기본 권한을 회수한 뒤 필요한 열에만 권한을 줍니다. 예를 들어 퀴즈 문제 테이블은 정답·해설 열을 사용자가 읽을 수 없습니다.
- **소유권은 DB가 강제합니다.**
  - 거래와 분류는 `(user_id, category_id, type)` 복합 FK로 묶어, 다른 사람의 분류나 유형이 다른 분류를 쓸 수 없습니다.
  - 분류별 예산은 지출 분류만 허용합니다(`category_type='expense'` + 복합 FK).
  - 거래나 예산이 사용 중인 분류는 삭제할 수 없습니다(409).
- **여러 단계를 한 번에 처리해야 하는 작업은 PostgreSQL 함수 안에서 한 트랜잭션으로 처리합니다.**
  - 대상: 오늘의 한자 배정, 퀴즈 채점·기록, 복습 회차 생성, 복습 제출·완료 처리
  - 권한이 필요한 함수는 외부에 노출되지 않는 `app_private` 스키마에 `SECURITY DEFINER`로 둡니다. 공개 스키마에는 호출만 넘겨 주는 `SECURITY INVOKER` 래퍼만 둡니다.
  - 모든 함수는 `search_path=''`이고 실행 권한은 로그인 사용자에게만 있습니다. 함수 안에서 `auth.uid()`로 소유권을 다시 확인합니다.
  - 동시 요청은 advisory lock과 행 잠금으로 막습니다.
- **가입 시 프로필과 기본 분류는 DB 트리거가 만듭니다.**
- **API는 모두 서버에서 로그인 사용자를 확인합니다.** 응답 형식은 `{ success, data }` / `{ success, error: { code, message } }`로 통일했습니다.
- 브라우저에는 Supabase URL과 공개(publishable) 키만 전달합니다. 서비스 역할 키는 쓰지 않습니다.

DB 변경은 모두 [supabase/migrations](supabase/migrations)의 마이그레이션 파일로 관리합니다.

| 파일 | 내용 |
|---|---|
| `20261103120000_init_schema.sql` | 테이블, 제약, 트리거, 인덱스, RLS, 권한 |
| `20261103120100_atomic_functions.sql` | 원자적 처리 함수와 래퍼 |
| `20261103120200_seed_hanja_initial_10.sql` | 초기 한자 10자, 단어, 예문, 문제 (다시 실행해도 중복되지 않음) |

## 주요 API

| 영역 | 경로 |
|---|---|
| 할 일·메모 | `/api/entries`, `/api/entries/{id}`, `/api/entry-categories`, `/api/entry-categories/{id}` |
| 가계부 | `/api/transactions`, `/api/transactions/{id}`, `/api/transactions/summary`, `/api/transactions/stats`, `/api/transaction-categories`, `/api/transaction-categories/{id}` |
| 예산 | `/api/budgets`, `/api/budgets/{month}`, `/api/budgets/{month}/categories/{category_id}`, `/api/budgets/{month}/summary` |
| 한자 | `/api/hanja/today`, `/api/hanja/today/assign`, `/api/hanja/learning`, `/api/hanja/learning/{id}`, `/api/hanja/{id}`, `/api/hanja/progress` |
| 퀴즈 | `/api/hanja/quizzes/today`, `/api/hanja/quizzes/attempts` |
| 복습 | `/api/hanja/reviews`, `/api/hanja/reviews/prepare`, `/api/hanja/reviews/{id}`, `/api/hanja/reviews/{id}/items/{item_id}/answer`, `/api/hanja/reviews/{id}/summary` |
| 하루 마무리·홈 | `/api/daily-summary`, `/api/daily-reviews`, `/api/dashboard` (홈과 하루 요약 GET은 조회만 하며 한자 배정·복습 생성을 하지 않음) |

자세한 요청·응답 규칙은 [PRD.md](PRD.md) 8장을 따릅니다. PRD 표에 없는 `/api/hanja/learning`(지난 한자 목록)과 `/api/transactions/stats`(통계 탭)는 화면에 필요해서 추가했습니다.

## 검증

실제 Supabase DB에 테스트 계정 A·B 두 개를 만들어 API 단위로 확인했고, 주요 화면은 브라우저로 직접 확인했습니다. 테스트 계정 정보와 테스트 스크립트는 공개 저장소에 올리지 않았습니다.

| 영역 | 확인한 내용 | 결과 |
|---|---|---|
| DB 권한 | PGlite에 마이그레이션을 적용해 RLS, 열 권한, 함수 실행 권한, 우회 시도, `search_path` 가로채기를 확인 | 87개 통과 |
| 할 일·메모 | CRUD, 필터·검색, 분류 중복·사용 중 삭제, 다른 사용자 차단 | 39개 통과 |
| 가계부 | 금액 검증, 유형 불일치 차단, 주·월 경계, 합계와 필터 독립 | 43개 통과 |
| 예산·통계 | 79.998%=정상 / 80%=주의 / 100%=한도 도달 / 초과, 예산 삭제 시 거래 보존 | 62개 통과 |
| 한자 | 동시 배정 요청에도 1건, 상태 전환 순서, 직접 쓰기 차단 | 41개 통과 |
| 퀴즈 | 정답 비공개, 서버 채점, `request_id` 중복 방지(동시 요청 포함), 정답 열 직접 조회 차단 | 45개 통과 |
| 주간 복습 | 관리자 시드로 지난주 오답을 만든 뒤 회차 생성, 중복 제거, 주 경계, 원자적 제출, 동시 제출, 다른 사용자 차단 | 27개 통과 |
| 하루 마무리·홈 | 할 일 집합 규칙, GET 조회 전용, 일기 UPSERT·삭제, 사용자 분리 | 51개 통과 |

- 각 기능은 Vercel 배포 주소에서도 같은 테스트로 다시 확인했습니다.
- 주간 복습은 이미 푼 회차의 재전송·중복 처리만 배포 주소에서 확인했습니다. 첫 제출부터의 전체 흐름은 로컬 서버와 실제 DB로 확인했습니다.
- 복습 검증용 관리자 시드: [supabase/tests/weekly_review_test_seed.sql](supabase/tests/weekly_review_test_seed.sql)

## 제한 사항

- **비밀번호 재설정 메일:** Supabase 기본 SMTP를 사용합니다. 기본 SMTP는 프로젝트 팀원 이메일 외의 주소로는 메일을 보내지 않고, 발송 횟수 제한도 매우 낮습니다. 그래서 일반 사용자는 재설정 메일을 받지 못할 수 있습니다. 재설정 요청 화면과 메일 링크로 들어오는 새 비밀번호 설정 화면은 구현되어 있습니다. 외부 발송을 하려면 커스텀 SMTP 설정이 필요합니다.
- **이메일 확인 비활성화:** 평가 편의를 위해 Supabase의 Confirm Email을 꺼 두었습니다. 실제 운영 전에는 다시 켜야 합니다.
- **유출 비밀번호 검사:** Supabase Security Advisor에 'Leaked Password Protection 비활성' 경고 1건이 남아 있습니다. 현재 무료 플랜 프로젝트에서는 켜지 않은 상태입니다.
- **날짜 기준:** 모든 '오늘'과 주(월~일) 계산은 한국 시간(Asia/Seoul) 기준입니다.
- **복습 회차 생성 시점:** 회차는 한자 화면에 들어갈 때 만들어집니다. 홈 화면은 조회만 하므로 미완료 복습 수에는 이미 만들어진 회차만 포함됩니다.

## 로컬에서 실행하기

```bash
npm install
cp .env.example .env.local   # Windows PowerShell: Copy-Item .env.example .env.local
npm run dev                   # http://localhost:3000
```

`.env.local`에는 Supabase 대시보드 → Project Settings → API의 값을 넣습니다.

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable 키>
```

- 공개(publishable) 키만 사용합니다. `service_role`·secret 키나 DB 비밀번호는 넣지 말고, `.env.local`은 커밋하지 않습니다(`.gitignore`에 포함).
- 새 Supabase 프로젝트에 DB를 만들려면 Supabase CLI로 연결한 뒤 마이그레이션을 적용합니다.

  ```bash
  npx supabase@2.58.5 login
  npx supabase@2.58.5 link --project-ref <project-ref>
  npx supabase@2.58.5 db push
  ```

- 평가용 환경과 같이 쓰려면 Supabase Auth 설정에서 Confirm Email을 끄고, Site URL과 Redirect URLs에 배포 주소와 `/auth/callback`을 등록합니다.

| 명령 | 용도 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm start` | 프로덕션 빌드와 실행 |
| `npm run lint` | ESLint |
