"use client";

/** Keep incomplete input in the draft; only canonical HH:mm reaches the API. */
export function TimeInput({
  label,
  value,
  onChange,
  disabled,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  describedBy: string;
}) {
  const parts = value ? value.split(":") : ["", ""];
  const update = (index: number, next: string) => {
    const updated = [...parts];
    updated[index] = next;
    // Entering one part of an unset time starts at minute/hour zero.
    if (!value) updated[1 - index] = "00";
    onChange(updated.every((part) => part === "") ? "" : updated.join(":"));
  };

  return (
    <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
      {[{ unit: "시", count: 24 }, { unit: "분", count: 60 }].map(({ unit, count }, index) => {
        const part = parts[index] ?? "";
        const invalid = !!value && (!/^\d{1,2}$/.test(part) || Number(part) >= count);
        return (
          <div key={unit} className="min-w-0">
            <div className="flex items-center gap-1 rounded-lg border border-gray-border bg-white px-2 focus-within:ring-2 focus-within:ring-primary/40">
              <input
                type="text"
                inputMode="numeric"
                aria-label={`${label} ${unit}`}
                aria-invalid={invalid}
                aria-describedby={describedBy}
                value={part}
                placeholder="--"
                disabled={disabled}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => update(index, e.target.value)}
                className="h-10 w-full min-w-0 text-center text-base tabular-nums outline-none disabled:opacity-40"
              />
              <span aria-hidden className="text-xs text-dark-gray">{unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
