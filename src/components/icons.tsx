/**
 * 선 아이콘 — docs/design/*.dc.html 의 svg 를 그대로 옮긴 것.
 * 24×24 viewBox · fill:none · stroke:currentColor · 둥근 캡(디자인 시스템 「아이콘」).
 * 크기: 목록/상세 안 인라인 14px · 원형 버튼 안 20px.
 */
type IconProps = {
  /** px — 14(인라인) · 20(원형 버튼 안) · 40(빈 상태) */
  size?: number;
  /** 빈 상태 아이콘만 1.6 */
  strokeWidth?: number;
  className?: string;
};

function Svg({ size = 14, strokeWidth = 2, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </Svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </Svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </Svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M15.5 14.3c2.5.4 4.5 2.6 4.5 5.7" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg size={20} {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Svg size={20} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Svg>
  );
}
