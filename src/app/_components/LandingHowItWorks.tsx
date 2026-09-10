import {
  LANDING_CONTAINER_CLASS,
  LANDING_HOW_STEPS,
  LANDING_SECTION_PY,
} from "@/lib/landing/landing-content";
import { landingTypography } from "@/lib/landing/landing-typography";

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className={`scroll-mt-24 border-t border-gray-border/50 bg-primary/[0.035] ${LANDING_SECTION_PY}`} aria-labelledby="how-heading">
      <div className={LANDING_CONTAINER_CLASS}>
        <div className="text-center">
          <p className={landingTypography.eyebrow}>HOW IT WORKS</p>
          <h2 id="how-heading" className={`${landingTypography.sectionTitle} mt-3`}>3단계면 충분해요</h2>
        </div>
        <ol className="mt-10 grid gap-4 landing-sm:grid-cols-3">
          {LANDING_HOW_STEPS.map(({ icon: Icon, step, title }) => (
            <li key={step} className="rounded-2xl border border-gray-border bg-white p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="text-sm font-extrabold text-primary/70">{step}</span>
              </div>
              <h3 className="mt-6 text-lg font-bold leading-snug text-black">{title}</h3>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
