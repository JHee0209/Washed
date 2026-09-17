// 홈 화면 진입점 (Issue #29).
//
// 지금까지 이 파일 전체가 'use client'였다 — proxy.ts의 authorized()만이 유일한
// 방어선이었고, /history · /settings · /profile 처럼 requireMe() 가 있는 서버 측
// 2차 확인이 없었다. 다른 보호 페이지와 같은 패턴으로 맞춘다.
import { requireMe } from '@/lib/queries';
import HomeClient from './home-client';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await requireMe();
  return <HomeClient />;
}
