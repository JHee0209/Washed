// Issue #56 — DB 없이 요청 검증과 QR 실패 사유의 배선이 유지되는지 확인한다.
//
// usage.ts와 Route Handler는 server-only · DB · 세션 의존성이 있어 현재 테스트 환경에서
// 직접 import할 수 없다. queue-read-only.test.ts와 같은 방식으로 소스를 읽되, 단순
// 문자열 존재가 아니라 검증·분기 순서와 각 응답의 연결을 함께 확인한다.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const SRC_ROOT = path.resolve(import.meta.dirname, '..');

function source(file: string): string {
  return readFileSync(path.join(SRC_ROOT, file), 'utf8');
}

function between(text: string, start: string, end?: string): string {
  const startAt = text.indexOf(start);
  assert.notEqual(startAt, -1, `시작 지점을 찾지 못했습니다: ${start}`);
  const endAt = end ? text.indexOf(end, startAt + start.length) : text.length;
  assert.notEqual(endAt, -1, `끝 지점을 찾지 못했습니다: ${end}`);
  return text.slice(startAt, endAt);
}

describe('POST /api/queue/finish — 잘못된 machineId 차단', () => {
  it('finishUsage가 첫 DB 질의 전에 기존 UUID_SHAPE로 거부한다', () => {
    const finishUsage = between(source('lib/usage.ts'), 'export async function finishUsage');
    const guardAt = finishUsage.indexOf('if (!UUID_SHAPE.test(machineId))');
    const queryAt = finishUsage.indexOf('const rows = await sql');

    assert.ok(guardAt >= 0, 'finishUsage의 UUID 사전 검증이 없습니다.');
    assert.ok(queryAt >= 0, 'finishUsage의 종료 SQL을 찾지 못했습니다.');
    assert.ok(guardAt < queryAt, 'UUID 검증은 DB 질의보다 먼저 실행돼야 합니다.');
    assert.ok(finishUsage.includes("reason: 'invalid_machine_id'"));
  });

  it('라우트가 invalid_machine_id를 400으로 응답한다', () => {
    const route = source('app/api/queue/finish/route.ts');
    const branch = between(route, "result.reason === 'invalid_machine_id'", "result.reason === 'not_in_use'");

    assert.ok(branch.includes("reason: 'invalid_machine_id'"));
    assert.ok(branch.includes('status: 400'));
  });
});

describe('POST /api/queue/verify-qr — 수거대기와 배정 만료 구분', () => {
  it('수거대기를 pickup_pending으로 먼저 분리하고 실제 배정 만료만 expired로 처리한다', () => {
    const startUsage = between(source('lib/usage.ts'), 'export async function startUsageFromQr', '// F9');
    const pickupAt = startUsage.indexOf("existing.status === '수거대기'");
    const expiredAt = startUsage.indexOf('existing.assignment_expired');

    assert.ok(pickupAt >= 0, '수거대기 상태 분기가 없습니다.');
    assert.ok(expiredAt >= 0, 'DB 서버 시각 기준 배정 만료 분기가 없습니다.');
    assert.ok(pickupAt < expiredAt, '수거대기를 만료보다 먼저 구분해야 합니다.');
    assert.ok(startUsage.includes("reason: 'pickup_pending'"));
    assert.ok(startUsage.includes("reason: 'expired'"));
  });

  it('라우트와 스캐너가 수거대기 전용 안내를 사용하고 재시도를 숨긴다', () => {
    const route = source('app/api/queue/verify-qr/route.ts');
    const pickupBranch = between(route, "result.reason === 'pickup_pending'", "// 'expired'");
    // 사용자 화면은 (user) 라우트 그룹 아래에 있다 — 괄호 이름은 URL 에 들어가지
    // 않으므로 /home 은 그대로다 (Issue #13 · 관리자 영역 격리).
    const scanner = source('app/(user)/home/qr-scanner.tsx');

    assert.ok(pickupBranch.includes("reason: 'pickup_pending'"));
    assert.ok(pickupBranch.includes('status: 409'));
    assert.equal(pickupBranch.includes('10분'), false, '수거대기 안내에 배정 만료 문구가 섞였습니다.');
    assert.ok(scanner.includes("errorReason === 'pickup_pending'"));
    assert.ok(scanner.includes('!isPickupPending &&'));
  });
});
