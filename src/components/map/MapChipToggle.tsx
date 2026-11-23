import { Toggle } from "@base-ui/react/toggle";
import type { ReactNode } from "react";

import { Chip } from "@/components/ui/chip";

type Props = {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
};

export function MapChipToggle({ pressed, onPressedChange, children }: Readonly<Props>) {
  return (
    <Chip
      variant="outline"
      size="md"
      render={<Toggle pressed={pressed} onPressedChange={onPressedChange} />}
      className="relative [&_svg]:pointer-events-none mobile:before:absolute mobile:before:inset-x-0 mobile:before:top-1/2 mobile:before:h-11 mobile:before:-translate-y-1/2"
    >
      {children}
    </Chip>
  );
}
