import { CalendarIcon, ClockIcon, PinIcon, UsersIcon } from "@/components/icons";
import { Badge } from "@/components/ui";

/* 일정 카드 — docs/design/Main.dc.html 의 sc-for 안 카드 그대로 (map 으로 옮긴다) */
export function ScheduleCard({
  title,
  date,
  time,
  place,
  attendeeLabel,
  changed,
  onClick,
}: {
  title: string;
  /** 화면에 보이는 문자열 그대로 — 예 "9월 12일(토)" */
  date: string;
  time: string;
  place: string;
  /** 예 "참석 8명" */
  attendeeLabel: string;
  /** 변경됨 표시 */
  changed?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-left text-text shadow-card hover:border-primary"
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span className="text-lg leading-tight font-bold">{title}</span>
        {changed && <Badge>변경됨</Badge>}
      </div>
      <div className="flex w-full flex-wrap gap-3">
        <span className="flex items-center gap-1 text-sm text-text-muted">
          <CalendarIcon />
          {date}
        </span>
        <span className="flex items-center gap-1 text-sm text-text-muted">
          <ClockIcon />
          {time}
        </span>
        <span className="flex items-center gap-1 text-sm text-text-muted">
          <PinIcon />
          {place}
        </span>
      </div>
      <div className="flex w-full items-center gap-2 border-t border-border pt-3 text-sm text-text-muted">
        <UsersIcon />
        <span>{attendeeLabel}</span>
      </div>
    </button>
  );
}
