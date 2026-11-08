"use client";

import type { ReactNode } from "react";

import { DateRangeField } from "@/components/date-picker/DateRangeField";
import type { TripFormValues } from "@/lib/rooms/trip-form";
import { cn } from "@/lib/utils";

const FIELD_BOX_CLASS =
  "flex h-12 w-full min-w-0 items-center rounded-lg border border-border bg-fill-subtle pl-3.5 pr-2.5 text-body-m-regular mobile:text-body-s-regular text-text-subtle";

function Field({ label, className, children }: Readonly<{ label: string; className?: string; children: ReactNode }>) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <p className="text-label-xs-regular text-text">{label}</p>
      {children}
    </div>
  );
}

/** 여행 정보 수정 권한이 없을 때 보이는 읽기 전용 칸. 고칠 수 있을 때의 칸은 `RoomTripEditForm`이 form.Field로 그린다 */
export function RoomTripReadOnlyFields({ idPrefix, values }: Readonly<{ idPrefix: string; values: TripFormValues }>) {
  const { title, destinations, startDate, endDate } = values;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Field label="여행 제목">
        <p className={FIELD_BOX_CLASS}><span className="truncate">{title.trim() || "—"}</span></p>
      </Field>
      <Field label="목적지">
        <p className={FIELD_BOX_CLASS}><span className="truncate">{destinations.join(", ") || "—"}</span></p>
      </Field>
      <DateRangeField idPrefix={idPrefix} value={{ start: startDate, end: endDate }} readOnly onChange={() => {}} />
    </div>
  );
}
