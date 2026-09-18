// scripts/migration-status.mjs 의 비교 판정을 확인한다 (Issue #59 · 08 · 13번).
//
// 실행: npm test
//
// src/lib/retention.test.ts 와 같은 방식이다 — Node 내장 테스트 러너(node:test)만
// 쓰고 상대 경로 + 확장자로 불러온다.
//
// **여기서 확인하는 것은 DB 없이 판정되는 「비교」뿐이다.** 실제 접속 · to_regclass ·
// 종료 코드 전달은 db-migrate-status.mjs 쪽이라 이 파일에 없다 — 개발 DB 에 대고
// npm run db:migrate:status 를 직접 돌려 확인한다(08 · 13번).
//
// 특히 「장부에는 있는데 파일이 없는」 경우는 팀 공용 개발 DB 의 schema_migrations 에서
// 행을 지워야 실제로 재현되는데, 그러면 db:migrate 가 그 파일을 다시 돌리게 된다.
// 전용 테스트 DB 가 없으므로 그 경우는 실제 DB 대신 여기서 확인한다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EXIT, compareMigrations, exitCodeFor, formatReport } from './migration-status.mjs';

/** 지금 이 브랜치의 db/migrations/ 모습 — 0009 가 비어 있다 */
const BRANCH_FILES = [
  '0001_push_subscriptions.sql',
  '0002_notices.sql',
  '0003_email_verifications.sql',
  '0004_notification_notice_link.sql',
  '0005_report_evidence.sql',
  '0006_machine_inspection_status.sql',
  '0007_retention_indexes.sql',
  '0008_warning_usage_history_ref.sql',
  '0010_facility_inspection_status.sql',
  '0011_manual_warning_types.sql',
];

describe('compareMigrations — 정상', () => {
  it('파일과 장부가 같으면 미적용도 장부 전용도 없다', () => {
    const result = compareMigrations(BRANCH_FILES, [...BRANCH_FILES]);

    assert.deepEqual(result.pending, []);
    assert.deepEqual(result.orphans, []);
    assert.equal(result.applied.length, BRANCH_FILES.length);
    assert.equal(exitCodeFor(result), EXIT.OK);
  });

  it('장부가 뒤죽박죽 순서로 와도 정렬해서 본다', () => {
    const shuffled = [...BRANCH_FILES].reverse();
    const result = compareMigrations(BRANCH_FILES, shuffled);

    assert.deepEqual(result.applied, [...BRANCH_FILES].sort());
    assert.deepEqual(result.pending, []);
  });

  it('번호가 비어 있다는 것(0008 → 0010)만으로는 아무것도 보고하지 않는다', () => {
    const result = compareMigrations(BRANCH_FILES, [...BRANCH_FILES]);

    const report = formatReport(result, { envLabel: '테스트' }).join('\n');
    assert.match(report, /미적용 migration 없음/);
    assert.doesNotMatch(report, /\[경고\]/);
    assert.doesNotMatch(report, /\[미적용\]/);
  });
});

describe('compareMigrations — 미적용(pending)', () => {
  it('장부에 없는 파일을 미적용으로 잡는다', () => {
    const applied = BRANCH_FILES.slice(0, 8); // 0010 · 0011 을 아직 안 돌린 DB
    const result = compareMigrations(BRANCH_FILES, applied);

    assert.deepEqual(result.pending, [
      '0010_facility_inspection_status.sql',
      '0011_manual_warning_types.sql',
    ]);
    assert.deepEqual(result.orphans, []);
    assert.equal(exitCodeFor(result), EXIT.PENDING);
  });

  it('미적용은 파일 순서를 그대로 지킨다 — db:migrate 가 돌릴 순서다', () => {
    const result = compareMigrations(BRANCH_FILES, []);

    assert.deepEqual(result.pending, BRANCH_FILES);
    assert.equal(exitCodeFor(result), EXIT.PENDING);
  });

  it('장부 표가 아예 없는 DB 는 전부 미적용으로 나오고 그 사정을 함께 적는다', () => {
    const result = compareMigrations(BRANCH_FILES, []);

    const report = formatReport(result, { envLabel: '테스트', ledgerMissing: true }).join('\n');
    assert.match(report, /schema_migrations 표가 없습니다/);
    assert.match(report, /db:push/);
    assert.match(report, /\[미적용\] 아직 적용되지 않은 migration 10개/);
  });
});

describe('compareMigrations — 장부 전용(orphan)', () => {
  it('파일이 없는 장부 기록을 잡아내되 실패로 만들지는 않는다', () => {
    // 팀원 브랜치 origin/fix/admin-warning-reason 의 0009 가 먼저 적용된 DB
    const applied = [
      ...BRANCH_FILES.slice(0, 8),
      '0009_warning_admin_reasons.sql',
      ...BRANCH_FILES.slice(8),
    ];
    const result = compareMigrations(BRANCH_FILES, applied);

    assert.deepEqual(result.orphans, ['0009_warning_admin_reasons.sql']);
    assert.deepEqual(result.pending, []);
    assert.equal(exitCodeFor(result), EXIT.OK);
  });

  it('장부 전용은 경고로 찍고 번호를 손대지 말라고 적는다', () => {
    const result = compareMigrations(BRANCH_FILES, [
      ...BRANCH_FILES,
      '0009_warning_admin_reasons.sql',
    ]);

    const report = formatReport(result, { envLabel: '테스트' }).join('\n');
    assert.match(report, /\[경고\] repository 에 파일이 없는데 장부에만 있는 기록 1개/);
    assert.match(report, /0009_warning_admin_reasons\.sql/);
    assert.match(report, /번호를 바꾸지 마세요/);
    assert.match(report, /미적용 migration 없음/);
  });

  it('미적용과 장부 전용이 함께 있으면 미적용 쪽이 종료 코드를 정한다', () => {
    const result = compareMigrations(BRANCH_FILES, [
      ...BRANCH_FILES.slice(0, 8),
      '0009_warning_admin_reasons.sql',
    ]);

    assert.deepEqual(result.orphans, ['0009_warning_admin_reasons.sql']);
    assert.equal(result.pending.length, 2);
    assert.equal(exitCodeFor(result), EXIT.PENDING);
  });
});

describe('formatReport — 비밀값', () => {
  it('접속 문자열을 받지 않으므로 출력에 남을 자리가 없다', () => {
    const result = compareMigrations(BRANCH_FILES, [...BRANCH_FILES]);
    const label = 'DATABASE_URL · DB neondb · 지문 3f9a1c2b';

    const report = formatReport(result, { envLabel: label }).join('\n');
    assert.match(report, /DATABASE_URL · DB neondb · 지문 3f9a1c2b/);
    assert.doesNotMatch(report, /postgres(ql)?:\/\//);
    assert.doesNotMatch(report, /@/); // 사용자:비밀번호@host 형태가 끼지 않는다
  });
});
