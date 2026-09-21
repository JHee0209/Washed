// 서비스 이용약관 (회원가입 동의 · 05 SP3 · Issue #13 의 9번).
//
// **사전(ko.ts)이 아니라 구조화된 데이터로 둔다.** 화면이 .map() 으로 그리는 목록이고,
// 문단마다 key 를 매기면 네 언어의 문단 수를 손으로 맞춰야 한다 — 법적 동의 화면에서
// 그 drift 는 곧 고지 누락이다. 개수 · 순서는 content.test.ts 가 지킨다.
//
// ── Issue #13 이 요구한 본문 수정
// 「필수항목」 문장에 **학번을 넣었다.** 회원가입 화면은 학번을 받는데 동의 본문에는
// 빠져 있어 개인정보 수집 고지가 실제와 어긋나 있었다(05 SP3 · docs/PRD.md:124).
// 같은 문장이 개인정보 동의서(privacy.ts)에는 끝이 「주소」로 적혀 있어 두 문서가
// 서로 달랐는데, 실제로 받는 값(호실)에 맞춰 함께 통일했다.

import type { Lang } from '../lang.ts';

export type LegalSection = { heading: string; paragraphs: string[] };

const ko: LegalSection[] = [
  {
    heading: '제1조 (약관의 개정)',
    paragraphs: [
      '회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수 있으며, 적용일자 7일 전(회원에게 불리한 개정은 30일 전)부터 앱 내 공지사항 및 알림을 통해 공지합니다.',
      '필수항목: 이름, 학교 이메일 주소, 비밀번호, 성별, 소속(학교), 학번, 호실',
      '개정 약관에 동의하지 않는 회원은 언제든지 이용계약을 해지(탈퇴)할 수 있습니다. 탈퇴를 신청하면 즉시 서비스 이용이 정지되고, 14일 이내에 다시 로그인하면 계정이 복구됩니다. 복구 기간에는 같은 학교 이메일로 새로 가입할 수 없습니다.',
    ],
  },
  {
    heading: '제2조 (서비스의 성격 및 제공)',
    paragraphs: [
      '회사는 기기의 예약 및 사용 순서에 관한 정보 서비스를 제공할 뿐이며, 기기의 소유·설치·관리·수리 및 세탁 결과에 대한 주체가 아닙니다.',
      '서비스는 연중무휴 제공을 원칙으로 하나, 시스템 점검·설비 장애·기숙사 사정 등의 사유로 전부 또는 일부가 중단되거나 변경될 수 있으며, 이 경우 사전에 공지합니다. 다만 부득이한 경우 사후에 공지할 수 있습니다.',
    ],
  },
  {
    heading: '제3조 (예약 및 이용 규칙)',
    paragraphs: [
      '예약 가능 횟수, 시간, 취소 기한 등 구체적인 운영 기준은 서비스 내 안내 또는 운영정책에 따르며, 기숙사의 운영방침에 따라 변경될 수 있습니다.',
      '회원은 이용이 어려워진 경우 다른 회원을 위하여 지체 없이 예약을 취소하여야 합니다.',
      '회원이 예약 시간에 기기를 사용하지 않는 경우(노쇼) 해당 예약은 자동으로 취소될 수 있으며, 반복되는 경우 제5조에 따라 예약 이용이 제한될 수 있습니다.',
      '회원은 사용 종료 후 즉시 세탁물을 수거하여 다음 순번의 회원이 기기를 사용할 수 있도록 협조하여야 합니다.',
    ],
  },
  {
    heading: '제4조 (금지행위)',
    paragraphs: [
      '회원은 다음 행위를 하여서는 안 됩니다.',
      '타인의 계정으로 예약하거나 대리 예약하는 행위',
      '실제 사용 의사 없이 예약을 선점하거나 반복적으로 예약·취소하는 행위',
      '다른 회원의 예약 순서를 침해하거나 무단으로 기기를 사용하는 행위',
      '자동화된 수단(매크로, 봇 등)을 이용하여 예약하거나 서비스에 접속하는 행위',
      '서비스의 정상적인 운영을 방해하는 행위',
      '기타 관련 법령 또는 기숙사 운영규정에 위배되는 행위',
    ],
  },
  {
    heading: '제5조 (이용 제한)',
    paragraphs: [
      '회사는 회원이 본 약관을 위반한 경우 경고, 일정 기간 예약 제한, 서비스 이용정지 등의 조치를 단계적으로 할 수 있습니다.',
      '회사는 이용 제한 시 그 사유와 기간, 이의신청 방법을 회원에게 통지하며, 회원의 이의가 정당하다고 인정되면 즉시 이용을 재개합니다.',
    ],
  },
  {
    heading: '제6조 (면책)',
    paragraphs: [
      '회사는 세탁물의 분실, 도난, 훼손, 세탁 결과 및 기기의 고장·오작동으로 인한 손해에 대하여 책임을 지지 않습니다. 해당 사항은 기기 관리주체 또는 기숙사에 문의하여야 합니다.',
      '회사는 회원 간 예약 순서나 세탁물 처리를 둘러싸고 발생한 분쟁에 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.',
      '회사는 천재지변, 정전, 통신장애 등 불가항력이나 회원의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.',
      '본 서비스는 무료로 제공되며, 회사는 관련 법령에 특별한 규정이 없는 한 무료 서비스의 이용과 관련하여 책임을 지지 않습니다.',
      '다만 회사의 고의 또는 중대한 과실로 인한 손해에 대해서는 그러하지 아니합니다.',
    ],
  },
];

const en: LegalSection[] = [
  {
    heading: 'Article 1 (Amendment of these Terms)',
    paragraphs: [
      'The Company may amend these Terms within the limits of applicable law, and will give notice through in-app notices and notifications from 7 days before the effective date (30 days before for amendments unfavourable to members).',
      'Required items: name, school email address, password, gender, affiliation (school), student ID, room number',
      'A member who does not agree to the amended Terms may terminate the service agreement (delete their account) at any time. Once deletion is requested, service use is suspended immediately, and the account is restored if the member signs in again within 14 days. During the restore period the same school email cannot be used to sign up again.',
    ],
  },
  {
    heading: 'Article 2 (Nature and provision of the service)',
    paragraphs: [
      'The Company only provides an information service regarding machine reservations and usage order. It is not responsible for owning, installing, managing or repairing the machines, nor for laundry results.',
      'The service is in principle provided year-round, but it may be suspended or changed in whole or in part due to system maintenance, equipment failure, dormitory circumstances and similar reasons. In such cases notice will be given in advance, or afterwards where unavoidable.',
    ],
  },
  {
    heading: 'Article 3 (Reservation and usage rules)',
    paragraphs: [
      'Specific operating standards such as the number of reservations, times and cancellation deadlines follow the in-service guidance or operating policy, and may change according to the dormitory’s policy.',
      'If a member becomes unable to use a machine, they must cancel the reservation without delay for the sake of other members.',
      'If a member does not use the machine at the reserved time (no-show), the reservation may be cancelled automatically, and repeated occurrences may result in restricted reservations under Article 5.',
      'Members must collect their laundry immediately after use so that the next member in line can use the machine.',
    ],
  },
  {
    heading: 'Article 4 (Prohibited conduct)',
    paragraphs: [
      'Members must not do any of the following.',
      'Reserving with another person’s account, or reserving on someone else’s behalf',
      'Taking reservations without any intention to use them, or repeatedly reserving and cancelling',
      'Infringing another member’s reservation order, or using a machine without authorisation',
      'Using automated means (macros, bots and the like) to reserve or access the service',
      'Interfering with the normal operation of the service',
      'Any other conduct in breach of applicable law or dormitory regulations',
    ],
  },
  {
    heading: 'Article 5 (Restriction of use)',
    paragraphs: [
      'Where a member breaches these Terms, the Company may take graduated measures such as a warning, restriction of reservations for a period, or suspension of service use.',
      'When restricting use, the Company will notify the member of the reason, the period and how to object, and will resume use immediately if the member’s objection is found justified.',
    ],
  },
  {
    heading: 'Article 6 (Disclaimer)',
    paragraphs: [
      'The Company is not liable for loss, theft or damage of laundry, for laundry results, or for damage caused by machine failure or malfunction. Such matters must be raised with the party managing the machines or with the dormitory.',
      'The Company has no obligation to intervene in disputes between members over reservation order or handling of laundry, and is not liable for any resulting damage.',
      'The Company is not liable for service disruption caused by force majeure such as natural disaster, power failure or communication failure, or by causes attributable to the member.',
      'This service is provided free of charge, and unless applicable law provides otherwise the Company is not liable in connection with the use of a free service.',
      'This does not apply to damage caused by the Company’s wilful misconduct or gross negligence.',
    ],
  },
];

const zh: LegalSection[] = [
  {
    heading: '第 1 条（条款的修订）',
    paragraphs: [
      '公司可在不违反相关法令的范围内修订本条款，并自适用日期 7 日前（对会员不利的修订为 30 日前）起，通过应用内公告及通知进行公示。',
      '必填项目：姓名、学校邮箱地址、密码、性别、所属（学校）、学号、房间号',
      '不同意修订条款的会员可随时解除使用合同（注销账号）。申请注销后将立即停止服务使用，若在 14 日内重新登录，账号将被恢复。在恢复期内无法使用同一学校邮箱重新注册。',
    ],
  },
  {
    heading: '第 2 条（服务的性质与提供）',
    paragraphs: [
      '公司仅提供有关机器预约及使用顺序的信息服务，并非机器的所有、安装、管理、维修及洗涤结果的主体。',
      '服务原则上全年无休提供，但可能因系统检修、设备故障、宿舍情况等原因全部或部分中断或变更，此时将事先公告。不得已时可事后公告。',
    ],
  },
  {
    heading: '第 3 条（预约及使用规则）',
    paragraphs: [
      '可预约次数、时间、取消期限等具体运营标准依服务内指引或运营政策执行，并可能根据宿舍运营方针变更。',
      '会员在难以使用时，应为其他会员着想，立即取消预约。',
      '会员在预约时间未使用机器（爽约）时，该预约可能被自动取消；反复发生时，可依第 5 条限制预约使用。',
      '会员应在使用结束后立即取走衣物，以便下一顺位的会员使用机器。',
    ],
  },
  {
    heading: '第 4 条（禁止行为）',
    paragraphs: [
      '会员不得实施下列行为。',
      '使用他人账号预约或代为预约的行为',
      '无实际使用意愿而抢占预约，或反复预约、取消的行为',
      '侵害其他会员预约顺序，或擅自使用机器的行为',
      '利用自动化手段（宏、机器人等）预约或访问服务的行为',
      '妨碍服务正常运营的行为',
      '其他违反相关法令或宿舍运营规定的行为',
    ],
  },
  {
    heading: '第 5 条（使用限制）',
    paragraphs: [
      '会员违反本条款时，公司可分阶段采取警告、一定期间限制预约、停止服务使用等措施。',
      '公司在限制使用时，将向会员通知其事由、期间及异议申请方法；若认定会员的异议正当，将立即恢复其使用。',
    ],
  },
  {
    heading: '第 6 条（免责）',
    paragraphs: [
      '公司对衣物的遗失、失窃、损坏、洗涤结果以及机器故障、误动作所致的损害不承担责任。相关事项应向机器管理主体或宿舍咨询。',
      '公司没有介入会员之间因预约顺序或衣物处理而产生纠纷的义务，也不承担由此产生的损害赔偿责任。',
      '公司对天灾、停电、通信故障等不可抗力或因会员自身原因导致的服务使用障碍不承担责任。',
      '本服务免费提供，除相关法令另有特别规定外，公司不就免费服务的使用承担责任。',
      '但因公司故意或重大过失造成的损害不在此限。',
    ],
  },
];

const ja: LegalSection[] = [
  {
    heading: '第 1 条（規約の改定）',
    paragraphs: [
      '当社は関連法令に違反しない範囲で本規約を改定することができ、適用日の 7 日前（会員に不利な改定は 30 日前）から、アプリ内のお知らせおよび通知を通じて告知します。',
      '必須項目: 氏名、学校メールアドレス、パスワード、性別、所属（学校）、学籍番号、部屋番号',
      '改定規約に同意しない会員は、いつでも利用契約を解除（退会）できます。退会を申請すると直ちにサービスの利用が停止され、14 日以内に再度ログインするとアカウントが復旧します。復旧期間中は同じ学校メールアドレスで新規登録はできません。',
    ],
  },
  {
    heading: '第 2 条（サービスの性格および提供）',
    paragraphs: [
      '当社は機器の予約および利用順序に関する情報サービスを提供するのみであり、機器の所有・設置・管理・修理および洗濯結果の主体ではありません。',
      'サービスは年中無休での提供を原則としますが、システム点検・設備障害・寮の事情などの理由により、全部または一部が中断または変更されることがあります。この場合は事前に告知します。ただし、やむを得ない場合は事後に告知することがあります。',
    ],
  },
  {
    heading: '第 3 条（予約および利用ルール）',
    paragraphs: [
      '予約可能回数、時間、取消期限などの具体的な運営基準は、サービス内の案内または運営ポリシーに従い、寮の運営方針により変更されることがあります。',
      '会員は利用が難しくなった場合、他の会員のために遅滞なく予約を取り消さなければなりません。',
      '会員が予約時間に機器を使用しない場合（無断キャンセル）、その予約は自動的に取り消されることがあり、繰り返される場合は第 5 条に従い予約の利用が制限されることがあります。',
      '会員は利用終了後ただちに洗濯物を回収し、次の順番の会員が機器を使用できるよう協力しなければなりません。',
    ],
  },
  {
    heading: '第 4 条（禁止行為）',
    paragraphs: [
      '会員は次の行為をしてはなりません。',
      '他人のアカウントで予約する、または代理で予約する行為',
      '実際に使用する意思なく予約を先取りする、または繰り返し予約・取消する行為',
      '他の会員の予約順序を侵害する、または無断で機器を使用する行為',
      '自動化された手段（マクロ、ボットなど）を利用して予約またはサービスに接続する行為',
      'サービスの正常な運営を妨げる行為',
      'その他、関連法令または寮の運営規定に反する行為',
    ],
  },
  {
    heading: '第 5 条（利用制限）',
    paragraphs: [
      '当社は会員が本規約に違反した場合、警告、一定期間の予約制限、サービス利用停止などの措置を段階的に行うことができます。',
      '当社は利用を制限する際、その事由と期間、異議申立ての方法を会員に通知し、会員の異議が正当と認められる場合は直ちに利用を再開します。',
    ],
  },
  {
    heading: '第 6 条（免責）',
    paragraphs: [
      '当社は洗濯物の紛失、盗難、破損、洗濯結果および機器の故障・誤作動による損害について責任を負いません。該当する事項は機器の管理主体または寮にお問い合わせください。',
      '当社は会員間で予約順序や洗濯物の取り扱いをめぐって生じた紛争に介入する義務を負わず、それによる損害を賠償する責任もありません。',
      '当社は天災、停電、通信障害などの不可抗力、または会員の帰責事由によるサービス利用の障害について責任を負いません。',
      '本サービスは無料で提供され、関連法令に特別の定めがない限り、当社は無料サービスの利用に関して責任を負いません。',
      'ただし、当社の故意または重大な過失による損害についてはこの限りではありません。',
    ],
  },
];

export const TERMS: Record<Lang, LegalSection[]> = { ko, en, zh, ja };
