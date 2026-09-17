// src/lib/qr.ts 의 QR 서명·검증을 확인한다 (05 P3 · P4 · Issue #6).
//
// 실행: npm test
//
// assignment-rules.test.ts 와 같은 방식이다 — Node 내장 테스트 러너와 타입
// 스트리핑만 쓰고, `@/` 별칭 대신 상대 경로로 불러온다.
//
// QR_SIGNING_SECRET 은 .env.local 이 아니라 이 파일이 직접 정한다 — 실제 비밀값과
// 무관하게 서명 규칙만 확인하면 된다.

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { signMachineQr, verifyMachineQrPayload } from './qr.ts';

before(() => {
  process.env.QR_SIGNING_SECRET = 'test-secret-for-qr-unit-tests';
});

describe('signMachineQr · verifyMachineQrPayload', () => {
  it('서명한 값은 그대로 검증을 통과하고 기기 id 를 돌려준다', () => {
    const machineId = '11111111-1111-4111-8111-111111111111';
    const payload = signMachineQr(machineId);
    assert.deepEqual(verifyMachineQrPayload(payload), { machineId });
  });

  it('기기 id 를 바꿔치기하면(서명은 그대로) 거부한다 — 위조 방지', () => {
    const original = signMachineQr('11111111-1111-4111-8111-111111111111');
    const tampered = original.replace(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );
    assert.equal(verifyMachineQrPayload(tampered), null);
  });

  it('서명 한 글자만 바꿔도 거부한다', () => {
    const payload = signMachineQr('11111111-1111-4111-8111-111111111111');
    const parts = payload.split('.');
    const lastChar = parts[3].at(-1) === 'A' ? 'B' : 'A';
    parts[3] = parts[3].slice(0, -1) + lastChar;
    assert.equal(verifyMachineQrPayload(parts.join('.')), null);
  });

  it('다른 비밀키로 서명한 값은 거부한다', () => {
    const payload = signMachineQr('11111111-1111-4111-8111-111111111111');
    process.env.QR_SIGNING_SECRET = 'a-different-secret';
    assert.equal(verifyMachineQrPayload(payload), null);
    process.env.QR_SIGNING_SECRET = 'test-secret-for-qr-unit-tests';
  });

  it('machineId=washer-1 같은 임의 문자열은 애초에 서명이 없어 거부한다', () => {
    assert.equal(verifyMachineQrPayload('machineId=washer-1'), null);
    assert.equal(verifyMachineQrPayload('washer-1'), null);
  });

  it('형식이 깨진 값(조각 수가 다름 · 빈 문자열)은 거부한다', () => {
    assert.equal(verifyMachineQrPayload(''), null);
    assert.equal(verifyMachineQrPayload('washed.v1.only-three-parts'), null);
    assert.equal(verifyMachineQrPayload('washed.v1.id.sig.extra'), null);
  });

  it('버전이 다르면 거부한다', () => {
    const payload = signMachineQr('11111111-1111-4111-8111-111111111111');
    const parts = payload.split('.');
    parts[1] = 'v2';
    assert.equal(verifyMachineQrPayload(parts.join('.')), null);
  });
});
