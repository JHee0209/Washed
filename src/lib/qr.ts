// F8 — 기기 QR 값 서명·검증 (05 P3 · P4 · R8 · 08 · 6번 · Issue #6).
//
// 팀 결정: QR을 기기 옆에서 주기적으로 갱신하는 표시 화면(키오스크)은 만들지 않고
// **정적 QR**을 쓴다 — 기기마다 한 번 발급해 스티커로 붙이고 계속 쓴다. 그래서
// **QR을 미리 찍어 둔 사진으로 나중에(다른 곳에서) 인증하는 것은 이 모듈로 막지
// 못한다.** 대신 이 모듈이 막는 것은 "위조"다 — 서버만 아는 비밀키로 서명하므로
// `machineId=washer-1` 처럼 누구나 만들 수 있는 값으로는 인증이 통과하지 않는다.
//
// DB 도 `server-only` 도 import 하지 않는 순수 모듈이다(report-rules.ts ·
// assignment-rules.ts 와 같은 결) — node --test 가 DB 없이 그대로 돌린다.
// 실제 배정·10분 창 검사는 여기가 아니라 src/lib/usage.ts 가 한다.

import { createHmac, timingSafeEqual } from 'node:crypto';

const PREFIX = 'washed';
const VERSION = 'v1';

function secret(): string {
  const value = process.env.QR_SIGNING_SECRET;
  if (!value) {
    throw new Error('.env.local 에 QR_SIGNING_SECRET 이 없습니다.');
  }
  return value;
}

function sign(machineId: string): string {
  return createHmac('sha256', secret())
    .update(`${PREFIX}.${VERSION}.${machineId}`)
    .digest('base64url');
}

/**
 * 기기 QR에 인코딩할 문자열을 만든다. `scripts/print-machine-qr.mjs`가 부르고,
 * 그 출력을 아무 QR 생성기에 붙여넣어 스티커를 만든다.
 */
export function signMachineQr(machineId: string): string {
  return `${PREFIX}.${VERSION}.${machineId}.${sign(machineId)}`;
}

/**
 * 스캔된 QR 문자열을 검증한다. 형식이 깨졌거나 서명이 맞지 않으면 `null` —
 * 호출부가 이를 "조작된 QR"로 다룬다. 서명 비교는 `timingSafeEqual`로 해서
 * 맞은 글자 수가 시간차로 새지 않게 한다(hash.ts::verify()와 같은 이유).
 */
export function verifyMachineQrPayload(payload: string): { machineId: string } | null {
  if (typeof payload !== 'string' || payload.length === 0 || payload.length > 500) return null;

  const parts = payload.split('.');
  if (parts.length !== 4) return null;
  const [prefix, version, machineId, signature] = parts;
  if (prefix !== PREFIX || version !== VERSION || !machineId || !signature) return null;

  let expected: Buffer;
  let given: Buffer;
  try {
    expected = Buffer.from(sign(machineId));
    given = Buffer.from(signature);
  } catch {
    return null;
  }
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  return { machineId };
}
