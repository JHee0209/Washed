// 문의 접수 규칙 (F21 · Issue #86) — 화면과 서버가 함께 부르는 판정 함수다.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_INQUIRY_LENGTH, validateInquiryInput } from './inquiry-rules.ts';

describe('validateInquiryInput', () => {
  it('내용이 있으면 통과한다', () => {
    const result = validateInquiryInput({ content: '세탁기 3호기가 계속 멈춰요.' });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.content, '세탁기 3호기가 계속 멈춰요.');
  });

  it('앞뒤 공백을 떼어 낸 값을 돌려준다 — 라우트는 이 값을 넣는다', () => {
    const result = validateInquiryInput({ content: '  건조기 문이 안 닫혀요  ' });
    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.content, '건조기 문이 안 닫혀요');
  });

  it('빈 문의는 거절한다 (04 F21 미입력 시 전송 불가)', () => {
    const result = validateInquiryInput({ content: '' });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
    assert.equal(result.ok === false && result.message, '문의 내용을 적어주세요.');
  });

  it('공백만 있는 문의도 거절한다', () => {
    const result = validateInquiryInput({ content: '   \n\t  ' });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
  });

  it('문자열이 아니면 거절한다 — API 를 직접 찌르는 경우다', () => {
    for (const content of [undefined, null, 42, { text: '문의' }, ['문의']]) {
      const result = validateInquiryInput({ content });
      assert.equal(result.ok, false, `${JSON.stringify(content)} 는 거절돼야 한다`);
    }
  });

  it('한도까지는 받고 한 글자라도 넘으면 거절한다', () => {
    const atLimit = 'ㄱ'.repeat(MAX_INQUIRY_LENGTH);
    assert.equal(validateInquiryInput({ content: atLimit }).ok, true);

    const overLimit = 'ㄱ'.repeat(MAX_INQUIRY_LENGTH + 1);
    const result = validateInquiryInput({ content: overLimit });
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.status, 400);
  });

  it('공백을 뗀 뒤의 길이로 잰다', () => {
    const padded = `  ${'ㄱ'.repeat(MAX_INQUIRY_LENGTH)}  `;
    assert.equal(validateInquiryInput({ content: padded }).ok, true);
  });
});
