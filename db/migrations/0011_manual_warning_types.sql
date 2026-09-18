-- 0011 — 관리자 수동 경고에 유형 선택 추가 (05 P6-1 · 06 「경고」 · Issue #47 부속)
--
-- 기존 3값(배정 후 미인증 · 수거 미완료 · 신고 확인)은 그대로 둔다 — '신고 확인'은
-- 경고 누적 사용자 탭(F25 · setMachineStatus 아님, issueWarning 직접 호출)이
-- 지금도 쓴다. 관리자가 사용자 목록(F29)에서 신고를 확인해 수동으로 경고를 줄 때
-- 고르는 구체적 유형 두 가지만 추가한다 — 신고 사유(reports.reason)를 자동으로
-- 옮기는 것이 아니라 관리자가 직접 판단해서 고르는 값이다.
--
-- 저장값은 팀 확정(2026-09-17 · origin/fix/admin-warning-reason)의 짧은 이름을
-- 그대로 쓴다 — 화면에는 src/lib/warning-rules.ts 가 더 읽기 쉬운 문장으로
-- 보여준다(순서 미준수 → "순서를 지키지 않았어요" · 세탁물 방치 → "세탁물이
-- 있어요"). report-rules.ts 의 화면 라벨 ≠ DB 값 패턴과 같다.
--
-- 번호·중복 메모: 팀원 브랜치 origin/fix/admin-warning-reason 의
-- 0009_warning_admin_reasons.sql 이 최종적으로 같은 CHECK(같은 5개 값)를
-- 만든다 — 이 파일과 기능적으로 완전히 중복이다. **일부러 지우지 않았다**:
-- Issue #47 이 그 브랜치보다 먼저 integration-total 에 들어가면, 이 migration
-- 없이는 관리자 화면의 issueWarning(userId, '순서 미준수'|'세탁물 방치') 가 아직
-- 좁은 CHECK 에 걸려 그 자리에서 실패한다. 두 migration 모두 DROP CONSTRAINT IF
-- EXISTS + 같은 최종 값 집합으로 ADD CONSTRAINT 하는 멱등 연산이라, 어느 브랜치가
-- 먼저 merge 되어도, 나중에 다른 브랜치가 들어와 같은 CHECK 를 다시 적용해도
-- 안전하다(파일명이 서로 달라 schema_migrations 에 각각 따로 기록되고 둘 다
-- 실행되지만, 결과 상태는 동일하게 수렴한다). 두 브랜치가 합쳐진 뒤에는 둘 중
-- 하나를 정리해도 되지만 그건 그 시점의 병합 작업이 결정할 일이다.
ALTER TABLE warnings DROP CONSTRAINT IF EXISTS warnings_reason_check;
ALTER TABLE warnings ADD CONSTRAINT warnings_reason_check
  CHECK (reason IN ('배정 후 미인증', '수거 미완료', '신고 확인',
                     '순서 미준수', '세탁물 방치'));
