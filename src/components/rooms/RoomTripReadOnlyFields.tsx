import { TripDatesField } from "@/components/rooms/TripDatesField";
import { FieldBox, FieldBoxLabel, FieldBoxRow } from "@/components/ui/field";
import type { TripFormValues } from "@/lib/rooms/trip-form";

function ReadOnlyTextField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <FieldBox control="readOnly">
      <FieldBoxLabel>{label}</FieldBoxLabel>
      <FieldBoxRow>
        <span className="truncate px-1">{value || "—"}</span>
      </FieldBoxRow>
    </FieldBox>
  );
}

export function RoomTripReadOnlyFields({ values }: Readonly<{ values: TripFormValues }>) {
  const { title, destinations, startDate, endDate } = values;
  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <ReadOnlyTextField label="여행 제목" value={title.trim()} />
      <div className="grid min-w-0 grid-cols-2 items-start gap-3 max-md:grid-cols-1 max-md:gap-3.5 mobile:grid-cols-1 mobile:gap-3.5">
        <ReadOnlyTextField label="목적지" value={destinations.join(", ")} />
        <TripDatesField variant="readOnly" value={{ start: startDate, end: endDate }} />
      </div>
    </div>
  );
}
