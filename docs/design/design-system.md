# 팀 일정 관리 — 디자인 시스템

토큰 원본: `tokens.css`. 세 화면은 이 토큰만 참조한다(인라인 임의 값 없음).
각 화면(`.dc.html`)은 스트리밍 중 깨짐을 막기 위해 동일한 `:root` 블록을 helmet에 복제해 둔다 —
값을 바꿀 때는 `tokens.css`와 세 화면의 helmet을 함께 수정한다.

## 분위기
차분함 · 또렷함 · 가벼움. 그라데이션·장식 없음. 폰 캘린더/메신저 공지의 담백한 느낌.

## 색
| 토큰 | 값 | 쓰임 |
|---|---|---|
| `--color-primary` | `#f97316` | 버튼·강조 (참석/불참 버튼도 이 색, 초록 없음) |
| `--color-primary-strong` | `#ea580c` | hover·강조 텍스트 |
| `--color-primary-soft` | `#fff1e2` | "변경됨"·"예정" 배지 배경 |
| `--color-bg` | `#faf7f3` | 화면 배경(웜 오프화이트) |
| `--color-surface` | `#ffffff` | 카드·입력칸 |
| `--color-border` | `#ece5da` | 테두리(옅은 웜그레이) |
| `--color-text` | `#2b2620` | 본문 |
| `--color-text-muted` | `#8a7f70` | 보조 정보 |
| `--color-text-faint` | `#bdb3a3` | 비활성·플레이스홀더 |
| `--color-neutral-soft` | `#f1ece4` | 중립 배지·비활성 버튼 배경 |
| `--color-danger` | `#d1453b` | "지난 날짜입니다" 경고 |

## 글자
`--font-sans`: Noto Sans KR → 시스템 산세리프 폴백.
크기: `--text-xs 12` · `--text-sm 13` · `--text-md 14` · `--text-base 15` · `--text-lg 17` · `--text-xl 20`.
굵기: `--weight-regular 400` · `--weight-medium 500` · `--weight-bold 700` · `--weight-black 900`.

## 간격 · 반경 · 크기
간격: `--space-1 4` → `--space-6 24` (4의 배수).
반경: `--radius-sm 8` · `--radius-md 14`(입력칸·버튼) · `--radius-lg 20`(카드) · `--radius-full`(원형·칩·배지).
크기: `--tap-min 44px`(누르는 요소 최소) · `--control-height 48px`(전체 너비 버튼) · `--screen-width 390px`.
그림자: `--shadow-card` (카드·플로팅 버튼에만).

## 아이콘
이모지 없음. 24×24 viewBox, `fill:none`, `stroke-width:2`, 둥근 캡의 선 아이콘. 목록/상세 내 인라인 아이콘은 14px, 원형 버튼 안은 20px.

## 화면
| 파일 | 화면 | 상태 토글(Tweaks) |
|---|---|---|
| `Main.dc.html` | 일정 목록 | `isEmpty` — 빈 상태 |
| `ScheduleForm.dc.html` | 일정 입력 | `mode` 등록/수정 · `allFilled` 버튼 활성 · `showDateError` 지난 날짜 경고 |
| `ScheduleDetail.dc.html` | 일정 상세 | `status` 예정/진행 중/지난 일정 · `isOrganizer` · `allResponded` 미응답 없음 |
