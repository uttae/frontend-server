import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { CopyableSupportEmail } from "@/components/contact/CopyableSupportEmail";
import { MainPageHeader } from "@/components/layout/MainPageHeader";
import { MainSettingsPageLayout } from "@/components/layout/MainSettingsPageLayout";

const CONTACT_FEEDBACK_FORM_URL = "https://forms.gle/LJMrWfYEgWCE3eCGA";

export default function ContactPage() {
  return (
    <MainSettingsPageLayout>
      <div className="flex min-w-0 w-full flex-col gap-4">
        <MainPageHeader
          title="문의하기"
          description="버그 신고, 기능 제안, 계정 관련 문의 등 편하게 연락해 주세요."
        />

        <CopyableSupportEmail variant="card" />

        <p className="text-[14px] leading-relaxed text-dark-gray">
          이메일을 클릭하면 주소가 복사됩니다.
        </p>

        <Link
          href={CONTACT_FEEDBACK_FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-[17px] font-medium text-primary transition hover:opacity-80"
        >
          피드백 설문 보내기
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </MainSettingsPageLayout>
  );
}
