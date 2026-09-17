// src/lib/notify-copy.ts 의 알림 문구를 확인한다 (04 F4 · F5 · F9 · docs/design/i18n.js
// 번역 패턴 · Issue #12).
//
// 실행: npm test
//
// report-rules.test.ts 와 같은 방식이다 — Node 24 내장 테스트 러너(node:test)와
// 타입 스트리핑만 쓰고, `@/` 별칭 대신 상대 경로로 불러온다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { assignmentBody, assignmentTitle, usageEndedBody, usageEndedTitle } from './notify-copy.ts';

describe('F4 · F5 — 배정 알림 문구', () => {
  it('제목은 "기기이름에 배정됐어요" 모양이다', () => {
    assert.equal(assignmentTitle('세탁기 3호기'), '세탁기 3호기에 배정됐어요');
  });

  it('instant(F4) — docs/design/i18n.js 의 "바로 이용할 수 있어요" 문장과 정확히 같다', () => {
    assert.equal(
      assignmentBody('세탁기 3호기', 'instant'),
      '세탁기 3호기를 바로 이용할 수 있어요. 10분 안에 QR을 찍어주세요.',
    );
  });

  it('turn(F5) — docs/design/i18n.js 의 "차례가 됐어요!" 문장과 정확히 같다', () => {
    assert.equal(
      assignmentBody('세탁기 3호기', 'turn'),
      '세탁기 3호기 차례가 됐어요! 10분 안에 QR을 찍어 시작해주세요.',
    );
  });
});

describe('F9 — 종료 알림 문구', () => {
  it('제목은 "기기이름 사용이 끝났어요" 모양이다', () => {
    assert.equal(usageEndedTitle('건조기 1호기'), '건조기 1호기 사용이 끝났어요');
  });

  it('본문 — docs/design/i18n.js 의 "이용 시간이 끝났어요" 문장과 정확히 같다', () => {
    assert.equal(
      usageEndedBody('건조기 1호기'),
      '건조기 1호기 이용 시간이 끝났어요. 3분 안에 "다했어요"를 눌러주세요.',
    );
  });
});
