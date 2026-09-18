// src/lib/report-rules.ts 의 판정을 확인한다 (F11 · 05 P15 · 08 · 7번).
//
// 실행: npm test
//
// Node 24 내장 테스트 러너(node:test)와 타입 스트리핑만 쓴다 — 이 저장소에
// 테스트 도구를 새로 들이지 않기 위해서다. 그래서 `@/` 별칭 대신 상대 경로로
// 불러온다(별칭은 번들러가 푸는 것이라 node 가 직접 돌릴 때는 없다).
//
// **여기서 확인하는 것은 DB 없이 판정되는 것뿐이다.** 로그인 · 신고자 위조 방지 ·
// 알림 대상 · 탈퇴 삭제 · 3개월 정리는 DB 가 있어야 해서 이 파일에 없다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ALLOWED_EVIDENCE_MIME,
  MAX_EVIDENCE_BYTES,
  REASON_LABEL_TO_DB,
  validateReportInput,
  type ReportInput,
} from './report-rules.ts';

/** 기본값 위에 필요한 것만 덮어쓴다 */
function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    reasonLabel: '기기가 고장났어요',
    machineKind: '세탁기',
    machineNo: 2,
    etcContent: null,
    evidence: null,
    ...over,
  };
}

/** 한도 안의 정상 이미지 */
const goodPhoto = { mime: 'image/jpeg', byteSize: 1024 * 512 };

describe('사유 매핑 — 화면 라벨과 DB 사유가 다르다', () => {
  it('화면 라벨을 db/schema.sql 의 CHECK 가 받는 사유로 옮긴다', () => {
    assert.equal(REASON_LABEL_TO_DB['기기가 고장났어요'], '기기 고장');
    assert.equal(REASON_LABEL_TO_DB['순서를 지키지 않았어요'], '순서 미준수');
    assert.equal(REASON_LABEL_TO_DB['세탁물이 있어요'], '세탁물 있음');
    assert.equal(REASON_LABEL_TO_DB['기타'], '기타');
  });

  it('통과한 값의 reason 은 DB 사유다 — 화면 문자열이 그대로 새지 않는다', () => {
    const result = validateReportInput(input());
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.reason, '기기 고장');
  });

  it('05 P15 — 사유를 고르지 않으면 접수할 수 없다', () => {
    const result = validateReportInput(input({ reasonLabel: null }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
  });

  it('목록에 없는 사유는 거부한다 — DB CHECK 까지 가기 전에 막는다', () => {
    const result = validateReportInput(input({ reasonLabel: '세탁물 있음' }));
    assert.equal(result.ok, false);
  });
});

describe('05 P15 — 증거 사진은 「세탁물이 있어요」에만 있고 필수다', () => {
  it('일반 사유는 사진 없이 접수된다', () => {
    const result = validateReportInput(input({ reasonLabel: '기기가 고장났어요', evidence: null }));
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.evidence, null);
  });

  it('「세탁물이 있어요」 + 사진 없음 → 거부한다 (이 작업의 핵심 조건)', () => {
    const result = validateReportInput(input({ reasonLabel: '세탁물이 있어요', evidence: null }));
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
    assert.match(result.ok === false ? result.message : '', /증거 사진/);
  });

  it('「세탁물이 있어요」 + 정상 이미지 → 통과한다', () => {
    const result = validateReportInput(input({ reasonLabel: '세탁물이 있어요', evidence: goodPhoto }));
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.reason, '세탁물 있음');
    assert.equal(result.ok && result.value.evidence?.mime, 'image/jpeg');
  });

  it('나머지 사유에 사진을 붙이면 거부한다 — 그 사유에는 칸 자체가 없다', () => {
    const result = validateReportInput(input({ reasonLabel: '기기가 고장났어요', evidence: goodPhoto }));
    assert.equal(result.ok, false);
  });
});

describe('파일 검증 — 서버가 형식과 용량을 본다', () => {
  it('허용 목록에 있는 형식은 모두 통과한다', () => {
    for (const mime of ALLOWED_EVIDENCE_MIME) {
      const result = validateReportInput(
        input({ reasonLabel: '세탁물이 있어요', evidence: { mime, byteSize: 1024 } }),
      );
      assert.equal(result.ok, true, `${mime} 가 거부됐다`);
    }
  });

  it('허용하지 않은 형식은 415 로 거부한다', () => {
    for (const mime of ['application/pdf', 'image/svg+xml', 'text/html', 'image/gif', '']) {
      const result = validateReportInput(
        input({ reasonLabel: '세탁물이 있어요', evidence: { mime, byteSize: 1024 } }),
      );
      assert.equal(result.ok, false, `${mime} 가 통과했다`);
      assert.equal(result.ok === false && result.status, 415);
    }
  });

  it('한도를 넘는 파일은 413 으로 거부한다', () => {
    const result = validateReportInput(
      input({ reasonLabel: '세탁물이 있어요', evidence: { ...goodPhoto, byteSize: MAX_EVIDENCE_BYTES + 1 } }),
    );
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 413);
  });

  it('한도와 정확히 같은 크기는 통과한다 (경계)', () => {
    const result = validateReportInput(
      input({ reasonLabel: '세탁물이 있어요', evidence: { ...goodPhoto, byteSize: MAX_EVIDENCE_BYTES } }),
    );
    assert.equal(result.ok, true);
  });

  it('빈 파일은 거부한다', () => {
    const result = validateReportInput(
      input({ reasonLabel: '세탁물이 있어요', evidence: { ...goodPhoto, byteSize: 0 } }),
    );
    assert.equal(result.ok, false);
  });
});

describe('05 P15 — 기기 종류 · 호기', () => {
  it('기기 관련 사유인데 종류가 없으면 거부한다', () => {
    const result = validateReportInput(input({ machineKind: null }));
    assert.equal(result.ok, false);
  });

  it('기기 관련 사유인데 호기가 없으면 거부한다', () => {
    const result = validateReportInput(input({ machineNo: null }));
    assert.equal(result.ok, false);
  });

  it('없는 호기는 거부한다 — 건조기는 4대다', () => {
    const result = validateReportInput(input({ machineKind: '건조기', machineNo: 5 }));
    assert.equal(result.ok, false);
  });

  it('FormData 가 주는 문자열 호기도 받는다', () => {
    const result = validateReportInput(input({ machineNo: '3' }));
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.machineNo, 3);
  });

  it('「기타」는 기기 없이 내용만으로 접수된다', () => {
    const result = validateReportInput(
      input({ reasonLabel: '기타', machineKind: null, machineNo: null, etcContent: '문이 잘 안 닫혀요' }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.machineKind, null);
    assert.equal(result.ok && result.value.machineNo, null);
  });

  it('「기타」에 기기를 붙이면 거부한다 — DB CHECK 가 막는 것을 먼저 막는다', () => {
    const result = validateReportInput(
      input({ reasonLabel: '기타', machineKind: '세탁기', machineNo: 1, etcContent: '내용' }),
    );
    assert.equal(result.ok, false);
  });

  it('「기타」인데 내용이 비어 있으면 거부한다', () => {
    const result = validateReportInput(
      input({ reasonLabel: '기타', machineKind: null, machineNo: null, etcContent: '   ' }),
    );
    assert.equal(result.ok, false);
  });
});
