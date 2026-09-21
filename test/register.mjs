// node --test 진입점에서 모듈 해석 훅을 등록한다 (Issue #58).
//
// package.json 의 test 스크립트가 `node --import ./test/register.mjs --test ...` 로
// 이 파일을 먼저 읽는다. 여기서 하는 일은 훅 등록 한 줄뿐이고, 실제 규칙은
// resolve-hooks.mjs 에 있다 (module.register 는 훅을 별도 파일로 요구한다).
//
// ── 왜 필요한가
// 이 저장소의 상태 전환 코드는 전부 `import 'server-only'` 와 `@/...` 별칭을 쓴다.
// 별칭은 번들러가 푸는 것이라 node 런타임에는 없고, server-only 는 plain node 에서
// throw 한다. 그래서 지금까지 `scheduler.test.ts` · `queue-read-only.test.ts` 는
// 모듈을 부르지 못하고 **소스 텍스트를 정규식으로 검사**하는 방식으로 우회했다.
// 이 훅이 그 두 가지만 풀어 주면, 테스트가 production 함수를 그대로 부를 수 있다.

import { register } from 'node:module';

register('./resolve-hooks.mjs', import.meta.url);
