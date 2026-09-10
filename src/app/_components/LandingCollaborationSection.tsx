import { LandingScreenshot } from "@/app/_components/LandingScreenshot";
import {
  LANDING_COLLABORATION_FEATURES,
  LANDING_CONTAINER_CLASS,
  LANDING_SECTION_PY,
} from "@/lib/landing/landing-content";
import {
  LANDING_FEATURE_SCREENSHOTS,
  LANDING_FRAMED_SCREENSHOT_SIZES,
} from "@/lib/landing/landing-screenshots";
import { landingTypography } from "@/lib/landing/landing-typography";

export function LandingCollaborationSection() {
  return (
    <section className={`border-t border-gray-border/50 bg-white ${LANDING_SECTION_PY}`} aria-labelledby="collaboration-heading">
      <div className={LANDING_CONTAINER_CLASS}>
        <div className="mx-auto max-w-3xl text-center">
          <p className={landingTypography.eyebrow}>04 · COLLABORATE</p>
          <h2 id="collaboration-heading" className={`${landingTypography.sectionTitle} mt-3`}>
            대화도, AI도 같은 여행방에서
          </h2>
          <p className={`${landingTypography.sectionBody} mt-4`}>
            장소를 공유하고 의논하는 순간부터 여행 맥락을 이해하는 AI까지 한곳에서 이어집니다.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-5xl gap-6 landing-lg:grid-cols-2">
          {LANDING_COLLABORATION_FEATURES.map(({ icon: Icon, ...feature }) => (
            <article key={feature.title} className="overflow-hidden rounded-3xl border border-gray-border bg-gradient-to-br from-white to-primary/[0.045] px-6 pt-8">
              <div>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <p className={`${landingTypography.eyebrow} mt-5`}>{feature.eyebrow}</p>
                <h3 className={`${landingTypography.cardTitle} mt-2`}>{feature.title}</h3>
                <p className={`${landingTypography.cardBody} mt-3`}>{feature.description}</p>
              </div>
              <div className="mx-auto mt-8 w-full max-w-[320px] landing-lg:max-w-[360px]">
                <LandingScreenshot
                  screenshot={LANDING_FEATURE_SCREENSHOTS[feature.screenshotKey]}
                  sizes={LANDING_FRAMED_SCREENSHOT_SIZES}
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
