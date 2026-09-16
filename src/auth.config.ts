// Auth.js 공통 설정 — **엣지에서도 도는 쪽**이다.
//
// 이 파일은 proxy.ts(Next 16 에서 middleware.ts 가 이 이름으로 바뀌었다)가 불러간다.
// 엣지 런타임에는 node:crypto 의 scrypt 도, Neon 드라이버도 없으므로
// **DB 를 만지는 코드와 해시 코드를 여기에 두면 안 된다.**
//
//   auth.config.ts  ← 엣지 안전. 쿠키에 든 JWT 만 읽는다. proxy.ts 가 쓴다.
//   auth.ts         ← Node 전용. Credentials · DB 조회 · 해시. 라우트 핸들러가 쓴다.
//
// 세션은 JWT 쿠키다(팀 확정 · 06 「세션은 저장 항목이 아니다」). 어댑터를 붙이지
// 않으므로 Auth.js 가 자기 표(Account · Session · User)를 만들지 않는다 —
// 사용자는 06 「사용자」 = users 표 하나뿐이다.

import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

/** 로그인해야 들어갈 수 있는 자리 (07 흐름표) */
const PROTECTED = ['/home', '/history', '/settings', '/notifications', '/profile', '/withdraw'];

/**
 * 탈퇴 복구 안내 (05 P24 · F36).
 *
 * 탈퇴를 신청한 사람이 갈 수 있는 **유일한** 보호 화면이다. 반대로 정상 계정이
 * 여기로 오면 홈으로 돌려보낸다 — 신청하지도 않은 사람에게 보일 화면이 아니다.
 */
const WITHDRAW_NOTICE = '/withdraw';

/** 로그인 전 화면 — 이미 로그인했으면 홈으로 돌려보낸다 */
const GUEST_ONLY = ['/login', '/signup', '/password-reset'];

export const authConfig = {
  session: { strategy: 'jwt' },

  pages: {
    signIn: '/login',
    error: '/login',
  },

  providers: [
    Google({
      // hd 는 **화면 힌트일 뿐** 판정이 아니다 (05 P11 · 08 · 1번).
      // 계정 선택창을 학교 계정 쪽으로 기울이기만 하고, `ac.kr` 자격은
      // auth.ts 의 signIn 콜백에서 서버가 이메일 끝을 보고 판단한다.
      authorization: {
        params: { prompt: 'select_account', hd: process.env.GOOGLE_HD_HINT ?? '' },
      },
    }),
    // Credentials(이메일 · 비밀번호)는 DB 와 해시가 필요해 auth.ts 에서 붙인다.
  ],

  callbacks: {
    /**
     * proxy.ts 가 부르는 자리. 여기서는 **토큰만 본다** — DB 를 읽지 않는다.
     *
     * pendingSignup 은 구글로 처음 들어왔는데 users 에 아직 줄이 없는 사람이다.
     * 05 P11: 「구글 로그인은 가입 경로를 겸한다 — 성별 · 소속 · 학번 · 호실 ·
     * 약관 동의를 채워야 가입이 끝나고, 그 전까지는 사용자로 치지 않는다.」
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;

      // 관리자 콘솔은 **사생 세션과 무관하다** — 쿠키가 다르고(washed-admin),
      // 검사는 requireAdmin() 이 서버에서 한다. 여기서 막으면 관리자가
      // 사생으로 로그인해야 들어갈 수 있게 되어 둘이 섞인다.
      if (pathname.startsWith('/admin')) return true;
      const token = auth?.user;
      const signedIn = Boolean(token);
      const pending = Boolean(auth?.pendingSignup);

      // 가입을 끝내지 않은 구글 사용자는 회원가입 구글 모드로만 갈 수 있다
      if (pending) {
        if (pathname.startsWith('/signup')) return true;
        return Response.redirect(new URL('/signup?google=1', request.nextUrl));
      }

      const inProtected = PROTECTED.some((p) => pathname.startsWith(p));

      // 05 P24 — 탈퇴를 신청하면 즉시 이용이 정지되고 복구 안내만 볼 수 있다.
      // **로그인 자체는 막지 않는다**(auth.ts 의 authorize 가 통과시킨다) — 잠가 두면
      // 복구할 길까지 함께 막힌다. 대신 홈으로 가려는 것을 여기서 가른다(07 흐름표
      // 「탈퇴 대기 계정으로 로그인하면 → 복구 안내」).
      if (signedIn && Boolean(auth?.withdrawPending)) {
        if (pathname.startsWith(WITHDRAW_NOTICE)) return true;
        if (inProtected || GUEST_ONLY.some((p) => pathname.startsWith(p))) {
          return Response.redirect(new URL(WITHDRAW_NOTICE, request.nextUrl));
        }
        return true;
      }

      // 탈퇴를 신청하지 않은 사람에게는 복구 안내가 보일 이유가 없다.
      if (signedIn && pathname.startsWith(WITHDRAW_NOTICE)) {
        return Response.redirect(new URL('/home', request.nextUrl));
      }

      if (inProtected) return signedIn;

      if (signedIn && GUEST_ONLY.some((p) => pathname.startsWith(p))) {
        return Response.redirect(new URL('/home', request.nextUrl));
      }

      return true;
    },

    /** 쿠키에 든 것을 화면이 읽는 모양으로 옮긴다 */
    session({ session, token }) {
      session.user.id = (token.userId as string) ?? '';
      session.user.email = (token.email as string) ?? '';
      session.user.name = (token.name as string) ?? '';
      session.pendingSignup = Boolean(token.pendingSignup);
      // 05 P24 — 라우트 핸들러가 추가 조회 없이 탈퇴 대기 여부를 볼 수 있게 한다.
      session.withdrawPending = Boolean(token.withdrawPending);
      return session;
    },
  },
} satisfies NextAuthConfig;
