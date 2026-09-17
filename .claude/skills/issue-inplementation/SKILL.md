---
name: issue-implementation
description: Washed 프로젝트에서 GitHub Issue 하나를 구현할 때 사용한다. 구현 전 범위/의존성 분석, 코드 수정, 검증, 최종 보고까지 같은 절차로 진행하기 위한 팀 공용 Skill이다.
---

# Issue Implementation Skill

이 Skill은 기능 Issue를 구현할 때 사용한다.

## 사용 예시

사용자가 다음처럼 요청하면 이 Skill을 적용한다.

- `Issue #6을 issue-implementation Skill로 진행해줘.`
- `#8 남은 작업을 이 Skill 절차대로 이어서 구현해줘.`

## 1. 작업 전 안전 확인

먼저 다음을 확인한다.

```bash
git branch --show-current
git status
```

확인 사항:

- 현재 브랜치가 해당 Issue용 브랜치인지
- merge/rebase가 진행 중인지
- Issue와 무관한 미커밋 변경이 있는지

Issue와 무관한 변경이 있으면 임의로 버리거나 덮어쓰지 말고 보고한다.

## 2. 요구사항 수집

다음 순서로 확인한다.

1. GitHub Issue 제목/본문/체크리스트
2. Issue에 적힌 `docs/` 참고 자료
3. 관련 DB schema
4. 기존 API/서비스/화면 코드
5. 선행 Issue 구현
6. 후속 Issue와의 경계

문서와 코드가 충돌하면 임의로 선택하지 말고 사용자에게 질문한다.

## 3. 구현 분석 보고

코드 수정 전에 아래를 짧게 정리한다.

```text
[Issue #N 구현 분석]

1. 정확한 요구사항:
2. 이미 구현된 부분:
3. 새로 구현할 부분:
4. 선행 Issue 재사용 부분:
5. 예상 수정 파일:
6. DB migration 필요 여부:
7. 충돌/의존성:
8. 이번 Issue에서 하지 않을 범위:
9. 구현 계획:
```

중대한 정책 선택이 없으면 분석 후 구현을 계속한다.

## 4. 구현 원칙

- 현재 Issue 범위만 구현한다.
- 선행 Issue 기능을 다시 만들지 않는다.
- 후속 Issue 기능을 미리 구현하지 않는다.
- 사용자/세션 정보를 하드코딩하지 않는다.
- 서버 정책 판정은 서버 시각을 기준으로 한다.
- DB 동시성이 필요한 경우 기존 원자적 SQL/CTE/잠금 컨벤션을 따른다.
- 여러 번 호출될 수 있는 배치/만료 로직은 idempotent하게 만든다.
- DB migration은 정말 필요한 경우에만 추가한다.
- `.env.local`과 `.claude/settings.local.json`은 건드리지 않는다.

## 5. 테스트 및 검증

구현 후 다음을 실행한다.

```bash
npx tsc --noEmit
npm run build
npm run lint
npm test
git diff
git status
```

추가로:

- 변경 파일만 lint하여 신규 오류 0건인지 확인한다.
- 기존 lint 오류와 신규 오류를 구분한다.
- DB 기능이면 중복/고아 상태/경계시간을 확인한다.
- 동시성이 핵심이면 가능한 범위에서 동시 요청 시나리오를 검증한다.

## 6. 범위 검토

`git diff`를 보고 다음을 확인한다.

- Issue와 무관한 파일이 변경되지 않았는지
- 다른 팀원의 기능을 되돌리지 않았는지
- 테스트를 통과시키기 위한 하드코딩이 없는지
- 비밀정보가 포함되지 않았는지

## 7. 최종 보고

```text
[Issue #N 구현 결과]

- 현재 브랜치:
- 수정 파일:
- 신규 파일:
- 구현한 동작:
- 서버/DB 처리 방식:
- 선행 Issue 재사용 부분:
- 후속 Issue로 남긴 부분:
- DB migration:
- tsc:
- build:
- lint 신규 오류:
- test:
- git diff 요약:
- git status:
- 수동 테스트 방법:
- 남은 주의사항:
```

## 8. Git 작업 제한

사용자가 별도로 요청하기 전에는 다음을 하지 않는다.

- commit
- push
- PR 생성
- merge

사용자가 commit을 요청하면 `git add .` 대신 커밋 대상 파일을 명시적으로 stage한다.
