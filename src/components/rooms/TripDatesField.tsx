import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useId, useRef, useState, type ComponentProps, type RefObject } from "react";

import { CalendarIcon, CloseIcon } from "@/assets/icons";
import {
  EMPTY_RANGE,
  formatYmdKoreanFull,
  formatYmdSlash,
  pickRangeDate,
  type DateRange,
  type RangeEdge,
  type RangeSelection,
} from "@/components/date-picker/calendar";
import { DatePicker } from "@/components/date-picker/DatePicker";
import { DateRangePanel } from "@/components/date-picker/DateRangePanel";
import { Button } from "@/components/ui/button";
import { Field, FieldBox, FieldBoxLabel, FieldBoxRow, FieldError, fieldBoxVariants } from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from "@/components/ui/responsive-dialog";
import { useMobileLayout } from "@/hooks/useMobileLayout";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "YY/MM/DD";
const PICKER_TITLE = "날짜 선택";
const NO_COLLISION_AVOIDANCE = { side: "none", align: "none", fallbackAxisSide: "none" } as const;

type DesktopPicker = { presentation: "anchored"; rowRef: RefObject<HTMLElement | null> } | { presentation: "modal" };

type TripDatesFieldProps =
  | { variant: "readOnly"; value: DateRange }
  | {
      variant: "edit";
      value: DateRange;
      min?: string;
      error?: string;
      desktopPicker: DesktopPicker;
      onChange: (next: DateRange) => void;
    };

function describeDate(ymd: string) {
  return ymd ? formatYmdKoreanFull(ymd) : "선택 안 됨";
}

function TripDatesContent({
  value: { start, end },
  iconClassName,
}: Readonly<{ value: DateRange; iconClassName: string }>) {
  return (
    <>
      <FieldBoxLabel>일정</FieldBoxLabel>
      <FieldBoxRow>
        <CalendarIcon size={20} className={cn("shrink-0", iconClassName)} />
        <span className="truncate px-1">
          <span className={cn(!start && "text-text-subtle")}>{formatYmdSlash(start) || PLACEHOLDER}</span>
          <span className={cn(!(start && end) && "text-text-subtle")}> - </span>
          <span className={cn(!end && "text-text-subtle")}>{formatYmdSlash(end) || PLACEHOLDER}</span>
        </span>
      </FieldBoxRow>
    </>
  );
}

function LiveRangePanel({
  value,
  min,
  onChange,
  onRangeComplete,
}: Readonly<{ value: DateRange; min?: string; onChange: (next: DateRange) => void; onRangeComplete: () => void }>) {
  const [edge, setEdge] = useState<RangeEdge>("start");
  return (
    <DateRangePanel
      value={value}
      min={min}
      onSelect={(ymd) => {
        const next = pickRangeDate({ range: value, edge }, ymd);
        setEdge(next.edge);
        onChange(next.range);
        if (next.edge === "start") onRangeComplete();
      }}
      onReset={() => {
        setEdge("start");
        onChange(EMPTY_RANGE);
      }}
    />
  );
}

function DraftMonthPicker({
  value,
  min,
  onConfirm,
}: Readonly<{ value: DateRange; min?: string; onConfirm: (next: DateRange) => void }>) {
  const [selection, setSelection] = useState<RangeSelection>({ range: value, edge: "start" });
  return (
    <>
      <ResponsiveDialogBody>
        <DatePicker
          value={selection.range}
          min={min}
          onSelect={(ymd) => setSelection((current) => pickRangeDate(current, ymd))}
        />
      </ResponsiveDialogBody>
      <ResponsiveDialogFooter>
        <ResponsiveDialogClose render={<Button variant="weak" />}>취소</ResponsiveDialogClose>
        <Button disabled={!selection.range.start} onClick={() => onConfirm(selection.range)}>
          확인
        </Button>
      </ResponsiveDialogFooter>
    </>
  );
}

function AnchoredPanelHeader() {
  return (
    <div className="flex items-center justify-between gap-3">
      <PopoverPrimitive.Title className="min-w-0 truncate text-title-l text-text">
        {PICKER_TITLE}
      </PopoverPrimitive.Title>
      <PopoverPrimitive.Close
        aria-label="날짜 선택 닫기"
        className="-m-2.5 grid size-11 shrink-0 cursor-pointer place-items-center rounded-full text-icon-subtle transition-colors duration-120 ease-out hover:bg-fill focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <CloseIcon size={24} />
      </PopoverPrimitive.Close>
    </div>
  );
}

function EditableTripDatesField({
  value,
  min,
  error,
  desktopPicker,
  onChange,
}: Readonly<Extract<TripDatesFieldProps, { variant: "edit" }>>) {
  const isMobileLayout = useMobileLayout();
  const [open, setOpen] = useState(false);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const rowRef = desktopPicker.presentation === "anchored" ? desktopPicker.rowRef : null;
  const panelAnchor = () => {
    const row = rowRef?.current;
    const field = fieldRef.current;
    if (!row || !field) return null;
    return {
      contextElement: field,
      getBoundingClientRect: () => {
        const rowRect = row.getBoundingClientRect();
        const fieldRect = field.getBoundingClientRect();
        return new DOMRect(rowRect.left, fieldRect.top, rowRect.width, fieldRect.height);
      },
    };
  };
  const errorId = useId();
  const shownError = open ? undefined : error;
  const triggerProps = {
    "aria-label": `일정, 시작 날짜 ${describeDate(value.start)}, 종료 날짜 ${describeDate(value.end)}`,
    "aria-invalid": shownError ? true : undefined,
    "aria-describedby": shownError ? errorId : undefined,
    className: fieldBoxVariants({ control: "trigger" }),
  } satisfies ComponentProps<"button">;
  const triggerContent = <TripDatesContent value={value} iconClassName="text-icon-subtle" />;

  let picker;
  if (desktopPicker.presentation === "anchored" && !isMobileLayout) {
    picker = (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger {...triggerProps} ref={fieldRef} data-trip-dates-open={open || undefined}>
          {triggerContent}
        </PopoverTrigger>
        <PopoverContent
          variant="modal"
          anchor={panelAnchor}
          side="bottom"
          align="start"
          sideOffset={14}
          collisionAvoidance={NO_COLLISION_AVOIDANCE}
          initialFocus={false}
        >
          <AnchoredPanelHeader />
          <LiveRangePanel value={value} min={min} onChange={onChange} onRangeComplete={() => setOpen(false)} />
        </PopoverContent>
      </Popover>
    );
  } else {
    picker = (
      <ResponsiveDialog open={open} onOpenChange={setOpen} drawer={isMobileLayout}>
        <ResponsiveDialogTrigger {...triggerProps}>{triggerContent}</ResponsiveDialogTrigger>
        <ResponsiveDialogContent closeLabel="날짜 선택 닫기" initialFocus={false}>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{PICKER_TITLE}</ResponsiveDialogTitle>
          </ResponsiveDialogHeader>
          <DraftMonthPicker
            value={value}
            min={min}
            onConfirm={(next) => {
              onChange(next);
              setOpen(false);
            }}
          />
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    );
  }

  return (
    <Field>
      {picker}
      <FieldError id={errorId}>{shownError}</FieldError>
    </Field>
  );
}

export function TripDatesField(props: Readonly<TripDatesFieldProps>) {
  if (props.variant === "edit") return <EditableTripDatesField {...props} />;
  return (
    <FieldBox control="readOnly">
      <TripDatesContent value={props.value} iconClassName="text-icon-disabled" />
    </FieldBox>
  );
}
