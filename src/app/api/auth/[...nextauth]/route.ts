// Auth.js 가 쓰는 자리 — /api/auth/signin · /callback/google · /session · /signout 등.
// 이 파일이 없으면 구글 로그인 콜백이 돌아올 곳이 없다 (F38 · F39).
//
// Credentials 와 DB 를 쓰므로 Node 런타임이어야 한다 (엣지에는 scrypt · Neon 이 없다).

import { handlers } from '@/auth';

export const runtime = 'nodejs';

export const { GET, POST } = handlers;
