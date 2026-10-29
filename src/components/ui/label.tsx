import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// Figma 02 Text Field Header 5002:4449의 Label: label/xs/regular, text/default, 필수 표시와 간격 2
// 비활성·오류·읽기 전용 색은 FieldLabel이 같은 Field 안 입력에서 읽는다. 라벨이 입력 앞에 있어 shadcn의 peer-disabled:로는 읽지 못한다
function Label({ className, ...props }: Readonly<ComponentProps<"label">>) {
  return (
    <label
      data-slot="label"
      className={cn("flex items-center gap-0.5 text-label-xs-regular text-text select-none", className)}
      {...props}
    />
  );
}

export { Label };
