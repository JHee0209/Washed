'use client';

// 문장 **가운데**에 굵은 글씨 같은 조각이 들어가는 자리를 위한 컴포넌트.
//
// 왜 필요한가 — `사파리 아래쪽 <b>공유</b>를 누르고…` 같은 문장을
//   t('push.iosBodyPart1') + <b>{t('push.iosShare')}</b> + t('push.iosBodyPart2')
// 로 쪼개면 **번역이 불가능해진다.** 언어마다 어순이 달라서 조각의 순서와 개수가
// 바뀌기 때문이다(영어는 "Tap <b>Share</b> at the bottom…", 일본어는 목적어가 앞).
//
// 그래서 문장은 한 덩어리로 두고 `{share}` 자리에 ReactNode 를 끼운다.
//
// **문자열이 아니라 key 를 받는다.** t() 는 `{…}` 가 있는 문장에 치환 인자를
// 요구하는데(types.ts), 여기서는 치환하지 않은 원문이 필요하다 — 자리를 채우는
// 것이 문자열이 아니라 ReactNode 이기 때문이다. 그래서 조회를 직접 한다.
//
// 쪼개는 판정은 translate.ts 의 splitSlots() 가 한다(순수 함수 · 테스트됨).
// node --test 가 JSX 를 처리하지 못하므로 로직을 이 파일에 두지 않는다.

import { Fragment, type ReactNode } from 'react';

import { lookup, splitSlots } from './translate.ts';
import type { MessageKey } from './types.ts';
import { useLang } from './use-t.ts';

export function Rich({
  messageKey,
  slots,
}: {
  messageKey: MessageKey;
  slots: Record<string, ReactNode>;
}) {
  const lang = useLang();

  return (
    <>
      {splitSlots(lookup(lang, messageKey)).map((part, index) => {
        if (typeof part === 'string') return <Fragment key={index}>{part}</Fragment>;
        // 채울 것이 없는 자리는 원문 그대로 남긴다 — 사라지면 문장이 조용히
        // 이상해지고, 던지면 화면이 통째로 죽는다 (interpolate() 와 같은 규칙).
        const filled = Object.hasOwn(slots, part.slot) ? slots[part.slot] : `{${part.slot}}`;
        return <Fragment key={index}>{filled}</Fragment>;
      })}
    </>
  );
}
