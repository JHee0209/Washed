// 긴 본문(FAQ · 약관 · 개인정보 동의서)이 네 언어에서 어긋나지 않는지
// (F22 · 05 SP3 · Issue #13 의 7번).
//
// 이 파일들은 사전(ko.ts)이 아니라 **구조화된 데이터**라 `satisfies Dictionary` 의
// 보호를 받지 못한다. 문단 하나를 빠뜨려도 컴파일된다 — 그래서 개수 · 순서를
// 여기서 지킨다. 특히 FAQ 의 `id` 는 열림 상태(openFaqId)라 네 언어에서 같아야 한다.
//
// 실행: npm test

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LANGS, type Lang } from '../lang.ts';
import { FAQ } from './faq.ts';
import { PRIVACY } from './privacy.ts';
import { TERMS, type LegalSection } from './terms.ts';

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

/**
 * 아직 팀이 채우지 않은 자리표시자. 네 언어에서 같은 토큰으로 두는 것이 맞아서
 * 「번역문에 한국어가 남아 있으면 안 된다」 검사에서만 빼 준다.
 */
const PLACEHOLDER = '[고객지원이메일]';

const sectionsOf = (lang: Lang): LegalSection[] => [...TERMS[lang], ...PRIVACY[lang].sections];

describe('FAQ — 네 언어 구조 정합성', () => {
  it('네 언어가 모두 있다', () => {
    assert.deepEqual(Object.keys(FAQ).sort(), [...LANGS].sort());
  });

  it('섹션 수가 같다', () => {
    const expected = FAQ.ko.length;
    assert.ok(expected > 0, 'ko FAQ 가 비어 있습니다.');
    for (const lang of LANGS) {
      assert.equal(FAQ[lang].length, expected, `${lang} 의 FAQ 섹션 수가 ko 와 다릅니다.`);
    }
  });

  it('항목 id 목록이 순서까지 같다', () => {
    // openFaqId 가 이 값으로 열림 상태를 기억한다 — 언어를 바꾸면 열려 있던 항목이
    // 닫혀 버리거나 엉뚱한 항목이 열리는 것을 막는다.
    const expected = FAQ.ko.map((section) => section.items.map((item) => item.id));
    for (const lang of LANGS) {
      assert.deepEqual(
        FAQ[lang].map((section) => section.items.map((item) => item.id)),
        expected,
        `${lang} 의 FAQ id 목록이 ko 와 다릅니다.`,
      );
    }
  });

  it('id 가 전체에서 유일하다', () => {
    for (const lang of LANGS) {
      const ids = FAQ[lang].flatMap((section) => section.items.map((item) => item.id));
      assert.equal(new Set(ids).size, ids.length, `${lang} 의 FAQ id 가 중복됩니다.`);
    }
  });

  it('제목 · 질문 · 답변이 비어 있지 않다', () => {
    for (const lang of LANGS) {
      for (const section of FAQ[lang]) {
        assert.ok(section.title.trim(), `${lang} 의 섹션 제목이 비어 있습니다.`);
        for (const item of section.items) {
          assert.ok(item.question.trim(), `${lang}.${item.id} 의 질문이 비어 있습니다.`);
          assert.ok(item.answer.trim(), `${lang}.${item.id} 의 답변이 비어 있습니다.`);
        }
      }
    }
  });

  it('en · zh · ja 에 한국어가 남아 있지 않다', () => {
    const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
    for (const lang of ['en', 'zh', 'ja'] as const) {
      for (const section of FAQ[lang]) {
        assert.ok(!HANGUL.test(section.title), `${lang} 섹션 제목에 한국어가 남아 있습니다.`);
        for (const item of section.items) {
          assert.ok(!HANGUL.test(item.question), `${lang}.${item.id} 질문에 한국어가 남아 있습니다.`);
          assert.ok(!HANGUL.test(item.answer), `${lang}.${item.id} 답변에 한국어가 남아 있습니다.`);
        }
      }
    }
  });
});

describe('약관 · 개인정보 동의서 — 네 언어 구조 정합성', () => {
  it('네 언어가 모두 있다', () => {
    assert.deepEqual(Object.keys(TERMS).sort(), [...LANGS].sort());
    assert.deepEqual(Object.keys(PRIVACY).sort(), [...LANGS].sort());
  });

  it('약관의 조 수와 각 조의 문단 수가 같다', () => {
    // 법적 동의 화면이라 문단 하나가 빠지면 고지 누락이 된다.
    const expected = TERMS.ko.map((s) => s.paragraphs.length);
    assert.ok(expected.length > 0, 'ko 약관이 비어 있습니다.');
    for (const lang of LANGS) {
      assert.deepEqual(
        TERMS[lang].map((s) => s.paragraphs.length),
        expected,
        `${lang} 약관의 문단 구성이 ko 와 다릅니다.`,
      );
    }
  });

  it('개인정보 동의서의 절 수와 각 절의 문단 수가 같다', () => {
    const expected = PRIVACY.ko.sections.map((s) => s.paragraphs.length);
    for (const lang of LANGS) {
      assert.deepEqual(
        PRIVACY[lang].sections.map((s) => s.paragraphs.length),
        expected,
        `${lang} 개인정보 동의서의 문단 구성이 ko 와 다릅니다.`,
      );
    }
  });

  it('제목 · 문단이 비어 있지 않다', () => {
    for (const lang of LANGS) {
      assert.ok(PRIVACY[lang].intro.trim(), `${lang} 개인정보 동의서의 머리말이 비어 있습니다.`);
      for (const section of sectionsOf(lang)) {
        assert.ok(section.heading.trim(), `${lang} 의 제목이 비어 있습니다.`);
        for (const [i, p] of section.paragraphs.entries()) {
          assert.ok(p.trim(), `${lang} "${section.heading}" 의 ${i + 1}번째 문단이 비어 있습니다.`);
        }
      }
    }
  });

  // ── Issue #13 의 9번 「약관 수정」이 걸리는 자리
  it('네 언어 모두 「필수항목」 문장에 학번이 들어 있다', () => {
    // 회원가입 화면은 학번을 받는데 동의 본문에는 빠져 있었다 (05 SP3 · PRD:124).
    const STUDENT_ID: Record<Lang, string> = {
      ko: '학번',
      en: 'student ID',
      zh: '学号',
      ja: '学籍番号',
    };

    for (const lang of LANGS) {
      const required = sectionsOf(lang)
        .flatMap((s) => s.paragraphs)
        .filter((p) => /필수항목|Required items|必填项目|必須項目/.test(p));

      assert.ok(required.length >= 2, `${lang}: 「필수항목」 문장을 약관 · 개인정보 양쪽에서 찾지 못했습니다.`);
      for (const sentence of required) {
        assert.ok(
          sentence.includes(STUDENT_ID[lang]),
          `${lang} 의 「필수항목」 문장에 학번이 없습니다: ${sentence}`,
        );
      }
    }
  });

  it('약관과 개인정보 동의서의 「필수항목」 문장이 서로 같다', () => {
    // 옮겨 오기 전에는 한쪽이 「호실」, 다른 쪽이 「주소」로 끝나 두 문서가 달랐다.
    for (const lang of LANGS) {
      const sentences = sectionsOf(lang)
        .flatMap((s) => s.paragraphs)
        .filter((p) => /필수항목|Required items|必填项目|必須項目/.test(p));
      assert.equal(
        new Set(sentences).size,
        1,
        `${lang}: 두 문서의 「필수항목」 문장이 다릅니다:\n${[...new Set(sentences)].join('\n')}`,
      );
    }
  });

  it('전화번호 관련 문구가 남아 있지 않다 (05 SP3 — 전화번호는 수집하지 않는다)', () => {
    const PHONE = /전화|고객지원번호|[Pp]hone|电话|電話/;
    for (const lang of LANGS) {
      assert.ok(PRIVACY[lang].intro.search(PHONE) < 0, `${lang} 머리말에 전화번호 문구가 있습니다.`);
      for (const section of sectionsOf(lang)) {
        assert.ok(section.heading.search(PHONE) < 0, `${lang} "${section.heading}" 제목에 전화번호 문구가 있습니다.`);
        for (const p of section.paragraphs) {
          assert.ok(p.search(PHONE) < 0, `${lang} 에 전화번호 문구가 남아 있습니다: ${p}`);
        }
      }
    }
  });

  it('en · zh · ja 에 한국어가 남아 있지 않다', () => {
    for (const lang of ['en', 'zh', 'ja'] as const) {
      const strip = (s: string) => s.split(PLACEHOLDER).join('');
      assert.ok(!HANGUL.test(strip(PRIVACY[lang].intro)), `${lang} 머리말에 한국어가 남아 있습니다.`);
      for (const section of sectionsOf(lang)) {
        assert.ok(!HANGUL.test(strip(section.heading)), `${lang} 제목에 한국어가 남아 있습니다: ${section.heading}`);
        for (const p of section.paragraphs) {
          assert.ok(!HANGUL.test(strip(p)), `${lang} 에 한국어가 남아 있습니다: ${p}`);
        }
      }
    }
  });
});
