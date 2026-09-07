import {
  LANDING_CONTAINER_CLASS,
  LANDING_SECTION_PY,
} from "@/lib/landing/landing-content";
import { landingTypography } from "@/lib/landing/landing-typography";
import { PUBLIC_COMPANY_FACTS } from "@/lib/public-site";

export function LandingCompanySection() {
  return (
    <section
      id="company"
      className={`scroll-mt-24 border-t border-gray-border/50 bg-primary/[0.035] ${LANDING_SECTION_PY}`}
      aria-labelledby="company-heading"
    >
      <div className={LANDING_CONTAINER_CLASS}>
        <div className="mx-auto max-w-3xl text-center">
          <p className={landingTypography.eyebrow}>ABOUT UTTAE</p>
          <h2 id="company-heading" className={`${landingTypography.sectionTitle} mt-3`}>
            함께 만드는 협업 여행 플래너
          </h2>
          <p className={`${landingTypography.sectionBody} mt-4`}>
            우때는 친구들과 여행 계획을 실시간으로 완성할 수 있도록 팀 우때가 만들고 운영하는 웹
            서비스입니다.
          </p>
        </div>
        <dl className="mx-auto mt-10 grid max-w-4xl gap-4 landing-sm:grid-cols-3">
          {PUBLIC_COMPANY_FACTS.map((fact) => (
            <div
              key={fact.label}
              className="rounded-2xl border border-gray-border bg-white p-5 text-center"
            >
              <dt className="text-sm font-bold text-dark-gray">{fact.label}</dt>
              <dd className="mt-2 text-base font-extrabold text-neutral-900">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
