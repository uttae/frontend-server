import { Clock, ExternalLink, Globe, MapPin, Phone } from "lucide-react";

type Props = {
  isOpen?: boolean | null;
  address?: string;
  phone?: string;
  hours?: string;
  website?: string;
  googleMapsUrl?: string;
  reviewSummary?: string | null;
};

export function HomeTab({
  isOpen,
  address,
  phone,
  hours,
  website,
  googleMapsUrl,
  reviewSummary,
}: Props) {
  return (
    <div className="border-b border-gray-border px-5 py-4">
      <h3 className="mb-2.5 text-[13px] font-semibold text-[#364153]">
        기본 정보
      </h3>
      <ul className="space-y-3">
        {(address || googleMapsUrl) && (
          <li className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dark-gray" />
            <div className="min-w-0 flex-1">
              {address && (
                <span className="block text-[13px] leading-relaxed text-[#364153]">
                  {address}
                </span>
              )}
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-primary-strong underline-offset-2 hover:underline"
                >
                  Google Maps에서 보기
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </li>
        )}
        {hours && (
          <li className="flex items-start gap-3">
            <Clock className="mt-1.5 h-3.5 w-3.5 shrink-0 text-dark-gray" />
            <div className="flex-1">
              {isOpen != null && (
                <span
                  className={`text-[13px] font-medium ${
                    isOpen ? "text-primary-strong" : "text-[#FF6467]"
                  }`}
                >
                  {isOpen ? "영업 중" : "영업 종료"}
                </span>
              )}
              <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-dark-gray">
                {hours}
              </p>
            </div>
          </li>
        )}
        {phone && (
          <li className="flex items-center gap-3">
            <Phone className="h-3.5 w-3.5 shrink-0 text-dark-gray" />
            <a
              href={`tel:${phone}`}
              className="text-[13px] text-[#364153] underline-offset-2 hover:underline"
            >
              {phone}
            </a>
          </li>
        )}
        {website && (
          <li className="flex items-center gap-3">
            <Globe className="h-3.5 w-3.5 shrink-0 text-dark-gray" />
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[13px] text-[#364153] underline-offset-2 hover:underline"
            >
              {website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        )}
      </ul>

      {reviewSummary && (
        <div className="mt-4 rounded-xl bg-gray-50 px-3 py-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-dark-gray">
            AI 리뷰 요약
          </p>
          <p className="text-[13px] leading-relaxed text-[#364153]">
            {reviewSummary}
          </p>
        </div>
      )}
    </div>
  );
}
