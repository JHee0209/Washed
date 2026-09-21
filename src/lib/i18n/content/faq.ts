// 자주 묻는 질문 (F22 · 설정 > 도움말).
//
// **사전(ko.ts)이 아니라 구조화된 데이터로 둔다.** 화면이 .map() 으로 그리는 실제
// 목록이고, 문단마다 key 를 매기면 네 언어의 문단 수를 손으로 맞춰야 해서 반드시
// 어긋난다. 여기서는 언어별로 같은 `id` 를 가진 항목을 나란히 두고, 개수 · 순서가
// 같은지는 테스트가 지킨다(content.test.ts).
//
// `id` 는 열림 상태(openFaqId)라서 **네 언어에서 반드시 같아야 한다.**
// `answer` 의 `\n` 은 화면이 `whiteSpace: 'pre-line'` 으로 그대로 그린다 — 줄바꿈이
// 곧 목록의 모양이라 배열로 쪼개지 않는다(기존 렌더러를 그대로 쓴다).

import type { Lang } from '../lang.ts';

export type FaqItem = { id: string; question: string; answer: string };
export type FaqSection = { title: string; items: FaqItem[] };

const ko: FaqSection[] = [
  {
    title: '줄서기 · 배정',
    items: [
      {
        id: 'q1',
        question: '배정은 어떻게 정해지나요?',
        answer:
          '· 줄을 선 순서대로 자동 배정됩니다.\n  앞사람이 줄을 빠지거나 사용을 끝내면 순서가 당겨져요.\n· 같은 종류의 기기 중 가장 먼저 비는 기기에 배정되기 때문에\n  특정 호기를 지정할 수는 없습니다.\n· 내 차례가 오기 10분 전에 미리 알림을 보내드립니다.',
      },
      {
        id: 'q2',
        question: '여러 대에 동시에 줄 설 수 있나요?',
        answer:
          '· 세탁기와 건조기에 각각 한 번씩, 최대 두 줄까지 설 수 있습니다.\n· 세탁 후 건조까지 하실 계획이라면, 건조기 줄에도 미리 함께 서두는 편이 좋습니다.',
      },
      {
        id: 'q3',
        question: '줄을 뺐다가 다시 설 수 있나요?',
        answer:
          '· 가능합니다.\n  다만, 다시 설 때는 맨 뒤에서 시작합니다.\n· 이미 배정된 상태에서 줄을 빼면 그 기기는 바로 다음 사람에게 넘어갑니다.',
      },
    ],
  },
  {
    title: '이용 중',
    items: [
      {
        id: 'q4',
        question: '세탁기에 이전 사용자의 세탁물이 남아 있어요',
        answer:
          '· 설정 > 신고하기 > 해당 사유를 선택해 접수해 주세요.\n· 확인되면 이전 사용자에게 경고가 부여되고, 경고가 3회가\n  쌓이면 3일 동안 줄서기가 제한됩니다.\n· 이전 사용자는 분실이나 훼손 문제로 이어질 수 있으니,\n  주의 부탁드립니다.',
      },
      {
        id: 'q5',
        question: '세탁이 일찍 끝났어요',
        answer:
          '· 홈 화면에서 "다했어요"를 눌러주세요.\n  남은 시간과 관계없이 이용이 종료되고 다음 사람에게 바로 배정됩니다.\n· 모든 사용자들은 세탁이 끝남과 동시에 항상 "다했어요" 버튼을 눌러주세요.',
      },
      {
        id: 'q6',
        question: 'QR이 인식되지 않아요',
        answer:
          '· 기기 문에 붙은 QR을 화면 가운데에 맞추고, 손 그림자가 지지 않게 해주세요.\n· 코드가 찢어졌거나 오염되어 인식되지 않으면 설정 화면의\n  신고하기에서 "기기가 고장났어요"로 접수해 주세요.\n· 배정 후 10분이 지나기 전에 접수하면 경고가 부여되지 않습니다.',
      },
    ],
  },
  {
    title: '경고',
    items: [
      {
        id: 'q7',
        question: '경고는 언제 받나요?',
        answer:
          "네 가지 경우에 부여됩니다.\n· 배정 후 10분 안에 사용을 시작하지 않은 경우\n· 다했어요 버튼을 클릭하지 않은 경우\n· 타이머 종료 후 3분의 세탁 수거 시간이 지났는데도\n  세탁물을 수거해 가지 않았을 경우\n· 내 차례가 아닌데 기기를 사용해 다른 사용자의 신고가 확인 된 경우\n\n경고가 3회 쌓이면 3일 동안 줄서기가 제한됩니다.\n단, '다했어요' 버튼 미클릭과 '세탁물 미수거'는 함께 발생하더라도 중복 적용되지 않고 통합 1회의 경고만 부여됩니다.",
      },
      {
        id: 'q8',
        question: '경고는 사라지나요?',
        answer:
          '· 매달 1일에 0회로 초기화됩니다.\n  다만, 이미 시작된 3일 이용 제한은 초기화와 관계없이 기간을 모두 채워야 해제됩니다.\n· 경고 내역은 기록 화면에서 언제든 확인할 수 있습니다.',
      },
    ],
  },
  {
    title: '계정 · 알림',
    items: [
      {
        id: 'q9',
        question: '알림이 오지 않아요',
        answer:
          '· 먼저 휴대폰 설정에서 Washed의 알림 권한이 켜져 있는지 확인해 주세요.\n· 권한이 켜져 있다면 앱의 설정 > 알림이 켜져 있는지 확인해 주세요.\n· 방해 금지 모드나 절전 모드가 켜져 있으면 알림이 늦게 도착할 수 있습니다.',
      },
    ],
  },
];

const en: FaqSection[] = [
  {
    title: 'Queues and assignment',
    items: [
      {
        id: 'q1',
        question: 'How is a machine assigned to me?',
        answer:
          '· Machines are assigned automatically, in the order people joined the queue.\n  If someone ahead of you leaves or finishes, everyone moves up.\n· You are given the first machine of that type to become free,\n  so you can’t pick a specific machine number.\n· We notify you 10 minutes before your turn comes up.',
      },
      {
        id: 'q2',
        question: 'Can I queue for more than one machine at a time?',
        answer:
          '· You can be in up to two queues — one for a washer and one for a dryer.\n· If you plan to dry after washing, it’s best to join the dryer queue at the same time.',
      },
      {
        id: 'q3',
        question: 'Can I leave a queue and join again?',
        answer:
          '· Yes.\n  However, you start again at the back of the queue.\n· If you leave after a machine has been assigned to you, it passes to the next person immediately.',
      },
    ],
  },
  {
    title: 'While you’re using a machine',
    items: [
      {
        id: 'q4',
        question: 'Someone else’s laundry is still in the washer',
        answer:
          '· Go to Settings > Report and submit it with the matching reason.\n· Once confirmed, the previous user gets a warning, and after 3 warnings\n  they can’t join a queue for 3 days.\n· Please be careful — moving someone else’s laundry can lead to loss or damage.',
      },
      {
        id: 'q5',
        question: 'My laundry finished early',
        answer:
          '· Tap “Done” on the home screen.\n  Your session ends regardless of the time left and the machine goes to the next person right away.\n· Please always tap “Done” as soon as your laundry is finished.',
      },
      {
        id: 'q6',
        question: 'The QR code won’t scan',
        answer:
          '· Line up the QR code on the machine door in the middle of the screen, and keep your hand from casting a shadow.\n· If the code is torn or dirty and won’t scan, go to Settings > Report\n  and submit it as “The machine is broken”.\n· If you report it within 10 minutes of being assigned, you won’t get a warning.',
      },
    ],
  },
  {
    title: 'Warnings',
    items: [
      {
        id: 'q7',
        question: 'When do I get a warning?',
        answer:
          'There are four cases.\n· You didn’t start using the machine within 10 minutes of being assigned\n· You didn’t tap the Done button\n· You didn’t collect your laundry within the 3-minute pickup window\n  after the timer ended\n· You used a machine when it wasn’t your turn and another user’s report was confirmed\n\nAfter 3 warnings you can’t join a queue for 3 days.\nNote that not tapping “Done” and not collecting your laundry count as a single warning even when they happen together.',
      },
      {
        id: 'q8',
        question: 'Do warnings go away?',
        answer:
          '· They reset to zero on the 1st of each month.\n  However, a 3-day restriction that has already started runs its full length regardless of the reset.\n· You can check your warning history any time on the History screen.',
      },
    ],
  },
  {
    title: 'Account and notifications',
    items: [
      {
        id: 'q9',
        question: 'I’m not getting notifications',
        answer:
          '· First check that notification permission for Washed is on in your phone settings.\n· If it is on, check that Settings > Notifications is on in the app.\n· Do Not Disturb or battery saver mode can delay notifications.',
      },
    ],
  },
];

const zh: FaqSection[] = [
  {
    title: '排队与分配',
    items: [
      {
        id: 'q1',
        question: '机器是怎么分配的？',
        answer:
          '· 按排队顺序自动分配。\n  前面的人退出排队或使用结束后，顺序会自动提前。\n· 会分配给同类机器中最先空出的一台，\n  因此无法指定具体的机器编号。\n· 轮到您的 10 分钟前会提前通知您。',
      },
      {
        id: 'q2',
        question: '可以同时排多台机器吗？',
        answer:
          '· 洗衣机和烘干机各一次，最多可排两个队。\n· 如果打算洗完后再烘干，建议同时排烘干机的队。',
      },
      {
        id: 'q3',
        question: '退出排队后可以重新排吗？',
        answer:
          '· 可以。\n  但重新排队时将从最后开始。\n· 如果在已分配的状态下退出，该机器会立即转给下一位。',
      },
    ],
  },
  {
    title: '使用中',
    items: [
      {
        id: 'q4',
        question: '洗衣机里还有上一位用户的衣物',
        answer:
          '· 请在「设置 > 举报」中选择相应事由提交。\n· 确认属实后会给上一位用户一次警告，累计 3 次后\n  将有 3 天无法排队。\n· 擅自移动他人衣物可能造成遗失或损坏，请务必注意。',
      },
      {
        id: 'q5',
        question: '洗衣提前结束了',
        answer:
          '· 请在首页点击「完成了」。\n  无论剩余时间多少，使用都会结束并立即分配给下一位。\n· 请所有用户在洗衣结束的同时务必点击「完成了」按钮。',
      },
      {
        id: 'q6',
        question: '二维码扫不出来',
        answer:
          '· 请将机器门上的二维码对准屏幕中央，注意不要让手挡出阴影。\n· 如果二维码破损或污损无法识别，请在设置画面的\n  举报中选择「机器坏了」提交。\n· 在分配后 10 分钟内提交的话不会产生警告。',
      },
    ],
  },
  {
    title: '警告',
    items: [
      {
        id: 'q7',
        question: '什么情况下会收到警告？',
        answer:
          '以下四种情况会被记警告。\n· 分配后 10 分钟内未开始使用\n· 未点击「完成了」按钮\n· 计时结束后超过 3 分钟的取衣时间\n  仍未取走衣物\n· 未轮到自己却使用机器，且其他用户的举报被确认\n\n累计 3 次警告后将有 3 天无法排队。\n但未点击「完成了」与「未取走衣物」即使同时发生，也不会重复计算，只记 1 次警告。',
      },
      {
        id: 'q8',
        question: '警告会消除吗？',
        answer:
          '· 每月 1 日会重置为 0 次。\n  但已经开始的 3 天使用限制与重置无关，必须满期后才会解除。\n· 警告记录可随时在「记录」画面中查看。',
      },
    ],
  },
  {
    title: '账号与通知',
    items: [
      {
        id: 'q9',
        question: '收不到通知',
        answer:
          '· 请先在手机设置中确认 Washed 的通知权限是否已开启。\n· 若权限已开启，请确认应用内「设置 > 通知」是否已开启。\n· 开启勿扰模式或省电模式时，通知可能会延迟到达。',
      },
    ],
  },
];

const ja: FaqSection[] = [
  {
    title: '順番待ちと割り当て',
    items: [
      {
        id: 'q1',
        question: '割り当てはどのように決まりますか？',
        answer:
          '· 並んだ順に自動で割り当てられます。\n  前の方が順番待ちを取り消したり利用を終えると、順番が繰り上がります。\n· 同じ種類の機器のうち最初に空いたものに割り当てられるため、\n  特定の号機を指定することはできません。\n· 順番の 10 分前にお知らせします。',
      },
      {
        id: 'q2',
        question: '複数の機器に同時に並べますか？',
        answer:
          '· 洗濯機と乾燥機にそれぞれ 1 回ずつ、最大 2 つまで並べます。\n· 洗濯のあと乾燥までされる場合は、乾燥機の順番待ちにも同時に並んでおくことをおすすめします。',
      },
      {
        id: 'q3',
        question: '順番待ちを取り消して、また並べますか？',
        answer:
          '· 可能です。\n  ただし、並び直すと最後尾からになります。\n· すでに割り当てられた状態で取り消すと、その機器はすぐ次の方に移ります。',
      },
    ],
  },
  {
    title: 'ご利用中',
    items: [
      {
        id: 'q4',
        question: '洗濯機に前の方の洗濯物が残っています',
        answer:
          '· 設定 > 通報 から、該当する事由を選んで受け付けてください。\n· 確認されると前の方に警告が付き、警告が 3 回たまると\n  3 日間、順番待ちができなくなります。\n· 他の方の洗濯物は紛失や破損につながるおそれがあるため、\n  お取り扱いにご注意ください。',
      },
      {
        id: 'q5',
        question: '洗濯が早く終わりました',
        answer:
          '· ホーム画面で「完了しました」を押してください。\n  残り時間に関係なく利用が終了し、すぐ次の方に割り当てられます。\n· 洗濯が終わったら、必ず「完了しました」ボタンを押してください。',
      },
      {
        id: 'q6',
        question: 'QR が読み取れません',
        answer:
          '· 機器の扉に貼られた QR を画面の中央に合わせ、手の影が入らないようにしてください。\n· コードが破れていたり汚れていて読み取れない場合は、設定画面の\n  通報から「機器が故障しています」で受け付けてください。\n· 割り当てから 10 分が過ぎる前に受け付ければ、警告は付きません。',
      },
    ],
  },
  {
    title: '警告',
    items: [
      {
        id: 'q7',
        question: '警告はどんなときに付きますか？',
        answer:
          '次の 4 つの場合に付きます。\n· 割り当てから 10 分以内に利用を開始しなかった場合\n· 「完了しました」ボタンを押さなかった場合\n· タイマー終了後、3 分の回収時間を過ぎても\n  洗濯物を回収しなかった場合\n· 自分の順番ではないのに機器を使い、他の方の通報が確認された場合\n\n警告が 3 回たまると 3 日間、順番待ちができなくなります。\nなお「完了しました」の押し忘れと「洗濯物の未回収」は同時に起きても重複せず、まとめて 1 回の警告になります。',
      },
      {
        id: 'q8',
        question: '警告は消えますか？',
        answer:
          '· 毎月 1 日に 0 回にリセットされます。\n  ただし、すでに始まっている 3 日間の利用制限は、リセットに関係なく期間が満了するまで解除されません。\n· 警告の履歴は履歴画面でいつでも確認できます。',
      },
    ],
  },
  {
    title: 'アカウントと通知',
    items: [
      {
        id: 'q9',
        question: '通知が届きません',
        answer:
          '· まずスマートフォンの設定で Washed の通知が許可されているかご確認ください。\n· 許可されている場合は、アプリの 設定 > 通知 がオンになっているかご確認ください。\n· おやすみモードや省電力モードがオンだと、通知が遅れて届くことがあります。',
      },
    ],
  },
];

export const FAQ: Record<Lang, FaqSection[]> = { ko, en, zh, ja };
