import { ChevronLeftIcon, ChevronRightIcon } from "@/assets/icons";

const DIRECTIONS = {
  prev: { label: "이전 달", Icon: ChevronLeftIcon },
  next: { label: "다음 달", Icon: ChevronRightIcon },
} as const;

export function MonthNavButton({
  direction,
  disabled,
  onClick,
}: Readonly<{ direction: keyof typeof DIRECTIONS; disabled?: boolean; onClick: () => void }>) {
  const { label, Icon } = DIRECTIONS[direction];
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-icon focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-primary disabled:text-icon-disabled"
    >
      <Icon size={20} />
    </button>
  );
}
