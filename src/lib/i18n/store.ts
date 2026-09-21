'use client';

// 고른 언어를 들고 있는 자리 — React context 가 아니라 모듈 바깥 상태다.
//
// 이 저장소에는 자체 createContext 가 하나도 없고, 기기 단위 브라우저 상태는
// push-client.ts 처럼 **모듈 레벨 listener + useSyncExternalStore** 로 다룬다.
// 같은 방식을 쓴다 — 600곳 가까운 호출부가 provider 를 타고 내려올 필요가 없다.
//
// ── SSR · hydration (8번)
// 서버에는 localStorage 가 없다. `langServerSnapshot()` 이 한국어를 돌려주므로
// 서버 렌더와 hydration 렌더가 **둘 다 한국어**로 같고, 그래서 mismatch 경고가
// 나지 않는다. 저장된 언어는 hydration 직후 React 가 스냅샷을 다시 읽으며 적용된다.
// 렌더 중에 localStorage 를 읽는 코드를 넣지 않는다 — 그것이 진짜 mismatch 원인이다.
// suppressHydrationWarning 으로 덮지 않는다.
//
// ── 앱 내부 이동
// 한 번 읽은 값을 `cached` 에 들고 있어서, 화면을 옮겨 다니는 동안 한국어로
// 돌아갔다가 다시 바뀌는 깜빡임이 없다. 깜빡임은 문서를 통째로 새로 불러올 때 한 번뿐이다.

import { DEFAULT_LANG, LANG_STORAGE_KEY, parseLang, readLangFrom, type Lang } from './lang.ts';

let listeners: (() => void)[] = [];

/** 한 번 읽은 언어. null 이면 아직 안 읽었다는 뜻이다 */
let cached: Lang | null = null;

let storageBound = false;

function emit() {
  for (const listener of listeners) listener();
}

/** 다른 탭에서 언어를 바꾸면 이 탭도 따라간다 (같은 기기니까) */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== LANG_STORAGE_KEY) return;
  cached = readLangFrom(window.localStorage);
  emit();
}

export function subscribeLang(callback: () => void): () => void {
  if (!storageBound && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    storageBound = true;
  }
  listeners = [...listeners, callback];
  return () => {
    listeners = listeners.filter((l) => l !== callback);
  };
}

export function langSnapshot(): Lang {
  if (cached === null) {
    cached = typeof window === 'undefined' ? DEFAULT_LANG : readLangFrom(window.localStorage);
  }
  return cached;
}

/** 서버 렌더에는 브라우저가 없다 — 기본값 한국어로 그린다 (05 P25) */
export function langServerSnapshot(): Lang {
  return DEFAULT_LANG;
}

/**
 * 언어를 바꾸고 이 기기에 남긴다 (8번 「언어 저장 방식」).
 *
 * 계정 DB 에 쓰지 않는다 — 로그아웃해도, 다른 사람이 같은 폰으로 로그인해도
 * 이 기기의 선택이 그대로 남아야 한다.
 *
 * 저장에 실패해도(사파리 프라이빗 등) 화면은 바꾼다. 이번에 켜 둔 동안이라도
 * 읽을 수 있는 편이 낫고, 다음에 열면 한국어로 돌아갈 뿐이다.
 */
export function setLang(next: Lang): void {
  const value = parseLang(next);
  cached = value;
  try {
    window.localStorage.setItem(LANG_STORAGE_KEY, value);
  } catch {
    // 저장소를 못 쓰는 브라우저 — 이번 세션에만 적용된다
  }
  emit();
}
