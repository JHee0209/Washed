/* 약관 · 개인정보 동의서 번역 — i18n.js 이후에 로드 */
(function () {
  var I = window.__washedI18N;
  if (!I) return;
  var D = I.DICT;
  var EXTRA = {
    // ── 서비스 이용약관 ──
    '제1조 (약관의 개정)': ['Article 1 (Amendment of these Terms)', '第1条（条款的修订）', '第1条（規約の改定）'],
    '회사는 관련 법령을 위반하지 않는 범위에서 본 약관을 개정할 수 있으며, 적용일자 7일 전(회원에게 불리한 개정은 30일 전)부터 앱 내 공지사항 및 알림을 통해 공지합니다.': ['The Company may amend these Terms within the limits of applicable law, and will announce any amendment in the app\u2019s notices and notifications from 7 days before the effective date (30 days before for amendments unfavourable to members).', '本公司可在不违反相关法令的范围内修订本条款，并自适用日期前7日（对会员不利的修订为前30日）起通过应用内公告及通知进行告知。', '当社は関連法令に違反しない範囲で本規約を改定でき、適用日の7日前（会員に不利な改定は30日前）からアプリ内のお知らせおよび通知にて告知します。'],
    '필수항목: 이름, 이메일, 학교 이메일 주소, 비밀번호, 성별, 소속(학교), 호실': ['Required: name, email, school email address, password, gender, school, room number', '必填项：姓名、邮箱、学校邮箱地址、密码、性别、所属（学校）、房间号', '必須項目：氏名、メール、学校メールアドレス、パスワード、性別、所属（学校）、部屋番号'],
    '개정 약관에 동의하지 않는 회원은 언제든지 이용계약을 해지(탈퇴)할 수 있습니다. 탈퇴를 신청하면 즉시 서비스 이용이 정지되고, 14일 이내에 다시 로그인하면 계정이 복구됩니다. 복구 기간에는 같은 학교 이메일로 새로 가입할 수 없습니다.': ['A member who does not agree to the amended Terms may terminate the service agreement (delete their account) at any time. Once deletion is requested, service use stops immediately; signing in again within 14 days restores the account. During the restoration period you cannot sign up again with the same school email.', '不同意修订条款的会员可随时解除使用合同（注销）。申请注销后将立即停止使用服务，14日内重新登录即可恢复账号。在恢复期内无法使用同一学校邮箱重新注册。', '改定規約に同意しない会員はいつでも利用契約を解除（退会）できます。退会を申請すると直ちにサービス利用が停止され、14日以内に再度ログインするとアカウントが復元されます。復元期間中は同じ学校メールで新規登録はできません。'],

    '제2조 (서비스의 성격 및 제공)': ['Article 2 (Nature and Provision of the Service)', '第2条（服务的性质及提供）', '第2条（サービスの性格および提供）'],
    '회사는 기기의 예약 및 사용 순서에 관한 정보 서비스를 제공할 뿐이며, 기기의 소유·설치·관리·수리 및 세탁 결과에 대한 주체가 아닙니다.': ['The Company only provides an information service covering machine reservations and usage order; it is not responsible for owning, installing, managing or repairing the machines, or for laundry results.', '本公司仅提供有关设备预约及使用顺序的信息服务，并非设备的所有、安装、管理、维修及洗涤结果的责任主体。', '当社は機器の予約および使用順序に関する情報サービスを提供するのみであり、機器の所有・設置・管理・修理および洗濯結果の主体ではありません。'],
    '서비스는 연중무휴 제공을 원칙으로 하나, 시스템 점검·설비 장애·기숙사 사정 등의 사유로 전부 또는 일부가 중단되거나 변경될 수 있으며, 이 경우 사전에 공지합니다. 다만 부득이한 경우 사후에 공지할 수 있습니다.': ['The Service is provided year-round in principle, but may be suspended or changed in whole or in part due to system maintenance, equipment failure, dormitory circumstances and the like. Such changes are announced in advance, or afterwards where unavoidable.', '服务原则上全年无休提供，但因系统维护、设备故障、宿舍情况等原因可能全部或部分中断或变更，此时将提前公告。如遇不得已情况，可事后公告。', 'サービスは年中無休の提供を原則としますが、システム点検・設備障害・寮の事情などにより全部または一部が中断・変更されることがあり、その場合は事前に告知します。ただしやむを得ない場合は事後に告知することがあります。'],

    '제3조 (예약 및 이용 규칙)': ['Article 3 (Reservation and Usage Rules)', '第3条（预约及使用规则）', '第3条（予約および利用ルール）'],
    '예약 가능 횟수, 시간, 취소 기한 등 구체적인 운영 기준은 서비스 내 안내 또는 운영정책에 따르며, 기숙사의 운영방침에 따라 변경될 수 있습니다.': ['Specific operating standards such as the number of reservations allowed, times and cancellation deadlines follow the in-service guidance or operating policy, and may change according to dormitory policy.', '可预约次数、时间、取消期限等具体运营标准依照服务内指引或运营政策，并可能根据宿舍运营方针变更。', '予約可能回数、時間、キャンセル期限などの具体的な運用基準はサービス内の案内または運営方針に従い、寮の運営方針により変更されることがあります。'],
    '회원은 이용이 어려워진 경우 다른 회원을 위하여 지체 없이 예약을 취소하여야 합니다.': ['If a member becomes unable to use a machine, they must cancel the reservation without delay for the sake of other members.', '会员如无法使用，应为其他会员着想立即取消预约。', '会員は利用が difficult になった場合、他の会員のために遅滞なく予約を取り消さなければなりません。'],
    '회원이 예약 시간에 기기를 사용하지 않는 경우(노쇼) 해당 예약은 자동으로 취소될 수 있으며, 반복되는 경우 제5조에 따라 예약 이용이 제한될 수 있습니다.': ['If a member does not use the machine at the reserved time (no-show), the reservation may be cancelled automatically, and repeated no-shows may lead to restrictions under Article 5.', '会员在预约时间未使用设备（爽约）时，该预约可能被自动取消；反复发生的，可依第5条限制预约使用。', '会員が予約時間に機器を使用しない場合（ノーショー）、当該予約は自動的に取り消されることがあり、繰り返される場合は第5条により予約利用が制限されることがあります。'],
    '회원은 사용 종료 후 즉시 세탁물을 수거하여 다음 순번의 회원이 기기를 사용할 수 있도록 협조하여야 합니다.': ['Members must collect their laundry immediately after use so that the next member in line can use the machine.', '会员应在使用结束后立即取走衣物，配合下一位会员使用设备。', '会員は使用終了後ただちに洗濯物を回収し、次の順番の会員が機器を使用できるよう協力しなければなりません。'],

    '제4조 (금지행위)': ['Article 4 (Prohibited Conduct)', '第4条（禁止行为）', '第4条（禁止行為）'],
    '회원은 다음 행위를 하여서는 안 됩니다.': ['Members must not engage in the following conduct.', '会员不得进行以下行为。', '会員は次の行為をしてはなりません。'],
    '타인의 계정으로 예약하거나 대리 예약하는 행위': ['Reserving with another person\u2019s account or reserving on their behalf', '使用他人账号预约或代为预约', '他人のアカウントで予約し、または代理で予約する行為'],
    '실제 사용 의사 없이 예약을 선점하거나 반복적으로 예약·취소하는 행위': ['Holding reservations without intending to use them, or repeatedly reserving and cancelling', '无实际使用意愿而抢占预约，或反复预约与取消', '実際に使用する意思なく予約を占有し、または繰り返し予約・取消をする行為'],
    '다른 회원의 예약 순서를 침해하거나 무단으로 기기를 사용하는 행위': ['Infringing another member\u2019s place in the queue or using a machine without authorisation', '侵害其他会员的预约顺序或擅自使用设备', '他の会員の予約順序を侵害し、または無断で機器を使用する行為'],
    '자동화된 수단(매크로, 봇 등)을 이용하여 예약하거나 서비스에 접속하는 행위': ['Using automated means (macros, bots, etc.) to reserve or access the Service', '利用自动化手段（宏、机器人等）预约或访问服务', '自動化された手段（マクロ、ボット等）を利用して予約またはサービスに接続する行為'],
    '서비스의 정상적인 운영을 방해하는 행위': ['Interfering with the normal operation of the Service', '妨碍服务正常运营的行为', 'サービスの正常な運営を妨げる行為'],
    '기타 관련 법령 또는 기숙사 운영규정에 위배되는 행위': ['Any other conduct contrary to applicable law or dormitory regulations', '其他违反相关法令或宿舍运营规定的行为', 'その他関連法令または寮の運営規程に反する行為'],

    '제5조 (이용 제한)': ['Article 5 (Restrictions on Use)', '第5条（使用限制）', '第5条（利用制限）'],
    '회사는 회원이 본 약관을 위반한 경우 경고, 일정 기간 예약 제한, 서비스 이용정지 등의 조치를 단계적으로 할 수 있습니다.': ['If a member breaches these Terms, the Company may take graduated measures such as a warning, a temporary reservation restriction, or suspension of service.', '会员违反本条款时，本公司可分阶段采取警告、限期限制预约、暂停服务等措施。', '会員が本規約に違反した場合、当社は警告、一定期間の予約制限、サービス利用停止などの措置を段階的に行うことができます。'],
    '회사는 이용 제한 시 그 사유와 기간, 이의신청 방법을 회원에게 통지하며, 회원의 이의가 정당하다고 인정되면 즉시 이용을 재개합니다.': ['When imposing a restriction, the Company notifies the member of the reason, the period and how to appeal, and reinstates access immediately if the appeal is found justified.', '实施使用限制时，本公司将向会员告知事由、期限及申诉方法；如认定申诉正当，将立即恢复使用。', '当社は利用制限の際、その理由と期間、異議申立ての方法を会員に通知し、会員の異議が正当と認められる場合は直ちに利用を再開します。'],

    '제6조 (면책)': ['Article 6 (Disclaimer)', '第6条（免责）', '第6条（免責）'],
    '회사는 세탁물의 분실, 도난, 훼손, 세탁 결과 및 기기의 고장·오작동으로 인한 손해에 대하여 책임을 지지 않습니다. 해당 사항은 기기 관리주체 또는 기숙사에 문의하여야 합니다.': ['The Company is not liable for loss, theft or damage to laundry, for laundry results, or for damage caused by machine failure or malfunction. Such matters must be raised with the machine operator or the dormitory.', '本公司对衣物的丢失、被盗、损坏、洗涤结果以及设备故障或误操作造成的损害不承担责任。相关事项应向设备管理方或宿舍咨询。', '当社は洗濯物の紛失、盗難、破損、洗濯結果および機器の故障・誤作動による損害について責任を負いません。当該事項は機器の管理主体または寮にお問い合わせください。'],
    '회사는 회원 간 예약 순서나 세탁물 처리를 둘러싸고 발생한 분쟁에 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이 없습니다.': ['The Company has no obligation to intervene in disputes between members over queue order or handling of laundry, and is not liable for resulting damage.', '本公司无义务介入会员之间围绕预约顺序或衣物处理产生的纠纷，亦不承担由此造成的损害赔偿责任。', '当社は会員間の予約順序や洗濯物の取り扱いをめぐって生じた紛争に介入する義務はなく、これによる損害を賠償する責任も負いません。'],
    '회사는 천재지변, 정전, 통신장애 등 불가항력이나 회원의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.': ['The Company is not liable for service disruptions caused by force majeure such as natural disasters, power outages or network failures, or by causes attributable to the member.', '本公司对因天灾、停电、通信故障等不可抗力或会员自身原因导致的服务使用障碍不承担责任。', '当社は天災地変、停電、通信障害などの不可抗力または会員の帰責事由によるサービス利用障害について責任を負いません。'],
    '본 서비스는 무료로 제공되며, 회사는 관련 법령에 특별한 규정이 없는 한 무료 서비스의 이용과 관련하여 책임을 지지 않습니다.': ['The Service is provided free of charge, and unless otherwise required by law the Company bears no liability in connection with the use of a free service.', '本服务免费提供，除相关法令另有特别规定外，本公司对免费服务的使用不承担责任。', '本サービスは無料で提供され、関連法令に特別の定めがない限り、当社は無料サービスの利用に関して責任を負いません。'],
    '다만 회사의 고의 또는 중대한 과실로 인한 손해에 대해서는 그러하지 아니합니다.': ['This does not apply to damage caused by the Company\u2019s wilful misconduct or gross negligence.', '但因本公司故意或重大过失造成的损害除外。', 'ただし、当社の故意または重大な過失による損害についてはこの限りではありません。'],
    '본인은 위의 서비스 이용약관에 동의합니다.': ['I agree to the Terms of Service above.', '本人同意上述服务条款。', '本人は上記の利用規約に同意します。'],

    // ── 개인정보 수집 · 이용 동의서 ──
    'Washed는 다음과 같이 개인정보를 수집·이용합니다.': ['Washed collects and uses personal data as follows.', 'Washed 按以下方式收集和使用个人信息。', 'Washedは以下のとおり個人情報を収集・利用します。'],
    '1. 수집하는 개인정보 항목': ['1. Personal data collected', '1. 收集的个人信息项目', '1. 収集する個人情報の項目'],
    '필수항목: 이름, 이메일, 학생/학교 이메일 주소, 비밀번호, 성별, 소속(학교), 주소': ['Required: name, email, student/school email address, password, gender, school, address', '必填项：姓名、邮箱、学生/学校邮箱地址、密码、性别、所属（学校）、地址', '必須項目：氏名、メール、学生／学校メールアドレス、パスワード、性別、所属（学校）、住所'],
    '수집방법: 회원가입 시 직접 입력': ['Method: entered directly at sign-up', '收集方式：注册时直接输入', '収集方法：会員登録時に直接入力'],
    '2. 개인정보의 수집 및 이용 목적': ['2. Purpose of collection and use', '2. 个人信息的收集及使用目的', '2. 個人情報の収集および利用目的'],
    '회원 가입 및 관리': ['Sign-up and account management', '会员注册及管理', '会員登録および管理'],
    '서비스 제공 및 계약이행': ['Providing the service and performing the agreement', '提供服务及履行合同', 'サービス提供および契約の履行'],
    '이용자 식별 및 인증': ['Identifying and authenticating users', '用户识别及认证', '利用者の識別および認証'],
    '서비스 개선 및 신규 서비스 개발': ['Improving the service and developing new services', '改进服务及开发新服务', 'サービス改善および新規サービス開発'],
    '통지, 공지사항 전달 등 커뮤니케이션': ['Communications such as notices and announcements', '通知、公告传达等沟通', '通知、お知らせの伝達などのコミュニケーション'],
    '법적 의무 이행': ['Meeting legal obligations', '履行法定义务', '法的義務の履行'],
    '3. 개인정보의 보유 및 이용 기간': ['3. Retention and use period', '3. 个人信息的保有及使用期限', '3. 個人情報の保有および利用期間'],
    '보유기간: 회원 탈퇴 신청일로부터 14일까지. 탈퇴 신청 후 14일 이내에 다시 로그인하면 계정이 복구되며, 14일이 지나면 모든 개인정보를 영구 파기합니다. 세탁실 이용 내역 · 경고 기록 · 신고(증거 사진 포함)는 분쟁 처리를 위해 3개월간 보관하며, 3개월이 지나거나 탈퇴 후 14일이 지나거나 둘 중 먼저 오는 때에 파기합니다.': ['Retention: up to 14 days from the date an account deletion is requested. Signing in again within those 14 days restores the account; after 14 days all personal data is permanently destroyed. Laundry usage history, warning records and reports (including photo evidence) are kept for 3 months to handle disputes, and are destroyed at 3 months or 14 days after deletion, whichever comes first.', '保有期限：自申请注销之日起14日。注销申请后14日内重新登录可恢复账号，超过14日将永久销毁全部个人信息。洗衣房使用记录、警告记录、举报（含证据照片）为处理纠纷保存3个月，于满3个月或注销后满14日（以较早者为准）销毁。', '保有期間：退会申請日から14日まで。退会申請後14日以内に再度ログインするとアカウントが復元され、14日を過ぎるとすべての個人情報を永久に破棄します。ランドリー利用履歴・警告記録・通報（証拠写真を含む）は紛争処理のため3か月間保管し、3か月経過または退会後14日経過のいずれか早い時点で破棄します。'],
    '동의 철회 시: 탈퇴 신청 후 14일의 복구 기간이 지나면 지체 없이 파기합니다 (단, 법령에서 일정 기간 보관을 의무화하는 경우는 제외)': ['If consent is withdrawn: data is destroyed without delay once the 14-day restoration period after a deletion request has passed (except where law requires retention for a set period).', '撤回同意时：注销申请后经过14日恢复期即立即销毁（法令规定须保存一定期间的除外）。', '同意撤回時：退会申請後14日の復元期間が過ぎれば遅滞なく破棄します（ただし法令で一定期間の保管が義務付けられている場合を除く）。'],
    '4. 개인정보 처리의 위탁': ['4. Outsourcing of data processing', '4. 个人信息处理的委托', '4. 個人情報処理の委託'],
    '필요한 경우 다음과 같이 개인정보 처리를 위탁할 수 있습니다:': ['Where necessary, data processing may be outsourced as follows:', '必要时可按以下方式委托处理个人信息：', '必要な場合、以下のとおり個人情報処理を委託することがあります：'],
    '이메일 발송 서비스 제공업체': ['Email delivery service providers', '邮件发送服务提供商', 'メール配信サービス提供業者'],
    '클라우드 서버 운영업체': ['Cloud server operators', '云服务器运营商', 'クラウドサーバー運営業者'],
    '5. 정보주체의 권리': ['5. Your rights as a data subject', '5. 信息主体的权利', '5. 情報主体の権利'],
    '귀하는 언제든지 다음의 권리를 행사할 수 있습니다:': ['You may exercise the following rights at any time:', '您可随时行使以下权利：', 'お客様はいつでも次の権利を行使できます：'],
    '개인정보 열람 요청': ['Request access to your personal data', '请求查阅个人信息', '個人情報の閲覧請求'],
    '오류 정정 요청': ['Request correction of errors', '请求更正错误', '誤りの訂正請求'],
    '삭제 요청': ['Request deletion', '请求删除', '削除請求'],
    '처리 정지 요청': ['Request suspension of processing', '请求停止处理', '処理停止の請求'],
    '6. 개인정보 보안': ['6. Data security', '6. 个人信息安全', '6. 個人情報のセキュリティ'],
    '당사는 개인정보 보호를 위해 물리적, 기술적, 관리적 안전조치를 취합니다.': ['We take physical, technical and administrative safeguards to protect personal data.', '本公司为保护个人信息采取物理、技术及管理方面的安全措施。', '当社は個人情報保護のため、物理的・技術的・管理的な安全措置を講じます。'],
    '7. 문의': ['7. Contact', '7. 咨询', '7. お問い合わせ'],
    '개인정보 관련 문의사항이 있으신 경우:': ['If you have questions about personal data:', '如有个人信息相关咨询：', '個人情報に関するお問い合わせは：'],
    '이메일: [고객지원이메일]': ['Email: [support email]', '邮箱：[客服邮箱]', 'メール：[サポートメール]'],
    '전화: [고객지원번호]': ['Phone: [support number]', '电话：[客服电话]', '電話：[サポート番号]'],
    '본인은 위의 개인정보 수집 및 이용에 동의합니다.': ['I agree to the collection and use of my personal data above.', '本人同意上述个人信息的收集及使用。', '本人は上記の個人情報の収集および利用に同意します。']
  };
  Object.keys(EXTRA).forEach(function (k) { D[k] = EXTRA[k]; });
  I.apply();
})();
