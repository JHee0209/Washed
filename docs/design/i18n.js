/* Washed 다국어 지원 — 한국어 원문을 키로 쓰는 런타임 번역기 + <lang-picker> */
(function () {
  if (window.__washedI18N) return;

  var LANGS = [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
    { code: 'zh', label: '中文' },
    { code: 'ja', label: '日本語' }
  ];

  // 한국어 원문 → [en, zh, ja]
  var DICT = {
    // 공통 · 탭
    '홈': ['Home', '首页', 'ホーム'],
    '기록': ['History', '记录', '履歴'],
    '설정': ['Settings', '设置', '設定'],
    '알림': ['Notifications', '通知', '通知'],
    '세탁기': ['Washer', '洗衣机', '洗濯機'],
    '건조기': ['Dryer', '烘干机', '乾燥機'],
    '사용중': ['In use', '使用中', '使用中'],
    '사용가능': ['Available', '可用', '利用可'],
    '고장': ['Out of order', '故障', '故障'],
    '완료': ['Done', '完成', '完了'],
    '경고': ['Warning', '警告', '警告'],
    '취소': ['Cancel', '取消', 'キャンセル'],
    '확인': ['Confirm', '确认', '確認'],
    '전체': ['All', '全部', 'すべて'],
    '공지': ['Notice', '公告', 'お知らせ'],
    '배정': ['Assigned', '分配', '割当'],
    '종료': ['Finished', '结束', '終了'],
    '신고': ['Report', '举报', '通報'],
    '가능': ['free', '可用', '空き'],

    // 로그인
    '세탁기 · 건조기 원격 줄서기': ['Remote laundry queue', '洗衣机 · 烘干机远程排队', '洗濯機・乾燥機のリモート順番待ち'],
    '아이디': ['ID', '账号', 'ID'],
    '비밀번호': ['Password', '密码', 'パスワード'],
    '아이디를 입력해 주세요': ['Enter your ID', '请输入账号', 'IDを入力してください'],
    '비밀번호를 입력해 주세요': ['Enter your password', '请输入密码', 'パスワードを入力してください'],
    '자동 로그인': ['Stay signed in', '自动登录', '自動ログイン'],
    '비밀번호 찾기': ['Forgot password', '找回密码', 'パスワードを探す'],
    '로그인': ['Sign in', '登录', 'ログイン'],
    '또는': ['or', '或', 'または'],
    '학교 구글 계정으로 계속하기': ['Continue with school Google account', '使用学校谷歌账号继续', '学校のGoogleアカウントで続行'],
    // 구글로 가입해 비밀번호가 없는 계정 (05 P11 · PRD 6절) — 로그인 · 비밀번호 찾기 양쪽에서 쓴다
    '구글 간편로그인으로 가입한 계정이에요. 구글 계정으로 로그인해주세요.': ['This account was created with Google. Please sign in with Google.', '该账号通过谷歌登录注册，请使用谷歌账号登录。', 'このアカウントはGoogleで登録されています。Googleアカウントでログインしてください。'],
    '비밀번호를 바꿀 수 없는 계정이에요. 구글 계정으로 로그인하거나 관리자(031-740-7700)에게 연락주세요.': ['This account\u2019s password can\u2019t be changed. Sign in with Google or call the admin at 031-740-7700.', '该账号无法修改密码。请使用谷歌账号登录，或联系管理员（031-740-7700）。', 'このアカウントのパスワードは変更できません。Googleアカウントでログインするか、管理者（031-740-7700）にご連絡ください。'],
    '학교 이메일(@school.ac.kr) 구글 계정만 이용할 수 있어요': ['Only school email (@school.ac.kr) Google accounts can be used', '仅支持学校邮箱(@school.ac.kr)的谷歌账号', '学校メール(@school.ac.kr)のGoogleアカウントのみ利用できます'],
    '학교 이메일(@eulji.ac.kr) 구글 계정만 이용할 수 있어요': ['Only school email (@eulji.ac.kr) Google accounts can be used', '仅支持学校邮箱(@eulji.ac.kr)的谷歌账号', '学校メール(@eulji.ac.kr)のGoogleアカウントのみ利用できます'],
    '아직 계정이 없나요?': ['Don\u2019t have an account yet?', '还没有账号吗？', 'まだアカウントがありませんか？'],
    '회원가입': ['Sign up', '注册', '新規登録'],

    // 홈
    '오늘도 줄 서지 않고 편하게 세탁해요': ['Do your laundry without waiting in line', '今天也不用排队，轻松洗衣', 'today並ばずに気軽に洗濯しましょう'],
    '아무것도 사용하지 않고 있습니다': ['You aren\u2019t using anything right now', '当前没有使用任何设备', '現在なにも使用していません'],
    '내 대기 현황': ['My queue', '我的排队', '自分の待機状況'],
    '현재 상태': ['Current status', '当前状态', '現在の状態'],
    '대기 중인 기기가 없어요': ['No machines in your queue', '没有排队中的设备', '待機中の機器はありません'],
    '줄 빠지기': ['Leave queue', '退出排队', '順番を抜ける'],
    '이용 예정이 아니면 줄 빠지기를 눌러주세요.': ['If you no longer need it, tap Leave queue.', '如果不使用，请点击退出排队。', '利用予定がない場合は「順番を抜ける」を押してください。'],
    '실시간 대기 현황': ['Live queue status', '实时排队情况', 'リアルタイム待機状況'],
    '차례 10분 전, 이용 가능해질 때 알려드려요': ['We\u2019ll notify you 10 minutes before your turn and when a machine frees up', '轮到前10分钟及有空闲设备时通知你', '順番の10分前と空き時にお知らせします'],
    '기기 목록': ['Machines', '设备列表', '機器リスト'],
    '줄서기': ['Join queue', '排队', '順番待ち'],
    '바로 배정돼요': ['Assigned right away', '立即分配', 'すぐに割り当てられます'],
    '잠시만요': ['Please wait', '请稍候', '少々お待ちを'],
    '곧 다시 신청할 수 있어요': ['You can request again shortly', '稍后可以重新申请', 'まもなく再申請できます'],
    '점검 중': ['Under maintenance', '维护中', '点検中'],
    '세탁실 점검 중이라 잠시 이용할 수 없어요': ['The laundry room is under maintenance', '洗衣房维护中，暂时无法使用', 'ランドリー点検中のため利用できません'],
    '이용 제한 중': ['Restricted', '限制使用中', '利用制限中'],
    'QR 인증': ['Scan QR', 'QR 认证', 'QR認証'],
    'QR 스캔': ['QR scan', 'QR 扫描', 'QRスキャン'],
    'QR 인증 안내': ['About QR check-in', 'QR 认证说明', 'QR認証のご案内'],
    '다했어요': ['I\u2019m done', '已完成', '終わりました'],
    'QR 코드를 사각형 안에 맞춰주세요.': ['Line the QR code up inside the frame.', '请将二维码对准方框。', 'QRコードを枠内に合わせてください。'],
    '인식 완료': ['Scanned', '识别完成', '認識完了'],
    '인증 시간 초과': ['Check-in time expired', '认证超时', '認証時間切れ'],
    '인증 시간이 초과되어 다음 대기자에게 순서가 넘어갑니다. 이용을 원하실 경우 다시 줄서기해주세요.': ['Your check-in window expired, so your turn passes to the next person. Join the queue again if you still want to use it.', '认证超时，顺序已转给下一位。如需使用请重新排队。', '認証時間を過ぎたため次の方に順番が移ります。ご利用の場合は再度順番待ちしてください。'],
    '10분이 지나면 다음 대기자에게 순서가 넘어가므로 시간 내에 QR 인증해 주세요.': ['After 10 minutes your turn passes to the next person, so please scan the QR in time.', '超过10分钟顺序将转给下一位，请及时扫码认证。', '10分を過ぎると次の方に順番が移ります。時間内にQR認証してください。'],
    '시간이 끝났어요! 지금 누르지 않으면 경고가 쌓여요.': ['Time\u2019s up. Tap now or you\u2019ll get a warning.', '时间到！现在不点击将记录警告。', '時間終了です。今押さないと警告がつきます。'],

    // 기록
    '이용 내역': ['Usage history', '使用记录', '利用履歴'],
    '최근 30일간의 세탁 · 건조 기록이에요': ['Your washing and drying over the last 30 days', '最近30天的洗衣 · 烘干记录', '直近30日間の洗濯・乾燥の記録です'],
    '이용 횟수': ['Uses', '使用次数', '利用回数'],
    '총 사용 시간': ['Total time', '总使用时间', '合計利用時間'],
    '받은 경고': ['Warnings', '收到的警告', '受けた警告'],
    '누적 3회가 되면 3일동안 줄서기를 할 수 없어요': ['At 3 warnings you can\u2019t join queues for 3 days', '累计3次将3天内无法排队', '累計3回で3日間順番待ちできません'],
    '관리자 처리': ['Admin action', '管理员处理', '管理者処理'],
    '오늘': ['Today', '今天', '今日'],
    '어제': ['Yesterday', '昨天', '昨日'],

    // 알림
    '읽지 않은 알림': ['Unread notifications', '未读通知', '未読の通知'],
    '모두 읽음': ['Mark all read', '全部已读', 'すべて既読'],
    '받은 알림이 없어요': ['No notifications yet', '暂无通知', '通知はありません'],
    '배정된 알림이 없어요': ['No assignment notifications', '暂无分配通知', '割当の通知はありません'],
    '신고에 대한 결과가 없어요': ['No report results yet', '暂无举报结果', '通報の結果はありません'],
    '새 알림이 오면 여기에 쌓여요': ['New notifications will show up here', '新通知会显示在这里', '新しい通知はここに表示されます'],

    // 설정
    '알림': ['Notifications', '通知', '通知'],
    '차례 10분 전 알림': ['10-minute heads-up', '轮到前10分钟提醒', '順番10分前の通知'],
    '내 차례가 다가오면 미리 알려드려요': ['We\u2019ll let you know before your turn', '快轮到你时提前通知', '順番が近づいたらお知らせします'],
    '이용 가능 알림': ['Availability alerts', '可用提醒', '利用可能の通知'],
    '기기를 바로 이용할 수 있을 때 알려드려요': ['We\u2019ll tell you when a machine is free', '设备可立即使用时通知你', 'すぐ使える時にお知らせします'],
    '신고하기': ['Report a problem', '举报', '通報する'],
    '어떤 문제가 있었는지 알려주세요.': ['Tell us what went wrong.', '请告诉我们发生了什么问题。', 'どんな問題があったか教えてください。'],
    '기기가 고장났어요': ['The machine is broken', '设备故障', '機器が故障しています'],
    '순서를 지키지 않았어요': ['Someone skipped the queue', '有人不遵守顺序', '順番が守られませんでした'],
    '세탁물이 있어요': ['Laundry was left inside', '里面有衣物', '洗濯物が残っています'],
    '기타': ['Other', '其他', 'その他'],
    '기기 종류': ['Machine type', '设备类型', '機器の種類'],
    '호기 선택': ['Select unit', '选择机号', '号機を選択'],
    '증거 사진 (필수)': ['Photo evidence (required)', '证据照片（必填）', '証拠写真（必須）'],
    '사진을 첨부해 주세요': ['Attach a photo', '请添加照片', '写真を添付してください'],
    '의견을 입력해주세요': ['Tell us more', '请输入内容', 'ご意見を入力してください'],
    '신고 접수': ['Submit report', '提交举报', '通報を送信'],
    '신고가 접수됐어요. 관리자가 확인 후 조치할게요.': ['Report submitted. An admin will review it.', '举报已提交，管理员将进行处理。', '通報を受け付けました。管理者が確認します。'],
    '도움말': ['Help', '帮助', 'ヘルプ'],
    '문의하기': ['Contact us', '联系我们', 'お問い合わせ'],
    '정보': ['About', '信息', '情報'],
    '버전 정보': ['Version', '版本信息', 'バージョン情報'],
    '로그아웃': ['Sign out', '退出登录', 'ログアウト'],
    '회원탈퇴': ['Delete account', '注销账号', '退会'],
    '탈퇴하시겠습니까?': ['Delete your account?', '确定要注销吗？', '退会しますか？'],
    '탈퇴하기': ['Delete account', '注销', '退会する'],
    '자주 묻는 질문': ['FAQ', '常见问题', 'よくある質問'],
    '줄서기 · 배정': ['Queue & assignment', '排队 · 分配', '順番待ち・割当'],
    '이용 중': ['During use', '使用中', '利用中'],
    '계정 · 알림': ['Account & notifications', '账号 · 通知', 'アカウント・通知'],
    '언어': ['Language', '语言', '言語'],
    '언어 설정': ['Language', '语言设置', '言語設定'],

    // 회원가입
    '기숙사 세탁실을 편하게 이용해 보세요': ['Use the dorm laundry room the easy way', '轻松使用宿舍洗衣房', '寮のランドリーを快適に使いましょう'],
    '이름': ['Name', '姓名', '名前'],
    '이름을 입력해 주세요': ['Enter your name', '请输入姓名', '名前を入力してください'],
    '아이디 (학교 이메일)': ['ID (school email)', '账号（学校邮箱）', 'ID（学校メール）'],
    '인증하기': ['Send code', '验证', '認証する'],
    '재발송': ['Resend', '重新发送', '再送信'],
    '인증완료': ['Verified', '已验证', '認証完了'],
    '인증번호 6자리': ['6-digit code', '6位验证码', '認証番号6桁'],
    '비밀번호 확인': ['Confirm password', '确认密码', 'パスワード確認'],
    '비밀번호를 다시 입력해 주세요': ['Re-enter your password', '请再次输入密码', 'パスワードを再入力してください'],
    '8자 이상': ['8+ characters', '8位以上', '8文字以上'],
    '성별': ['Gender', '性别', '性別'],
    '여성': ['Female', '女', '女性'],
    '남성': ['Male', '男', '男性'],
    '소속(학교)': ['School', '所属（学校）', '所属（学校）'],
    '학교명을 입력해 주세요': ['Enter your school name', '请输入学校名称', '学校名を入力してください'],
    '호실': ['Room', '房间号', '部屋番号'],
    '학번': ['Student ID', '学号', '学籍番号'],
    '학번을 입력해 주세요': ['Enter your student ID', '请输入学号', '学籍番号を入力してください'],
    '학번을 입력해주세요.': ['Please enter your student ID.', '请输入学号。', '学籍番号を入力してください。'],
    '전체 동의': ['Agree to all', '全部同意', 'すべて同意'],
    '서비스 이용약관 동의 (필수)': ['Terms of service (required)', '服务条款同意（必填）', '利用規約に同意（必須）'],
    '개인정보 수집 · 이용 동의 (필수)': ['Privacy consent (required)', '个人信息收集 · 使用同意（必填）', '個人情報の収集・利用に同意（必須）'],
    '만 14세 이상입니다 (필수)': ['I am 14 or older (required)', '本人已满14周岁（必填）', '満14歳以上です（必須）'],
    '앱 push 동의합니다 (선택)': ['Push notifications (optional)', '同意接收推送（可选）', 'プッシュ通知に同意（任意）'],
    '가입하기': ['Create account', '注册', '登録する'],
    '보기 ›': ['View \u203A', '查看 \u203A', '表示 \u203A'],
    '서비스 이용약관': ['Terms of service', '服务条款', '利用規約'],
    '개인정보 수집 · 이용 동의서': ['Privacy consent form', '个人信息收集 · 使用同意书', '個人情報の収集・利用同意書'],
    '약관 내용을 끝까지 읽어야 동의할 수 있어요.': ['Read to the end before agreeing.', '需阅读完整内容后才能同意。', '最後まで読むと同意できます。'],

    // 비밀번호 찾기 · 문의 · 프로필
    '이메일 확인': ['Verify email', '验证邮箱', 'メール確認'],
    '인증': ['Verify', '认证', '認証'],
    '새 비밀번호': ['New password', '新密码', '新しいパスワード'],
    '새 비밀번호 확인': ['Confirm new password', '确认新密码', '新しいパスワード確認'],
    '인증코드 받기': ['Send code', '获取验证码', '認証コードを受け取る'],
    '인증코드 6자리': ['6-digit code', '6位验证码', '認証コード6桁'],
    '다시 보내기': ['Resend', '重新发送', '再送信'],
    '비밀번호 변경': ['Change password', '修改密码', 'パスワード変更'],
    '비밀번호가 변경됐어요': ['Your password has been changed', '密码已修改', 'パスワードを変更しました'],
    '새 비밀번호로 다시 로그인해주세요.': ['Please sign in with your new password.', '请使用新密码重新登录。', '新しいパスワードで再度ログインしてください。'],
    '로그인하러 가기': ['Go to sign in', '前往登录', 'ログインへ'],
    '프로필 수정': ['Edit profile', '编辑资料', 'プロフィール編集'],
    '전화번호': ['Phone', '电话号码', '電話番号'],
    '저장하기': ['Save', '保存', '保存する'],
    '현재 비밀번호': ['Current password', '当前密码', '現在のパスワード'],
    '내용': ['Message', '内容', '内容'],
    '보내기': ['Send', '发送', '送信'],
    '대': [' machines', ' 台', ' 台'],
    '남음': ['left', '剩余', '残り'],
    '개': [' items', '条', '件'],
    '회': [' times', '次', '回'],
    '건': [' cases', '件', '件'],
    '명': [' people', '人', '人'],
    '호기': [' unit', '号机', '号機'],
    '명 대기 중': [' waiting', '人排队中', '人待機中'],
    '전체': ['All', '全部', 'すべて'],
    // 스플래시
    '세탁실 상태를 불러오는 중': ['Loading laundry room status', '正在加载洗衣房状态', 'ランドリーの状態を読み込み中'],
    // 기록
    '세탁물 방치 30분 초과': ['Laundry left over 30 minutes', '衣物滞留超过30分钟', '洗濯物の放置が30分超過'],
    '배정 후 미이용': ['Assigned but not used', '分配后未使用', '割当後に未使用'],
    '사용': ['used', '使用', '利用'],
    '배정 후 10분 안에 QR 인증을 하지 않아 경고를 받았어요': ['Warned for not scanning the QR within 10 minutes of assignment', '因分配后未在10分钟内扫码认证而收到警告', '割当後10分以内にQR認証をしなかったため警告を受けました'],
    '"다했어요" 버튼을 누르지 않아 경고를 받았어요': ['Warned for not tapping the "I\u2019m done" button', '因未点击「已完成」按钮而收到警告', '「終わりました」ボタンを押さなかったため警告を受けました'],
    // 알림
    '처리가 완료됐어요.': ['has been resolved.', '已处理完成。', '対応が完了しました。'],
    '사실이 아닌 것으로 확인되어 반려됐어요.': ['was found to be unfounded and was rejected.', '经核实不属实，已驳回。', '事実ではないと確認され、却下されました。'],
    '확인 중이에요.': ['is being reviewed.', '正在确认中。', '確認中です。'],
    '10분 안에 QR 코드를 찍어주세요. 그렇지 않으면 다음 사람에게 넘어가요': ['Scan the QR code within 10 minutes, or it passes to the next person', '请在10分钟内扫描二维码，否则将转给下一位', '10分以内にQRコードを読み取ってください。そうしないと次の方に順番が移ります'],
    '3분 안에 세탁물을 수거해주세요': ['Please collect your laundry within 3 minutes', '请在3分钟内取走衣物', '3分以内に洗濯物を回収してください'],
    '10분 안에 시작하지 않으면 다음 사람에게 넘어가요': ['If you don\u2019t start within 10 minutes it passes to the next person', '10分钟内未开始将转给下一位', '10分以内に開始しないと次の方に移ります'],
    '30분 안에 세탁물을 수거해주세요': ['Please collect your laundry within 30 minutes', '请在30分钟内取走衣物', '30分以内に洗濯物を回収してください'],
    '1층 세탁실 점검 안내': ['1F laundry room maintenance notice', '1楼洗衣房维护通知', '1階ランドリー点検のお知らせ'],
    '9월 12일 오전 10시부터 2시간 동안 이용할 수 없어요': ['Unavailable for 2 hours from 10 a.m. on September 12', '9月12日上午10点起2小时内无法使用', '9月12日午前10時から2時間ご利用いただけません'],
    '경고가 1회 추가됐어요': ['You received 1 warning', '增加了1次警告', '警告が1回追加されました'],
    '줄서기 순서가 돌아왔어요': ['It\u2019s your turn in the queue', '轮到你排队的顺序了', '順番待ちの番が回ってきました'],
    '이용 규칙이 업데이트됐어요': ['The usage rules have been updated', '使用规则已更新', '利用ルールが更新されました'],
    '경고 3회 시 3일 동안 줄서기가 제한됩니다': ['At 3 warnings, queueing is restricted for 3 days', '累计3次警告将限制排队3天', '警告3回で3日間順番待ちが制限されます'],
    // 문의하기
    '문의가 접수됐어요': ['Your message has been received', '咨询已提交', 'お問い合わせを受け付けました'],
    '관리자가 확인 후 입력하신 아이디로': ['An admin will review it and reply to the', '管理员确认后将通过你填写的账号', '管理者が確認のうえ、ご入力のIDへ'],
    '답변을 드릴게요.': ['ID you entered.', '给予答复。', 'ご返答いたします。'],
    '설정으로 돌아가기': ['Back to settings', '返回设置', '設定に戻る'],
    '궁금한 점이나 문제가 있으면 남겨주세요.': ['Let us know if you have a question or a problem.', '如有疑问或问题请留言。', 'ご不明な点や問題があればお知らせください。'],
    '입력하신 아이디(이메일)로 답변을 보내드려요.': ['We\u2019ll reply to the ID (email) you enter.', '我们会发送答复至你填写的账号（邮箱）。', 'ご入力のID（メール）へ返信します。'],
    '답변 받을 이메일을 입력해 주세요': ['Enter the email for our reply', '请输入接收答复的邮箱', '返信を受け取るメールを入力してください'],
    '문의하실 내용을 자세히 적어주세요': ['Describe your question in detail', '请详细填写咨询内容', 'お問い合わせ内容を詳しくご記入ください'],
    '문의 보내기': ['Send message', '发送咨询', 'お問い合わせを送る'],
    // 프로필 수정
    '프로필 사진 변경': ['Change profile photo', '更换头像', 'プロフィール写真を変更'],
    '현재 비밀번호가 올바르지 않아요': ['Your current password is incorrect', '当前密码不正确', '現在のパスワードが正しくありません'],
    '새 비밀번호를 입력해 주세요': ['Enter a new password', '请输入新密码', '新しいパスワードを入力してください'],
    '새 비밀번호를 다시 입력해 주세요': ['Re-enter the new password', '请再次输入新密码', '新しいパスワードを再入力してください'],
    '비밀번호가 일치하지 않아요.': ['Passwords do not match.', '密码不一致。', 'パスワードが一致しません。'],
    '비밀번호가 일치해요': ['Passwords match', '密码一致', 'パスワードが一致します'],
    '비밀번호는 8자 이상이어야 해요': ['Password must be at least 8 characters', '密码需8位以上', 'パスワードは8文字以上である必要があります'],
    '비밀번호가 일치하지 않아요': ['Passwords do not match', '密码不一致', 'パスワードが一致しません'],
    '현재 비밀번호와 동일합니다': ['This is the same as your current password', '与当前密码相同', '現在のパスワードと同じです'],
    '비밀번호가 변경됐어요.': ['Your password has been changed.', '密码已修改。', 'パスワードを変更しました。'],
    '프로필이 저장됐어요.': ['Your profile has been saved.', '资料已保存。', 'プロフィールを保存しました。'],
    // 비밀번호 찾기
    '학교 이메일 형식(ac.kr)으로 입력해주세요.': ['Please enter a school email (ac.kr).', '请输入学校邮箱格式（ac.kr）。', '学校メール形式（ac.kr）で入力してください。'],
    '메일이 오지 않으면 스팸함을 확인해주세요.': ['If the email does not arrive, please check your spam folder.', '如果收不到邮件，请检查垃圾邮件箱。', 'メールが届かない場合は迷惑メールフォルダをご確認ください。'],
    '그래도 받지 못했다면 관리자(031-740-7700)에게 연락주세요.': ['If you still have not received it, please contact the administrator at 031-740-7700.', '若仍未收到，请联系管理员（031-740-7700）。', 'それでも届かない場合は管理者（031-740-7700）にご連絡ください。'],
    '그래도 받지 못했다면 관리자(031-740-1111)에게 연락해주세요.': ['If you still have not received it, please contact the administrator at 031-740-1111.', '若仍未收到，请联系管理员（031-740-1111）。', 'それでも届かない場合は管理者（031-740-1111）にご連絡ください。'],
    '메일이 오지 않으면 스팸함을 확인해주세요. 그래도 받지 못했다면': ['If the email does not arrive, check your spam folder. If you still have not received it,', '如果收不到邮件，请检查垃圾邮件箱。若仍未收到，', 'メールが届かない場合は迷惑メールフォルダをご確認ください。それでも届かない場合は'],
    '로 알려주세요.': ['let us know via', '请通过以下方式告知我们。', 'からお知らせください。'],
    '인증 시간이 지났어요. 다시 보내기를 눌러주세요.': ['The code has expired. Tap Resend.', '验证已超时，请点击重新发送。', '認証時間が過ぎました。再送信を押してください。'],
    '인증코드가 올바르지 않아요.': ['That code is not correct.', '验证码不正确。', '認証コードが正しくありません。'],
    '비밀번호는 8자 이상이어야 해요.': ['Password must be at least 8 characters.', '密码需8位以上。', 'パスワードは8文字以上である必要があります。'],
    '비밀번호가 일치해요.': ['Passwords match.', '密码一致。', 'パスワードが一致します。'],
    '인증코드를 보냈어요. 5분 안에 입력해주세요.': ['A code has been sent. Enter it within 5 minutes.', '验证码已发送，请在5分钟内输入。', '認証コードを送りました。5分以内に入力してください。'],
    '으로': ['to', '至', 'へ'],
    // 회원가입 오류 안내
    '이름을 입력해주세요.': ['Please enter your name.', '请输入姓名。', '名前を入力してください。'],
    '이메일 인증을 완료해주세요.': ['Please complete email verification.', '请完成邮箱验证。', 'メール認証を完了してください。'],
    '성별을 선택해주세요.': ['Please select your gender.', '请选择性别。', '性別を選択してください。'],
    '소속(학교)을 입력해주세요.': ['Please enter your school.', '请输入所属（学校）。', '所属（学校）を入力してください。'],
    '호실을 입력해주세요.': ['Please enter your room number.', '请输入房间号。', '部屋番号を入力してください。'],
    '필수 약관에 모두 동의해주세요.': ['Please agree to all required terms.', '请同意全部必填条款。', '必須の規約にすべて同意してください。'],
    '인증번호가 일치하지 않아요.': ['That verification code is not correct.', '验证码不一致。', '認証番号が一致しません。'],
    '이메일 인증이 완료됐어요.': ['Email verified.', '邮箱验证完成。', 'メール認証が完了しました。'],
    '인증 시간이 만료됐어요. 재발송해주세요.': ['The code expired. Please resend.', '验证已过期，请重新发送。', '認証時間が切れました。再送信してください。'],
    '가입이 완료됐어요! 홈으로 이동합니다.': ['Signed up! Taking you home.', '注册完成！即将前往首页。', '登録が完了しました。ホームへ移動します。'],
    '필수 항목을 모두 입력·확인해주세요.': ['Please complete all required fields.', '请填写并确认全部必填项。', '必須項目をすべて入力・確認してください。'],
    'Washed · 버전 1.0.0': ['Washed · version 1.0.0', 'Washed · 版本 1.0.0', 'Washed・バージョン 1.0.0'],
// 홈 · 기록 · 알림 · 설정 보강
    '기기 추가': ['Add machine', '添加设备', '機器を追加'],
    '이용 가능해질 때 알려드려요': ['We\u2019ll let you know when it\u2019s free', '有空闲时通知你', '空いたらお知らせします'],
    '대기중': ['Waiting', '排队中', '待機中'],
    '이미 세탁기 대기열에 참여 중이에요.': ['You are already in the washer queue.', '你已在洗衣机排队中。', 'すでに洗濯機の待機列に参加中です。'],
    '이미 건조기 대기열에 참여 중이에요.': ['You are already in the dryer queue.', '你已在烘干机排队中。', 'すでに乾燥機の待機列に参加中です。'],
    '세탁실 점검 중이라 잠시 이용할 수 없어요.': ['The laundry room is under maintenance right now.', '洗衣房维护中，暂时无法使用。', 'ランドリー点検中のため、しばらく利用できません。'],
    'QR을 찍으면 바로 타이머가 시작돼요.': ['Scanning the QR starts the timer right away.', '扫码后计时立即开始。', 'QRを読み取るとすぐタイマーが始まります。'],
    '세탁물을 넣은 뒤 기기에 붙은 QR을 찍어주세요.': ['Load your laundry, then scan the QR on the machine.', '放入衣物后请扫描设备上的二维码。', '洗濯物を入れてから機器のQRを読み取ってください。'],
    '빨리 끝나면 다음 사람을 위해\n"다했어요"를 눌러주세요.': ['If you finish early, tap "I\u2019m done" for the next person.', '提前结束请为下一位点击「已完成」。', '早く終わったら次の方のために「終わりました」を押してください。'],
    '기기 종류': ['Machine type', '设备类型', '機器の種類'],
    '증거 사진 (선택)': ['Photo evidence (optional)', '证据照片（选填）', '証拠写真（任意）'],
    '탈퇴 후 14일 안에 다시 로그인하면': ['If you sign in again within 14 days of deleting,', '注销后14日内重新登录，', '退会後14日以内に再度ログインすれば'],
    '되돌릴 수 있어요. 14일이 지나면 이용 내역 · 경고 ·': ['you can undo it. After 14 days your usage history, warnings and', '即可撤销。超过14日，使用记录 · 警告 ·', '取り消せます。14日を過ぎると利用履歴・警告・'],
    '신고 기록이 모두 영구 삭제됩니다.': ['reports are permanently deleted.', '举报记录将全部永久删除。', '通報記録がすべて永久に削除されます。'],
    '이름란': ['Name', '姓名栏', '名前'],
    '전화번호를 입력해 주세요': ['Enter your phone number', '请输入电话号码', '電話番号を入力してください'],
    '호실을 입력해 주세요': ['Enter your room number', '请输入房间号', '部屋番号を入力してください'],
    '현재 비밀번호를 입력해 주세요': ['Enter your current password', '请输入当前密码', '現在のパスワードを入力してください'],
    '내용을 입력해 주세요': ['Write your message', '请输入内容', '内容を入力してください'],
    '아이디(이메일)': ['ID (email)', '账号（邮箱）', 'ID（メール）'],
    '문의 내용': ['Your message', '咨询内容', 'お問い合わせ内容'],
    '가입할 때 쓴 학교 이메일을 입력하면': ['Enter the school email you signed up with and', '输入注册时使用的学校邮箱，', '登録時に使用した学校メールを入力すると'],
    '인증코드를 보내드려요.': ['we\u2019ll send you a code.', '我们会发送验证码。', '認証コードをお送りします。'],
    '새로 쓸 비밀번호를 입력해주세요.': ['Enter the password you want to use.', '请输入新的密码。', '新しく使うパスワードを入力してください。'],
    '8자 이상이어야 해요.': ['It must be at least 8 characters.', '需8位以上。', '8文字以上である必要があります。'],
  };


  // 숫자·기기명이 섞인 문장은 패턴으로 처리
  var PATTERNS = [
    [/^전체 (\d+)대$/, ['$1 total', '共$1台', '全$1台']],
    [/^현재 (\d+)명 대기 중이에요$/, ['$1 waiting right now', '当前$1人排队中', '現在$1人待機中']],
    [/^(\d+)명 대기 중$/, ['$1 waiting', '$1人排队中', '$1人待機中']],
    [/^약 (.+) 후 배정$/, ['Assigned in about $1', '约$1后分配', '約$1後に割当']],
    [/^이용 제한 중 · (\d+)일 남음$/, ['Restricted · $1 day(s) left', '限制使用中 · 剩余$1天', '利用制限中・残り$1日']],
    [/^(\d+)일 남음$/, ['$1 day(s) left', '剩余$1天', '残り$1日']],
    [/^(.+) 남음$/, ['$1 left', '剩余$1', '残り$1']],
    [/^읽지 않은 알림 (\d+)개$/, ['$1 unread notification(s)', '$1条未读通知', '未読の通知$1件']],
    [/^받은 경고 (\d+)건$/, ['$1 warning(s) received', '收到$1次警告', '受けた警告$1件']],
    [/^경고 (\d+)회$/, ['$1 warning(s)', '警告$1次', '警告$1回']],
    [/^세탁기 (\d+)호기$/, ['Washer $1', '洗衣机$1号', '洗濯機$1号機']],
    [/^건조기 (\d+)호기$/, ['Dryer $1', '烘干机$1号', '乾燥機$1号機']],
    [/^(\d+)호기$/, ['Unit $1', '$1号机', '$1号機']],
    [/^(.+)에 배정됐어요$/, ['$1 is assigned to you', '已为你分配$1', '$1に割り当てられました']],
    [/^(.+) 사용이 끝났어요$/, ['$1 has finished', '$1使用结束', '$1の使用が終わりました']],
    [/^(.+) 이용 중$/, ['Using $1', '正在使用$1', '$1を利用中']],
    [/^(\d+)월 (\d+)일$/, ['$2/$1', '$1月$2日', '$1月$2日']],
    [/^(\d+)월 (\d+)일 \((.+)\)$/, ['$2/$1', '$1月$2日', '$1月$2日']],
    [/^(\d+)시간$/, ['$1 h', '$1小时', '$1時間']],
    [/^(\d+)분$/, ['$1 min', '$1分钟', '$1分']],
    [/^(.+) · (\d+)분 사용$/, ['$1 · used $2 min', '$1 · 使用$2分钟', '$1・$2分利用']],
    [/^(\d+)일 전$/, ['$1 days ago', '$1天前', '$1日前']],
    [/^(\d+)주일 전$/, ['$1 week(s) ago', '$1周前', '$1週間前']],
    [/^(.+) 차례가 됐어요! 10분 안에 QR을 찍어 시작해주세요\.$/, ['It\u2019s your turn for $1. Scan the QR within 10 minutes to start.', '轮到你使用$1了。请在10分钟内扫码开始。', '$1の順番になりました。10分以内にQRを読み取って開始してください。']],
    [/^(.+)를 바로 이용할 수 있어요\. 10분 안에 QR을 찍어주세요\.$/, ['$1 is available now. Scan the QR within 10 minutes.', '$1现在可以使用。请在10分钟内扫码。', '$1はすぐに利用できます。10分以内にQRを読み取ってください。']],
    [/^(.+) 대기열에 참여했어요\. 먼저 끝나는 기기로 자동 배정돼요\.$/, ['You joined the $1 queue. You\u2019ll be assigned the first one to free up.', '已加入$1排队，将自动分配最先空出的设备。', '$1の待機列に参加しました。先に空いた機器に自動で割り当てられます。']],
    [/^(.+) 대기열에서 나갔어요\. 잠시 후 다시 신청할 수 있어요\.$/, ['You left the $1 queue. You can request again shortly.', '已退出$1排队，稍后可重新申请。', '$1の待機列から抜けました。しばらくして再申請できます。']],
    [/^(.+) 대기열에서 나갔어요\.$/, ['You left the $1 queue.', '已退出$1排队。', '$1の待機列から抜けました。']],
    [/^(.+) QR 인증 완료! 타이머가 시작됐어요\.$/, ['$1 QR verified. The timer has started.', '$1扫码认证完成，计时已开始。', '$1のQR認証が完了しました。タイマーが始まりました。']],
    [/^(.+) 이용을 완료했어요\. 다음 분이 이용할 수 있어요\.$/, ['You finished with $1. The next person can use it now.', '$1使用已完成，下一位可以使用了。', '$1の利用を完了しました。次の方が利用できます。']],
    [/^(.+) 이용 시간이 끝났어요\. 3분 안에 "다했어요"를 눌러주세요\.$/, ['Time is up for $1. Tap "I\u2019m done" within 3 minutes.', '$1使用时间已结束，请在3分钟内点击「已完成」。', '$1の利用時間が終わりました。3分以内に「終わりました」を押してください。']],
    [/^(.+) 배정 시간 10분이 지나 경고가 1회 누적됐어요\.$/, ['The 10-minute window for $1 passed, so you received 1 warning.', '$1的10分钟分配时间已过，累计1次警告。', '$1の割当時間10分が過ぎたため、警告が1回累積しました。']],
    [/^(.+)에서 시간 내 "다했어요"를 누르지 않아 경고가 1회 누적됐어요\.$/, ['You did not tap "I\u2019m done" in time on $1, so you received 1 warning.', '未在$1上按时点击「已完成」，累计1次警告。', '$1で時間内に「終わりました」を押さなかったため、警告が1回累積しました。']],
    [/^지금은 대기할 수 있는 (.+)가 없어요\.$/, ['There is no $1 available to queue for right now.', '目前没有可排队的$1。', '現在、待機できる$1はありません。']],
    [/^(전체|공지|배정|종료|경고|신고) (\d+)$/, ['$1 $2', '$1 $2', '$1 $2']],
    [/^신고 결과: (.+)$/, ['Report result: $1', '举报结果：$1', '通報結果：$1']],
    [/^접수하신 신고가 (.+)$/, ['Your report $1', '你提交的举报$1', 'お送りいただいた通報は$1']],
    [/^(.+) · (.+)$/, ['$1 · $2', '$1 · $2', '$1・$2']],
    [/^v(\d.+)$/, ['v$1', 'v$1', 'v$1']],
    [/^안녕하세요, (.+)$/, ['Hello, $1', '你好，$1', 'こんにちは、$1']]
  ];

  function translateFragment(s, i, depth) {
    var k = s.trim();
    var d = DICT[k];
    if (d && d[i]) return s.replace(k, d[i]);
    if (depth > 0) {
      var p = patternTranslate(k, i, depth - 1);
      if (p !== null) return s.replace(k, p);
    }
    return s;
  }

  function patternTranslate(key, i, depth) {
    if (depth === undefined) depth = 2;
    for (var p = 0; p < PATTERNS.length; p++) {
      var m = key.match(PATTERNS[p][0]);
      if (!m) continue;
      return PATTERNS[p][1][i].replace(/\$(\d)/g, function (_, d) {
        var g = m[Number(d)];
        return g === undefined ? '' : translateFragment(g, i, depth);
      });
    }
    return null;
  }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SVG: 1, PATH: 1, 'LANG-PICKER': 1 };

  function idx(lang) { return lang === 'en' ? 0 : lang === 'zh' ? 1 : lang === 'ja' ? 2 : -1; }

  function getLang() {
    try { return localStorage.getItem('washed_lang') || 'ko'; } catch (e) { return 'ko'; }
  }

  function translateNode(root, lang) {
    var i = idx(lang);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.parentElement || SKIP_TAGS[n.parentElement.tagName]) return NodeFilter.FILTER_REJECT;
        if (n.parentElement.closest && n.parentElement.closest('lang-picker')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (node) {
      if (node.__ko === undefined || (node.__last !== undefined && node.nodeValue !== node.__last)) {
        var t0 = node.nodeValue;
        if (!t0 || !t0.trim()) return;
        node.__ko = t0;
      }
      var key = node.__ko.trim();
      if (i < 0) { if (node.nodeValue !== node.__ko) node.nodeValue = node.__ko; node.__last = node.__ko; return; }
      var e = DICT[key];
      var out;
      if (e && e[i]) out = node.__ko.replace(key, e[i]);
      else { var p = patternTranslate(key, i); out = p !== null ? node.__ko.replace(key, p) : node.__ko; }
      if (node.nodeValue !== out) node.nodeValue = out;
      node.__last = out;
    });

    var fields = root.querySelectorAll ? root.querySelectorAll('[placeholder]') : [];
    Array.prototype.forEach.call(fields, function (el) {
      var cph = el.getAttribute('placeholder') || '';
      if (el.__koPh === undefined || (el.__lastPh !== undefined && cph !== el.__lastPh)) el.__koPh = cph;
      var key = el.__koPh.trim();
      var e = DICT[key];
      var ph = (i >= 0 && e && e[i]) ? e[i] : el.__koPh;
      if (cph !== ph) el.setAttribute('placeholder', ph);
      el.__lastPh = ph;
    });
  }

  var scheduled = false;
  function apply() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      try { translateNode(document.body, getLang()); } catch (e) {}
    }, 0);
  }

  function setLang(code) {
    try { localStorage.setItem('washed_lang', code); } catch (e) {}
    apply();
    window.dispatchEvent(new CustomEvent('washed-lang', { detail: code }));
  }

  /* ---- 국기 아이콘 (색상 포함, 원형) ---- */
  var flagSeq = 0;
  function flag(code) {
    var uid = 'f' + (++flagSeq);
    return FLAGS[code].replace(/c-(en|zh|ja|ko)/g, 'c-$1-' + uid);
  }
  var FLAGS = {
    en: '<span style="display:block;width:100%;height:100%;background:#fff"><img src="./icons/flag-en.png" alt="" style="width:100%;height:100%;object-fit:cover;object-position:8% center;display:block"></span>',
    zh: '<span style="display:block;width:100%;height:100%;background:#fff"><img src="./icons/flag-zh.png" alt="" style="width:100%;height:100%;object-fit:cover;object-position:25% center;display:block"></span>',
    ja: '<svg viewBox="0 0 24 24" width="100%" height="100%"><defs><clipPath id="c-ja"><circle cx="12" cy="12" r="12"/></clipPath></defs><g clip-path="url(#c-ja)"><rect width="24" height="24" fill="#fff"/><circle cx="12" cy="12" r="6.6" fill="#BC002D"/></g></svg>',
    ko: '<span style="display:block;width:100%;height:100%;background:#fff"><img src="./icons/flag-korea.png" alt="" style="width:100%;height:100%;object-fit:cover;display:block"></span>'
  };


  /* ---- <lang-picker> ---- */
  if (!customElements.get('lang-picker')) {
    customElements.define('lang-picker', class extends HTMLElement {
      connectedCallback() {
        this.open = false;
        if (!this._root) this._root = this.attachShadow({ mode: 'open' });
        this._onDoc = (e) => { var p = e.composedPath ? e.composedPath() : []; if (p.indexOf(this) === -1) { this.open = false; this.render(); } };
        document.addEventListener('click', this._onDoc);
        window.addEventListener('washed-lang', () => this.render());
        this.render();
      }
      disconnectedCallback() { document.removeEventListener('click', this._onDoc); }
      render() {
        var cur = getLang();
        var curDef = LANGS.filter(function (l) { return l.code === cur; })[0] || LANGS[0];
        var compact = this.getAttribute('variant') === 'compact';
        this.style.position = 'relative';
        this.style.display = 'inline-block';
        this._root.innerHTML =
          '<button type="button" data-role="btn" style="display:flex;align-items:center;gap:' + (compact ? '7px' : '9px') + ';background:#fff;border:1.5px solid #2F63B8;border-radius:999px;padding:' + (compact ? '5px 11px 5px 6px' : '6px 14px 6px 7px') + ';cursor:pointer;font:inherit;font-size:' + (compact ? '13px' : '14px') + ';font-weight:600;color:#1E3557">' +
            '<span style="width:' + (compact ? '22px' : '26px') + ';height:' + (compact ? '22px' : '26px') + ';border-radius:50%;overflow:hidden;border:1.5px solid #2F63B8;flex-shrink:0;display:block">' + flag(cur) + '</span>' +
            '<span style="white-space:nowrap">' + curDef.label + '</span>' +
            '<svg width="11" height="7" viewBox="0 0 12 8" fill="none" style="transform:rotate(' + (this.open ? '180' : '0') + 'deg);transition:transform .18s ease"><path d="M1.2 1.6 6 6.2l4.8-4.6" stroke="#2F63B8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</button>' +
          (this.open
            ? '<div style="position:absolute;top:calc(100% + 6px);' + (this.getAttribute('align') === 'right' ? 'right:0' : 'left:0') + ';z-index:200;background:#fff;border:1.5px solid #2F63B8;border-radius:14px;padding:5px;min-width:150px;box-shadow:0 10px 24px -8px rgba(47,99,184,.45)">' +
                LANGS.map(function (l) {
                  var on = l.code === cur;
                  return '<div data-code="' + l.code + '" style="display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:10px;cursor:pointer;font-size:13.5px;font-weight:' + (on ? '700' : '500') + ';color:' + (on ? '#2F63B8' : '#1E3557') + ';background:' + (on ? 'rgba(47,99,184,.08)' : 'transparent') + '">' +
                    '<span style="width:22px;height:22px;border-radius:50%;overflow:hidden;border:1.5px solid #2F63B8;flex-shrink:0;display:block;pointer-events:none">' + flag(l.code) + '</span>' +
                    '<span style="pointer-events:none;white-space:nowrap">' + l.label + '</span></div>';
                }).join('') +
              '</div>'
            : '');

        var self = this;
        this._root.querySelector('[data-role="btn"]').addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          self.open = !self.open; self.render();
        });
        Array.prototype.forEach.call(this._root.querySelectorAll('[data-code]'), function (el) {
          el.addEventListener('click', function (e) {
            e.stopPropagation();
            setLang(el.getAttribute('data-code'));
            self.open = false; self.render();
          });
        });
      }
    });
  }

  window.__washedI18N = { setLang: setLang, getLang: getLang, apply: apply, DICT: DICT };

  (function () {
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(l);
    var st = document.createElement('style');
    st.textContent = "*,*::before,*::after{font-family:'Pretendard','Noto Sans SC','Noto Sans JP',-apple-system,BlinkMacSystemFont,system-ui,sans-serif !important}";
    document.head.appendChild(st);
  })();

  if (document.body) apply();
  document.addEventListener('DOMContentLoaded', apply);
  new MutationObserver(apply).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  window.addEventListener('storage', function (e) { if (e.key === 'washed_lang') apply(); });
  document.addEventListener('visibilitychange', function () { scheduled = false; apply(); });
})();
