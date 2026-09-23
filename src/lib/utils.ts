import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * 디자인 시스템 폰트 토큰(`text-body-m-regular` 등, tailwind.config.js `fontSize`)을
 * font-size 그룹으로 등록한다. 등록하지 않으면 tailwind-merge가 text 색상으로 오인해
 * `text-white` 같은 색상 클래스와 충돌하고 둘 중 하나를 지워버린다.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [(value: string) => /^(display|heading|title|body|label|caption)-/.test(value)],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
