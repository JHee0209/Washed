// Auth.js 본체 — Node 런타임 전용 (DB · 해시를 쓴다).
//
// F38 로그인 · F39 구글 로그인 (05 P11 · P24 · 07 흐름표)
//
// 규칙 셋 (전부 05 P11 에서 온다)
//   1. 아이디(학교 이메일)가 같으면 가입 방식이 달라도 **같은 계정**이다.
//      구글로 들어와도 계정을 새로 만들지 않고 이메일로 users 를 찾는다.
//   2. 어느 수단으로 로그인되는지는 「가입 방식」이 아니라 **password_hash 가
//      비었는지**로 판단한다. 비어 있으면 구글로만 들어올 수 있다.
//   3. `ac.kr` 자격은 **서버가 이메일 끝을 보고** 판단한다 — 구글의 hd 가 아니다.

import NextAuth, { CredentialsSignin, type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authConfig } from '@/auth.config';
import { sql } from '@/lib/db';
import { verify } from '@/lib/hash';
import { isSchoolEmail, normalizeEmail } from '@/lib/school-email';

/**
 * 구글로 가입해 비밀번호가 없는 계정에 이메일 로그인을 시도했을 때 (05 P11 · PRD 6절).
 *
 * `code` 가 그대로 `?error=` 값이 된다 — 화면은 이것을 보고
 * "구글 간편로그인으로 가입한 계정이에요" 를 띄우고 구글 버튼을 강조한다.
 * 비밀번호가 틀린 경우(기본 CredentialsSignin)와 구별되어야 한다.
 */
class GoogleOnlyAccountError extends CredentialsSignin {
  code = 'google_only';
}

declare module 'next-auth' {
  interface Session {
    /** 구글로 들어왔지만 아직 가입 폼을 채우지 않은 사람 (05 P11) */
    pendingSignup?: boolean;
    user: { id: string } & DefaultSession['user'];
  }
}

type UserRow = {
  user_id: string;
  name: string;
  email: string;
  password_hash: string | null;
  withdraw_requested_at: string | null;
};

async function findByEmail(email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow>`
    SELECT user_id, name, email, password_hash, withdraw_requested_at
      FROM users
     WHERE email = ${email}
     LIMIT 1
  `;
  return rows[0] ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    ...authConfig.providers,

    Credentials({
      // F38 — 로그인 화면의 이메일 · 비밀번호
      credentials: {
        email: { label: '학교 이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },

      async authorize(raw) {
        const email = normalizeEmail(raw?.email);
        const password = typeof raw?.password === 'string' ? raw.password : '';
        if (!email || !password || !isSchoolEmail(email)) return null;

        const user = await findByEmail(email);
        if (!user) return null;

        // 05 P11 · PRD 6절 — 비밀번호 칸이 비어 있으면 구글로만 들어올 수 있다.
        // 「만들기 전까지 F38 은 "구글 계정으로 로그인해주세요" 로 돌려보낸다」가
        // PRD 6절의 문장이라, 그냥 실패시키지 않고 화면이 갈라 볼 수 있게 한다.
        //
        // Auth.js 는 authorize 가 던진 에러를 `?error=<type>` 으로 넘겨준다.
        // 화면은 error 값을 보고 "구글 계정으로 로그인해주세요" 를 띄운다.
        if (!user.password_hash) {
          throw new GoogleOnlyAccountError();
        }

        // 05 P24 — 탈퇴 대기 중에는 홈 대신 복구 안내로 간다.
        // 여기서 막지 않고 통과시킨 뒤 홈 진입에서 가르는 것이 07 흐름표와 맞다.
        if (!(await verify(password, user.password_hash))) return null;

        return { id: user.user_id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

    /**
     * 구글로 들어온 사람의 자격을 서버가 본다 (05 P11 · 08 · 1번).
     * `ac.kr` 이 아니면 여기서 끊는다 — hd 파라미터는 믿지 않는다.
     */
    async signIn({ account, profile }) {
      if (account?.provider !== 'google') return true;

      // 구글이 메일 소유를 확인해 준 계정만 받는다. 확인되지 않은 주소를
      // 그대로 믿으면 남의 학교 이메일로 계정을 가로챌 수 있다.
      if (profile?.email_verified !== true) return false;

      const email = normalizeEmail(profile?.email);
      if (!isSchoolEmail(email)) {
        // 07 화면 문구: "학교 구글 계정만 이용할 수 있어요"
        return '/login?error=not_school_account';
      }
      return true;
    },

    /**
     * 토큰을 채운다. **매번 DB 를 읽는다** — 세션 표가 없어서(JWT 쿠키)
     * 탈퇴(P24) 같은 즉시 반영이 필요한 판정을 쿠키에 맡길 수 없기 때문이다
     * (06 「세션은 저장 항목이 아니다」).
     */
    async jwt({ token, user }) {
      const email = normalizeEmail(user?.email ?? token.email);
      if (!email) return token;

      token.email = email;

      const row = await findByEmail(email);
      if (!row) {
        // 05 P11 — 구글로 처음 들어온 사람. 아직 사용자로 치지 않는다.
        token.userId = undefined;
        token.pendingSignup = true;
        return token;
      }

      token.userId = row.user_id;
      token.name = row.name;
      token.pendingSignup = false;
      return token;
    },
  },
});
