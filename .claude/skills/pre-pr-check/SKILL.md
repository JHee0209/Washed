---
name: pre-pr-check
description: Washed 프로젝트에서 feature 브랜치를 integration-total로 PR 보내기 직전에 사용하는 검증 Skill이다. 범위 밖 변경, 테스트, 비밀정보, 충돌 가능성, PR base를 점검한다.
---

# Pre-PR Check Skill

이 Skill은 구현과 커밋이 끝난 뒤 PR을 만들기 전에 사용한다.

## 사용 예시

- `#5를 pre-pr-check Skill로 검사해줘.`
- `이 브랜치 integration-total로 PR 보내도 되는지 Skill대로 확인해줘.`

## 1. 브랜치와 상태 확인

```bash
git branch --show-current
git status
git log --oneline --decorate -n 10
```

확인:

- `main` 또는 `integration-total`에서 직접 작업한 것이 아닌지
- 작업 브랜치가 Issue 브랜치인지
- merge conflict/rebase가 진행 중이지 않은지
- 의도하지 않은 untracked/modified 파일이 없는지

## 2. 최신 integration-total과 차이 확인

```bash
git fetch origin
git log --oneline --left-right --cherry-pick origin/integration-total...HEAD
```

필요하면 현재 feature 브랜치에 최신 `origin/integration-total`을 merge한다.

merge conflict가 생기면:
- ours/theirs 전체 선택 금지
- 두 변경 목적을 비교
- 필요한 양쪽 기능을 보존
- 충돌 해결 후 전체 검증 재실행

## 3. 변경 범위 확인

```bash
git diff origin/integration-total...HEAD --stat
git diff origin/integration-total...HEAD
```

확인:

- Issue 범위 밖 변경 없음
- `.env.local` 없음
- `.claude/settings.local.json` 없음
- 비밀키/토큰/DB URL 없음
- 다른 Issue 기능을 실수로 포함하지 않음

## 4. 품질 검증

```bash
npx tsc --noEmit
npm run build
npm run lint
npm test
```

전체 lint 실패 시 변경 파일을 별도로 검사해 신규 오류 여부를 확인한다.

## 5. 기능 검증

Issue 체크리스트를 하나씩 실제 구현과 대조한다.

Claude의 "완료" 보고만 근거로 체크하지 않는다.

가능하면:
- 화면 직접 확인
- API 응답 확인
- DB 상태 확인
- 오류/빈 상태 확인
- 두 사용자 동시 사용 시나리오 확인

## 6. PR 대상 확인

PR 생성 시 반드시:

```text
base: integration-total
compare: 현재 feature 브랜치
```

`main`으로 직접 PR을 보내지 않는다.

## 7. 최종 보고

```text
[Pre-PR 검증 결과]

- 브랜치:
- 대상 Issue:
- integration-total 최신 반영 여부:
- 변경 파일:
- 범위 밖 변경:
- 비밀정보 포함:
- tsc:
- build:
- lint 신규 오류:
- test:
- 수동 테스트:
- conflict 가능성:
- PR base:
- PR 생성 가능 여부:
- 남은 주의사항:
```

문제가 하나라도 있으면 PR 생성을 멈추고 먼저 해결한다.
