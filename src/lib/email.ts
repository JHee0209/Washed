// 메일 발송 — Resend (팀 확정)
//
// 인증코드 메일만 보낸다. 알림은 폰 알림(푸시)으로 나가고 메일로 보내지 않는다(05 P26).
//
// .env.local 에 필요한 것
//   RESEND_API_KEY   Resend 콘솔에서 발급 (re_ 로 시작)
//   MAIL_FROM        보내는 주소. 도메인을 Resend 에 등록해야 실제 발송이 된다.
//                    등록 전에는 Resend 가 주는 onboarding@resend.dev 로만 나가고,
//                    그 주소는 **가입한 본인 메일로만** 보낼 수 있다.
//
// RESEND_API_KEY 가 없으면 보내지 않고 서버 콘솔에 코드를 찍는다 — 로컬 개발용이다.
// 운영에서는 키가 없으면 그대로 실패해야 하므로 NODE_ENV 로 갈라 둔다.

import 'server-only';

type Purpose = '회원가입' | '비밀번호 재설정';

const SUBJECTS: Record<Purpose, string> = {
  회원가입: '[Washed] 회원가입 인증번호',
  '비밀번호 재설정': '[Washed] 비밀번호 재설정 인증코드',
};

// 메일 본문은 번역하지 않는다 — 로그인 전이라 서버가 사용자 언어를 알 수 없다.
// (08 · 11번 — 서버가 만드는 문장의 언어 문제와 같은 건이다. 지금은 한국어 + 영어 병기)
function renderHtml(purpose: Purpose, code: string, minutes: number): string {
  const lead =
    purpose === '회원가입'
      ? '회원가입을 계속하려면 아래 인증번호를 입력해주세요.'
      : '비밀번호를 재설정하려면 아래 인증코드를 입력해주세요.';

  return `<!doctype html>
<html lang="ko"><body style="margin:0;background:#F3F6FB;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Pretendard,sans-serif">
  <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:16px;padding:32px 28px">
    <div style="font-size:15px;font-weight:800;color:#2F63B8;margin-bottom:20px">Washed</div>
    <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1E3557">${SUBJECTS[purpose].replace('[Washed] ', '')}</p>
    <p style="margin:0 0 22px;font-size:13px;line-height:1.7;color:#7C8CA6">${lead}</p>
    <div style="background:#F3F6FB;border-radius:12px;padding:18px;text-align:center;font-size:30px;font-weight:800;letter-spacing:8px;color:#1E3557">${code}</div>
    <p style="margin:18px 0 0;font-size:12px;line-height:1.7;color:#8FAAD0">
      ${minutes}분 안에 입력해주세요. 시간이 지나면 다시 받아야 합니다.<br>
      본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.
    </p>
    <hr style="border:none;border-top:1px solid #E3EBF7;margin:24px 0">
    <p style="margin:0;font-size:11.5px;line-height:1.7;color:#A8BCD9">
      메일이 오지 않으면 스팸함을 확인해주세요.<br>
      그래도 받지 못했다면 관리자(031-740-7700 · 평일 09:00~18:00)에게 연락주세요.
    </p>
  </div>
</body></html>`;
}

export async function sendVerificationCode(
  to: string,
  purpose: Purpose,
  code: string,
  minutes: number,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('RESEND_API_KEY · MAIL_FROM 이 없습니다. 메일을 보낼 수 없습니다.');
    }
    // 로컬 개발: 실제로 보내지 않고 콘솔에만 찍는다.
    // 이 경로는 개발에서만 돈다 — 코드는 응답으로 내려가지 않는다 (08 · 1번).
    console.info(`[메일 생략] ${to} · ${purpose} · 코드 ${code} · ${minutes}분`);
    return;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: SUBJECTS[purpose],
      html: renderHtml(purpose, code, minutes),
    }),
  });

  if (!res.ok) {
    // 본문에 코드가 들어 있으므로 응답 전체를 그대로 로그에 남기지 않는다.
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend 발송 실패 (${res.status}) ${detail.slice(0, 200)}`);
  }
}
