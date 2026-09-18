// 기기 QR에 넣을 서명된 값을 찍는다 (F8 · 05 P3 · P4 · 08 · 6번 · Issue #6).
//
//   node --env-file=.env.local scripts/print-machine-qr.mjs <machine_id>
//
// 출력되는 문자열을 아무 QR 생성기(웹 · 앱)에 붙여넣어 스티커를 만들면 된다 —
// 이 저장소는 QR 이미지를 직접 만들지 않는다(불필요한 이미지 라이브러리를
// 추가하지 않기 위해서다).
//
// machine_id 는 `npm run db:check` 로 machines 표를 보거나 관리자 콘솔에서
// 확인한다. QR_SIGNING_SECRET 이 바뀌면 이미 붙여 둔 QR이 전부 무효가 되므로,
// 그런 경우에만 기기별로 이 스크립트를 다시 돌려 스티커를 새로 붙인다.

import { createHmac } from 'node:crypto';

const PREFIX = 'washed';
const VERSION = 'v1';

const [machineId] = process.argv.slice(2);

if (!machineId) {
  console.error('사용법: node --env-file=.env.local scripts/print-machine-qr.mjs <machine_id>');
  process.exit(1);
}

const secret = process.env.QR_SIGNING_SECRET;
if (!secret) {
  console.error('.env.local 에 QR_SIGNING_SECRET 이 없습니다.');
  process.exit(1);
}

// src/lib/qr.ts::signMachineQr() 와 반드시 같은 규칙이어야 한다 — 이 스크립트가
// 그 함수를 그대로 import 하지 않는 이유는 그쪽이 'server-only'를 import 해서
// 스크립트(Next.js 런타임 밖)에서 그대로 불러올 수 없기 때문이다.
const signature = createHmac('sha256', secret)
  .update(`${PREFIX}.${VERSION}.${machineId}`)
  .digest('base64url');

console.log(`${PREFIX}.${VERSION}.${machineId}.${signature}`);
