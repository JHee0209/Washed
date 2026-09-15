// 개발 및 동작 확인용: 현재 로그인된 사용자 기기로 테스트 푸시 발송
// POST /api/push/test
//
// **운영에서는 없는 길이다.** notify() 를 부르므로 누구나 부를 수 있으면 남의
// 알림함에 테스트 줄이 쌓인다. 404 로 답해 존재 자체를 드러내지 않는다.

import { auth } from '@/auth';
import { notify } from '@/lib/notify';

export const runtime = 'nodejs';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ ok: false, message: '로그인이 필요해요.' }, { status: 401 });
  }

  try {
    // 종류는 '공지' 를 쓴다 — 배정은 줄서기가 만드는 상태라 이 단계에 아직 없고,
    // '배정' 으로 찍으면 알림함에서 실제 배정과 섞여 보인다.
    await notify(
      userId,
      '공지',
      'Washed 알림 테스트',
      '푸시 알림이 정상적으로 수신되었습니다.',
    );
    return Response.json({ ok: true, message: '테스트 푸시가 발송되었습니다.' });
  } catch (error) {
    console.error('테스트 푸시 발송 실패:', error);
    return Response.json({ ok: false, message: '푸시 발송 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

