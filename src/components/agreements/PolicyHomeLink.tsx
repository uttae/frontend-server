import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// "/"는 세션이 있으면 /home으로, 없으면 랜딩으로 proxy에서 분기된다
export function PolicyHomeLink() {
  return (
    <Link
      href="/"
      className="mb-6 flex w-fit items-center gap-1 text-label-m-regular mobile:text-label-s-regular text-dark-gray transition hover:text-neutral-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      홈으로 돌아가기
    </Link>
  );
}
