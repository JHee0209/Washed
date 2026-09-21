// 프로필 화면 — 이름 · 학번 · 호실은 실제 로그인 사용자 기준이어야 한다(08 · 1번).
// history · withdraw 와 같은 서버 컴포넌트 꼴이다: requireMe() 로 프로필을
// 읽어 상호작용이 많은 나머지는 그대로 클라이언트 컴포넌트에 넘긴다.

import { requireMe } from '@/lib/queries';
import ProfileClient from './profile-client';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const me = await requireMe();

  return (
    <ProfileClient name={me.name} studentId={me.studentId} room={me.room} hasPassword={me.hasPassword} />
  );
}
