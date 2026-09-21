# CLAUDE.md

## 프로젝트 개요

이 저장소는 Washed 공용 세탁기·건조기 대기/배정 서비스 프로젝트다.

- 저장소: `JHee0209/Washed` (과거 `vibecoding2` 이름은 더 이상 기준으로 쓰지 않는다)
- GitHub 기본 브랜치는 `main`이지만, 팀의 실제 통합 브랜치는 `dev`다. 아래 규칙에서 "통합 브랜치"는 `dev`를 가리킨다.

작업 기준은 GitHub Issue와 `docs/` 문서다. 문서에 없는 정책은 임의로 만들지 말고 사용자에게 확인한다.

## 브랜치 및 Git 규칙

- `main`은 최종/Production용 브랜치다. 사용자의 명시적 요청 없이 `main` checkout, merge, push, PR base 변경 등을 하지 않는다.
- 현재 팀의 통합 브랜치는 `dev`다. `dev`에 직접 작업하거나 직접 push하지 않는다.
- `integration-total`은 과거 브랜치이며 더 이상 사용하지 않는다. 새 작업 브랜치의 base나 PR base로 쓰지 않는다.
- 모든 기능 작업은 Issue별 작업 브랜치에서 진행하며, 항상 **최신 `dev`에서 시작**한다.

  ```
  git status
  git switch dev
  git pull origin dev
  git switch -c <feature/fix/refactor/chore 브랜치>
  ```

  working tree가 dirty하면 임의로 `switch`/`pull`/`reset`/`restore`/`clean`을 하지 않고 먼저 사용자에게 알린다.
- 브랜치 이름은 가능하면 `feat|fix|refactor|chore/<issue-number>-<short-name>` 형식을 사용한다.
- feature/fix/refactor/chore 브랜치로만 push한다. `dev` 직접 push, `main` 직접 push, force push, `integration-total` 사용은 모두 금지한다.
- PR의 base 브랜치는 항상 `dev`로 한다.
- `git add .`를 사용하지 않는다. 커밋 대상 파일을 명시적으로 stage한다.
- `git reset --hard`, force push, 강제 rebase는 사용자가 명시적으로 요청하지 않는 한 금지한다.
- 기존 팀원의 커밋이나 브랜치를 임의로 삭제하지 않는다.
- merge conflict가 발생하면 ours/theirs 중 한쪽을 통째로 선택하지 말고 양쪽 변경 목적을 확인한 뒤 필요한 내용을 모두 보존한다.

## Merge 규칙

- PR merge는 **사용자의 명시적 승인 후에만** 수행한다.
- merge 전 반드시 확인한다: base가 `dev`인지, head가 의도한 브랜치인지, merge conflict 여부, GitHub Checks 통과 여부, 변경 파일이 해당 Issue 범위인지.
- 위 확인에서 이상이 발견되면(base가 `dev`가 아님, conflict 있음, checks 실패 등) 임의로 진행하지 말고 즉시 사용자에게 보고한다.
- merge 후에는 로컬 `dev`를 최신화한다.

  ```
  git switch dev
  git pull origin dev
  ```

## Issue close 규칙

GitHub 기본 브랜치가 `main`이므로, `dev` 대상 PR 본문의 `Close #NN`은 `dev`로 merge될 때 **자동으로 닫히지 않을 수 있다**.

- merge 전에 Issue를 수동으로 close하지 않는다.
- PR merge 후 Issue 상태를 확인한다.
- 자동으로 닫히지 않았고, 구현 완료가 확실하며 사용자가 승인한 경우에만 수동으로 close한다.

## Issue 작업 규칙

작업 시작 전 반드시 다음을 확인한다.

1. 현재 브랜치
2. `git status`
3. GitHub Issue 제목·본문·완료 조건
4. 관련 `docs/` 문서
5. 선행 Issue와 의존성
6. 기존 구현과 재사용 가능한 코드
7. 예상 수정 파일

Issue 범위 밖 기능을 임의로 선행 구현하지 않는다.

다른 Issue에 속한 기능이 필요하면:
- 현재 Issue에서 임시 구현하지 않는다.
- 의존성을 보고하고 사용자에게 확인한다.

이미 구현된 선행 기능은 다시 설계하거나 중복 구현하지 않고 재사용한다.

## 코드 컨벤션

- 변수명, 함수명, 타입명, 파일명은 영어를 사용한다.
- 사용자에게 보이는 UI 문구는 한국어를 기본으로 한다.
- 설명이 필요한 주석은 한국어로 작성한다.
- TypeScript 타입 오류를 남기지 않는다.
- 하드코딩 사용자 이름, 학번, 호실, 테스트 계정을 운영 코드에 넣지 않는다.
- 인증이 필요한 기능은 현재 로그인 세션/서버 사용자 정보를 사용한다.
- 시간 판정, 만료 판정, 권한 판정, 배정 판정은 가능한 한 서버에서 수행한다.
- 클라이언트 `Date.now()`를 서버 정책 판정 기준으로 사용하지 않는다.
- 동시성이 중요한 DB 변경은 기존 프로젝트의 원자적 SQL/CTE/잠금 패턴을 우선 따른다.
- 새 abstraction, helper, migration은 현재 Issue에 정말 필요한 경우에만 추가한다.

## 폴더 역할

- `src/app/` : Next.js 화면 및 Route Handler
- `src/app/api/` : 서버 API
- `src/lib/` : DB 접근, 정책, 서버 비즈니스 로직
- `src/components/` : 재사용 UI 컴포넌트
- `db/schema.sql` : 현재 전체 DB 스키마
- `db/migrations/` : 기존 DB 변경용 migration
- `docs/` : 프로젝트 정책/요구사항의 기준 문서
- `.claude/skills/` : 반복 작업용 팀 공용 Skill

DB 스키마 변경이 필요하면 기존 DB에는 새 migration을 추가하고, 동일 변경을 `db/schema.sql`에도 반영한다.

## DB migration 규칙

migration 파일이 추가되는 작업은 **코드 merge와 DB 반영을 구분**한다.

1. 먼저 `npm run db:migrate:status`로 적용 상태를 확인한다 (읽기 전용).
2. DB에 write하기 전, 대상이 어느 Neon branch인지 반드시 확인한다.
3. 가능하면 별도 Neon test branch에서 먼저 migration을 적용하고 실DB로 검증한다.
4. 검증 후 개발 환경(`preview`/`dev`)에 migration을 적용한다.
5. 적용 후 다시 `npm run db:migrate:status`로 확인한다.
6. `db/migrations/` 파일 수와 `schema_migrations` 장부가 일치하는지 확인한다.
7. migration이 필요한 새 코드가 `dev`에 배포되기 전에 `preview`/`dev` schema를 미리 준비하는 것을 기본으로 한다.

**Production / Neon main DB에는 사용자의 명시적 승인 없이 migration이나 write를 하지 않는다.**

## DB 테스트 안전 규칙

- DB write가 필요한 테스트는 가능하면 Neon 테스트 branch에서 수행한다.
- 작업 전 `current_setting('neon.branch_id', true)` 등으로 실제 연결된 branch를 확인한다.
- 테스트 데이터는 전용 식별자(이메일/이름 등에 테스트 표시)로 생성한다.
- 기존에 상속되어 있는 데이터는 가능한 한 수정하지 않는다. 불가피하게 건드려야 하면 정확한 원복 절차를 정하고 try/finally로 보장한다.
- 조건 없는 광범위 `DELETE`/`UPDATE`는 금지한다.
- 테스트 후 생성한 데이터가 남아 있지 않은지 확인한다.

## 금지 사항

- `.env.local`을 수정하거나 커밋하지 않는다. 이 파일은 실제 로컬 환경용이며 secret을 담는다.
- `.env.local.example`에는 변수명과 안전한 예시만 두고 실제 secret은 넣지 않는다.
- 다음 값을 commit하거나 출력·로그로 남기지 않는다: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, DB password, `CRON_SECRET`, OAuth secret, 그 밖의 실제 credential.
- `.claude/settings.local.json`을 프로젝트 커밋에 포함하지 않는다.
- Issue와 무관한 파일을 정리한다는 이유로 함께 수정하지 않는다. 이슈 하나의 변경에 다른 이슈 수정이나 관련 없는 cleanup을 섞지 않는다. 범위 밖 문제를 발견하면 임의로 고치지 말고 별도 이슈/후속 작업으로 보고한다.
- 테스트 통과만을 위해 하드코딩하거나 임시 우회 코드를 넣지 않는다.
- 사용자의 승인 없이 commit, push, PR, merge를 진행하지 않는다. 사용자가 해당 단계까지 명시적으로 요청한 경우에만 수행한다.
- 사용자가 명시적으로 요청하지 않는 한 커밋 메시지나 PR 본문에 `Co-Authored-By: Claude...`, `Generated with Claude Code` 등 AI 생성 표시 footer/trailer를 자동으로 추가하지 않는다.

## 검증 절차

구현 후 반드시 다음을 수행한다.

1. `npx tsc --noEmit`
2. `npm run build`
3. `npm run lint`
4. `npm test`
5. 변경 파일에 대한 lint 신규 오류 여부 확인
6. `git diff`
7. `git status`

전체 lint에 기존 오류가 있으면:
- 기존 baseline과 이번 변경으로 생긴 신규 오류를 구분한다.
- 신규 오류 0건인지 별도로 확인한다.

DB 관련 기능은 가능하면 다음도 확인한다.

- 실제 DB 상태와 화면/API 응답 일치
- 중복 데이터 발생 여부
- 고아 상태(orphan state) 발생 여부
- 같은 작업을 두 번 실행해도 결과가 깨지지 않는지(idempotency)

DB migration이 포함된 작업은 위 「DB migration 규칙」·「DB 테스트 안전 규칙」도 함께 따른다.

## 결과 보고 형식

구현 완료 시 최소한 다음을 보고한다.

- 현재 브랜치
- 수정 파일
- 신규 파일
- 구현한 동작
- 기존 코드 재사용 부분
- 다른 Issue로 남긴 부분
- DB migration 여부
- tsc
- build
- lint 신규 오류
- test
- `git diff` 요약
- `git status`
- 수동 테스트 방법
- 남은 주의사항

## 잘못된 결과를 발견했을 때

단순히 "다시 구현"하지 않는다.

1. 어디에서 문제를 발견했는지 기록한다.
2. 어떤 요구사항/문서와 어긋났는지 확인한다.
3. 현재 변경사항과 마지막 정상 커밋을 확인한다.
4. 최소 범위로 수정한다.
5. 필요하면 이 `CLAUDE.md` 또는 관련 Skill에 재발 방지 규칙을 추가한다.
6. 수정 후 전체 검증 절차를 다시 실행한다.

## 현재 프로젝트에서 이미 배운 규칙

- Push와 PR은 별개다. feature 브랜치 push 후 PR의 base는 `dev`다.
- `dev`는 GitHub 기본 브랜치가 아니라서 PR 본문의 `Close #NN`이 merge 시 자동으로 닫히지 않을 수 있다 — merge 후 Issue 상태를 직접 확인한다.
- 서버 배정/만료/경고처럼 Issue 간 의존성이 있으면 선행 Issue가 병합된 뒤 이어서 구현한다.
- Claude가 "완료"라고 보고해도 Issue 원문과 다시 비교한다.
- 자동 경고 중복 방지와 관리자 수동 경고 중복 방지는 서로 다른 문제일 수 있으므로 완료 조건을 세분화해 확인한다.
