// 개인정보 수집 · 이용 동의서 (회원가입 동의 · 05 SP3 · Issue #13 의 9번).
//
// terms.ts 와 같은 이유로 사전이 아니라 구조화된 데이터다.
//
// ── Issue #13 이 요구한 본문 수정 두 가지
// ① 「필수항목」에 **학번을 넣었다.** 회원가입 화면은 학번을 받는데 동의 본문에는
//    빠져 있었다(05 SP3 · docs/PRD.md:124). 옮겨 오기 전 이 문장은 끝이 「주소」였고
//    이용약관 쪽은 「호실」이라 두 문서가 서로 달랐는데, 실제로 받는 값에 맞춰
//    두 문서를 같은 문장으로 통일했다.
// ② **전화번호 관련 문장을 없앴다.** 05 SP3 은 「전화번호는 수집하지 않는다」이고
//    회원가입 · 프로필 어디에서도 받지 않는데, 7번 문의 항목에 「전화: [고객지원번호]」
//    가 남아 있었다. 옮기지 않는 방식으로 제거한다.
//
// 7번의 「이메일: [고객지원이메일]」은 아직 채워지지 않은 자리표시자 그대로 옮겼다 —
// 값을 지어낼 수 없고, 이번 Issue 가 요구한 것은 전화번호 제거뿐이다.

import type { Lang } from '../lang.ts';
import type { LegalSection } from './terms.ts';

export type PrivacyDoc = { intro: string; sections: LegalSection[] };

const ko: PrivacyDoc = {
  intro: 'Washed는 다음과 같이 개인정보를 수집·이용합니다.',
  sections: [
    {
      heading: '1. 수집하는 개인정보 항목',
      paragraphs: [
        '필수항목: 이름, 학교 이메일 주소, 비밀번호, 성별, 소속(학교), 학번, 호실',
        '수집방법: 회원가입 시 직접 입력',
      ],
    },
    {
      heading: '2. 개인정보의 수집 및 이용 목적',
      paragraphs: [
        '회원 가입 및 관리',
        '서비스 제공 및 계약이행',
        '이용자 식별 및 인증',
        '서비스 개선 및 신규 서비스 개발',
        '통지, 공지사항 전달 등 커뮤니케이션',
        '법적 의무 이행',
      ],
    },
    {
      heading: '3. 개인정보의 보유 및 이용 기간',
      paragraphs: [
        '보유기간: 회원 탈퇴 신청일로부터 14일까지. 탈퇴 신청 후 14일 이내에 다시 로그인하면 계정이 복구되며, 14일이 지나면 모든 개인정보를 영구 파기합니다. 세탁실 이용 내역 · 신고(증거 사진 포함)는 분쟁 처리를 위해 3개월간, 경고 기록은 1개월간 보관하며, 각 기간이 지나거나 탈퇴 후 14일이 지나거나 둘 중 먼저 오는 때에 파기합니다.',
        '동의 철회 시: 탈퇴 신청 후 14일의 복구 기간이 지나면 지체 없이 파기합니다 (단, 법령에서 일정 기간 보관을 의무화하는 경우는 제외)',
      ],
    },
    {
      heading: '4. 개인정보 처리의 위탁',
      paragraphs: [
        '필요한 경우 다음과 같이 개인정보 처리를 위탁할 수 있습니다:',
        '이메일 발송 서비스 제공업체',
        '클라우드 서버 운영업체',
      ],
    },
    {
      heading: '5. 정보주체의 권리',
      paragraphs: [
        '귀하는 언제든지 다음의 권리를 행사할 수 있습니다:',
        '개인정보 열람 요청',
        '오류 정정 요청',
        '삭제 요청',
        '처리 정지 요청',
      ],
    },
    {
      heading: '6. 개인정보 보안',
      paragraphs: ['당사는 개인정보 보호를 위해 물리적, 기술적, 관리적 안전조치를 취합니다.'],
    },
    {
      heading: '7. 문의',
      paragraphs: ['개인정보 관련 문의사항이 있으신 경우:', '이메일: [고객지원이메일]'],
    },
  ],
};

const en: PrivacyDoc = {
  intro: 'Washed collects and uses personal data as set out below.',
  sections: [
    {
      heading: '1. Personal data collected',
      paragraphs: [
        'Required items: name, school email address, password, gender, affiliation (school), student ID, room number',
        'Method of collection: entered directly at sign-up',
      ],
    },
    {
      heading: '2. Purpose of collection and use',
      paragraphs: [
        'Sign-up and account management',
        'Providing the service and performing the agreement',
        'Identifying and authenticating users',
        'Improving the service and developing new services',
        'Communication such as notifications and notices',
        'Meeting legal obligations',
      ],
    },
    {
      heading: '3. Retention and use period',
      paragraphs: [
        'Retention period: until 14 days from the date account deletion is requested. If you sign in again within 14 days of requesting deletion your account is restored; after 14 days all personal data is permanently destroyed. Laundry usage history and reports (including photo evidence) are kept for 3 months and warning records for 1 month for dispute handling, and are destroyed when that period ends or 14 days after deletion, whichever comes first.',
        'On withdrawal of consent: data is destroyed without delay once the 14-day restore period following the deletion request has passed (except where law requires retention for a set period).',
      ],
    },
    {
      heading: '4. Outsourcing of personal data processing',
      paragraphs: [
        'Where necessary, processing of personal data may be outsourced as follows:',
        'Email delivery service providers',
        'Cloud server operators',
      ],
    },
    {
      heading: '5. Rights of the data subject',
      paragraphs: [
        'You may exercise the following rights at any time:',
        'Request access to your personal data',
        'Request correction of errors',
        'Request deletion',
        'Request suspension of processing',
      ],
    },
    {
      heading: '6. Security of personal data',
      paragraphs: ['We take physical, technical and administrative safeguards to protect personal data.'],
    },
    {
      heading: '7. Contact',
      paragraphs: ['If you have any questions about personal data:', 'Email: [고객지원이메일]'],
    },
  ],
};

const zh: PrivacyDoc = {
  intro: 'Washed 按以下方式收集和使用个人信息。',
  sections: [
    {
      heading: '1. 收集的个人信息项目',
      paragraphs: [
        '必填项目：姓名、学校邮箱地址、密码、性别、所属（学校）、学号、房间号',
        '收集方式：注册时直接输入',
      ],
    },
    {
      heading: '2. 个人信息的收集及使用目的',
      paragraphs: [
        '会员注册及管理',
        '提供服务及履行合同',
        '用户识别及认证',
        '服务改进及新服务开发',
        '通知、公告传达等沟通',
        '履行法律义务',
      ],
    },
    {
      heading: '3. 个人信息的保有及使用期间',
      paragraphs: [
        '保有期间：自申请注销之日起 14 日。申请注销后 14 日内重新登录，账号将被恢复；超过 14 日后将永久销毁全部个人信息。洗衣房使用记录及举报（含证据照片）为处理纠纷保存 3 个月，警告记录保存 1 个月，在各期限届满或注销后满 14 日中较早到来时销毁。',
        '撤回同意时：注销申请后 14 日的恢复期届满后立即销毁（但法令规定须保存一定期间的情形除外）。',
      ],
    },
    {
      heading: '4. 个人信息处理的委托',
      paragraphs: [
        '必要时可按以下方式委托处理个人信息：',
        '邮件发送服务提供商',
        '云服务器运营商',
      ],
    },
    {
      heading: '5. 信息主体的权利',
      paragraphs: [
        '您可随时行使以下权利：',
        '要求查阅个人信息',
        '要求更正错误',
        '要求删除',
        '要求停止处理',
      ],
    },
    {
      heading: '6. 个人信息安全',
      paragraphs: ['本公司为保护个人信息采取物理、技术及管理上的安全措施。'],
    },
    {
      heading: '7. 咨询',
      paragraphs: ['如有个人信息相关咨询事项：', '邮箱：[고객지원이메일]'],
    },
  ],
};

const ja: PrivacyDoc = {
  intro: 'Washed は次のとおり個人情報を収集・利用します。',
  sections: [
    {
      heading: '1. 収集する個人情報の項目',
      paragraphs: [
        '必須項目: 氏名、学校メールアドレス、パスワード、性別、所属（学校）、学籍番号、部屋番号',
        '収集方法: 会員登録時に直接入力',
      ],
    },
    {
      heading: '2. 個人情報の収集および利用目的',
      paragraphs: [
        '会員登録および管理',
        'サービスの提供および契約の履行',
        '利用者の識別および認証',
        'サービスの改善および新規サービスの開発',
        '通知、お知らせの伝達などのコミュニケーション',
        '法的義務の履行',
      ],
    },
    {
      heading: '3. 個人情報の保有および利用期間',
      paragraphs: [
        '保有期間: 退会申請日から 14 日まで。退会申請後 14 日以内に再度ログインするとアカウントが復旧し、14 日を過ぎるとすべての個人情報を完全に破棄します。ランドリールームの利用履歴・通報（証拠写真を含む）は紛争処理のため 3 か月間、警告の記録は 1 か月間保管し、それぞれの期間が過ぎたとき、または退会後 14 日が過ぎたときのいずれか早い時点で破棄します。',
        '同意の撤回時: 退会申請後 14 日の復旧期間が過ぎたら遅滞なく破棄します（ただし、法令で一定期間の保管が義務づけられている場合を除く）。',
      ],
    },
    {
      heading: '4. 個人情報の取扱いの委託',
      paragraphs: [
        '必要な場合、次のとおり個人情報の取扱いを委託することがあります:',
        'メール送信サービス提供事業者',
        'クラウドサーバー運営事業者',
      ],
    },
    {
      heading: '5. 情報主体の権利',
      paragraphs: [
        'お客様はいつでも次の権利を行使できます:',
        '個人情報の開示請求',
        '誤りの訂正請求',
        '削除請求',
        '取扱いの停止請求',
      ],
    },
    {
      heading: '6. 個人情報のセキュリティ',
      paragraphs: ['当社は個人情報の保護のため、物理的・技術的・管理的な安全措置を講じています。'],
    },
    {
      heading: '7. お問い合わせ',
      paragraphs: ['個人情報に関するお問い合わせは:', 'メール: [고객지원이메일]'],
    },
  ],
};

export const PRIVACY: Record<Lang, PrivacyDoc> = { ko, en, zh, ja };
