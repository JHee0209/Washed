// 루트 진입점.
//
// 첫 진입에서는 docs/design/스플래시 (온보딩).dc.html 기반의 Washed 스플래시를
// 잠깐 보여 준 뒤, 서버에서 이미 판정한 인증 상태에 따라 홈 또는 로그인으로 이동한다.
//
// 인증 판정은 기존과 동일하게 서버의 auth()를 사용한다. pendingSignup · withdrawPending
// 같은 세부 분기는 /home 요청을 받은 auth.config.ts::authorized()가 다시 처리하므로
// 여기서 중복 구현하지 않는다.

import { auth } from '@/auth';
import SplashClient from './splash-client';

export default async function RootPage() {
  const session = await auth();
  const target = session?.user ? '/home' : '/login';

  return <SplashClient target={target} />;
}
