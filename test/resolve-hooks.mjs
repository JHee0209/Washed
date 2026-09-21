// 모듈 해석 훅 — node --test 가 production 모듈을 그대로 부를 수 있게 한다 (Issue #58).
//
// ── 원칙: 가로채는 것을 최소로 둔다
// 판정 로직 · SQL 은 **하나도 치환하지 않는다.** 여기서 바꾸는 것은 다섯 가지뿐이고,
// 전부 "번들러/Next 런타임이 해 주던 배관" 이다.
//
//   1. `server-only`  → 빈 모듈.  plain node 에서 throw 하는 표식용 패키지다.
//   2. `@/lib/db`     → test/db-bridge.mjs.  **드라이버만** 바꾼다 — neon-http 대신
//                       테스트 DB(PGlite) 로 같은 SQL 문자열을 보낸다.
//   3. `@/auth`       → test/stubs/auth.mjs.  세션(로그인한 사람)만 정해 준다.
//                       NextAuth 본체는 AUTH_SECRET · 구글 설정이 있어야 초기화된다.
//   4. `next/server`  → node_modules/next/server.js.  **stub 이 아니다** — next 의
//                       package.json 에 exports 맵이 없어 확장자 없는 bare subpath
//                       (`next/server`)를 node ESM 이 못 찾을 뿐이라, 실제 파일을
//                       그대로 가리킨다. NextResponse 는 진짜 구현이 돈다.
//   5. `next/cache`   → test/stubs/next-cache.mjs.  revalidatePath() 를 no-op 으로
//                       만든다(Issue #84) — Next 렌더 캐시 자체가 node --test 에는
//                       없고, user-actions.ts(requestWithdrawal · cancelWithdrawal)가
//                       이 함수를 부르는지는 어떤 판정에도 쓰이지 않는다.
//
// 그 밖의 `@/...` 는 tsconfig 의 paths 와 **같은 규칙**으로 `src/...` 에 매핑한다.
// 나머지 specifier 는 전부 기본 해석으로 넘긴다 — 그래서 기존 테스트들의 동작이
// 바뀌지 않는다 (그 파일들은 위 다섯 가지를 import 하지 않는다).

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '..');
const SRC_ROOT = path.join(REPO_ROOT, 'src');

/** 통째로 다른 파일을 가리키는 specifier */
const REDIRECTS = new Map([
  ['server-only', path.join(TEST_DIR, 'stubs', 'empty.mjs')],
  ['@/lib/db', path.join(TEST_DIR, 'db-bridge.mjs')],
  ['@/auth', path.join(TEST_DIR, 'stubs', 'auth.mjs')],
  ['next/server', path.join(REPO_ROOT, 'node_modules', 'next', 'server.js')],
  ['next/cache', path.join(TEST_DIR, 'stubs', 'next-cache.mjs')],
]);

/** `@/lib/expiration` → `<repo>/src/lib/expiration.ts` (tsconfig paths 와 같은 규칙) */
function resolveAlias(specifier) {
  const base = path.join(SRC_ROOT, specifier.slice('@/'.length));
  const candidates = [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), base];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function resolve(specifier, context, nextResolve) {
  const redirect = REDIRECTS.get(specifier);
  if (redirect) {
    // format 을 지정하지 않는다 — next/server.js 는 CJS 라, 여기서 'module' 로
    // 못 박으면 로드에 실패한다. node 가 스스로 판별하게 둔다.
    return { url: pathToFileURL(redirect).href, shortCircuit: true };
  }

  if (specifier.startsWith('@/')) {
    const resolved = resolveAlias(specifier);
    if (resolved) {
      return { url: pathToFileURL(resolved).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}
