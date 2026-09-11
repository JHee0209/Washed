import type { ComponentProps, ReactNode } from "react";

/**
 * docs/design/*.dc.html 에서 두 번 이상 나오는 조각만 옮긴 것.
 * 인라인 style 은 globals.css 의 @theme 토큰 유틸리티로 바꿨고, 마크업·간격·상태는 원본 그대로다.
 * style-hover / style-focus → hover: / focus: 클래스.
 */

/* 배지 — "변경됨"(Main) · "예정"(Detail, primary) · "진행 중"/"지난 일정"(Detail, neutral) */
export function Badge({ tone = "primary", children }: { tone?: "primary" | "neutral"; children: ReactNode }) {
  const toneClass =
    tone === "primary" ? "bg-primary-soft text-primary-strong" : "bg-neutral-soft text-text-muted";
  return (
    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold whitespace-nowrap ${toneClass}`}>
      {children}
    </span>
  );
}

/* 이름 칩 — Detail 의 참석 · 불참 · 미응답 명단 */
export function NameChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-bg px-3 py-1 text-sm text-text">
      {children}
    </span>
  );
}

/* 입력칸 — Form 의 네 칸 · Detail 의 이름 칸 */
export function TextInput(props: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className="min-h-[var(--tap-min)] w-full rounded-md border border-border bg-surface px-4 py-3 text-base text-text outline-none placeholder:text-text-faint focus:border-primary"
    />
  );
}

/* 라벨 + 입력칸 — Form 의 네 칸. count 는 제목 칸의 "0/30자", error 는 날짜 칸의 "지난 날짜입니다" */
export function Field({
  id,
  label,
  count,
  error,
  ...input
}: { id: string; label: string; count?: string; error?: string } & ComponentProps<"input">) {
  const labelEl = (
    <label htmlFor={id} className="text-sm font-bold text-text-muted">
      {label}
    </label>
  );
  return (
    <div className="flex flex-col gap-2">
      {count === undefined ? (
        labelEl
      ) : (
        <div className="flex items-center justify-between gap-2">
          {labelEl}
          <span className="text-xs text-text-faint">{count}</span>
        </div>
      )}
      <TextInput id={id} {...input} />
      {error !== undefined && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

/* 전체 너비 버튼 — Form 의 등록/수정. disabled 면 비활성 모양(neutral-soft) */
export function PrimaryButton({ disabled, ...props }: ComponentProps<"button">) {
  const stateClass = disabled
    ? "border border-border bg-neutral-soft text-text-faint cursor-not-allowed"
    : "bg-primary text-surface cursor-pointer hover:bg-primary-strong";
  return (
    <button
      type="button"
      {...props}
      disabled={disabled}
      className={`h-[var(--control-height)] w-full rounded-md text-base font-bold ${stateClass}`}
    />
  );
}

/* 테두리 버튼 — Detail 의 참석 · 불참 (둘 다 primary — 초록 없음) */
export function OutlineButton(props: ComponentProps<"button">) {
  return (
    <button
      type="button"
      {...props}
      className="min-h-[var(--tap-min)] flex-1 cursor-pointer rounded-md border-[1.5px] border-primary bg-surface text-md font-bold text-primary hover:bg-primary-soft"
    />
  );
}

/* 원형 아이콘 버튼 — Main 의 "일정 추가"(primary) · Form/Detail 의 뒤로가기(surface) */
export function IconButton({ tone = "surface", ...props }: { tone?: "primary" | "surface" } & ComponentProps<"button">) {
  const toneClass =
    tone === "primary"
      ? "bg-primary text-surface shadow-card hover:bg-primary-strong"
      : "border border-border bg-surface text-text hover:border-primary";
  return (
    <button
      type="button"
      {...props}
      className={`flex h-[var(--tap-min)] w-[var(--tap-min)] shrink-0 cursor-pointer items-center justify-center rounded-full ${toneClass}`}
    />
  );
}
