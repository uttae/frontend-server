import { LandingScreenshot } from "@/app/_components/LandingScreenshot";
import {
  LANDING_CONTAINER_CLASS,
  LANDING_SECTION_PY,
  type LandingFeatureStoryContent,
} from "@/lib/landing/landing-content";
import {
  LANDING_FEATURE_SCREENSHOTS,
  LANDING_FEATURE_SCREENSHOT_SIZES,
} from "@/lib/landing/landing-screenshots";
import { landingTypography } from "@/lib/landing/landing-typography";

export function LandingFeatureStory({
  story,
  tone,
}: {
  story: LandingFeatureStoryContent;
  tone: "white" | "tint";
}) {
  const screenshot = LANDING_FEATURE_SCREENSHOTS[story.screenshotKey];

  return (
    <section
      id={story.id}
      className={`scroll-mt-24 border-t border-gray-border/50 ${LANDING_SECTION_PY} ${tone === "tint" ? "bg-primary/[0.035]" : "bg-white"}`}
    >
      <div className={LANDING_CONTAINER_CLASS}>
        <div className="mx-auto max-w-3xl text-center">
          <p className={landingTypography.eyebrow}>{story.index} · {story.eyebrow}</p>
          <h2 className={`${landingTypography.sectionTitle} mt-3`}>{story.title}</h2>
          <p className={`${landingTypography.sectionBody} mt-4`}>{story.description}</p>
        </div>
        <div className="mx-auto mt-10 max-w-[1080px] overflow-hidden rounded-2xl border border-gray-border bg-white p-2 shadow-[0_20px_55px_-30px_rgba(71,31,33,0.24)] landing-sm:p-3">
          <LandingScreenshot
            screenshot={screenshot}
            sizes={LANDING_FEATURE_SCREENSHOT_SIZES}
            className="rounded-xl"
          />
        </div>
        <ul className="mx-auto mt-6 grid max-w-4xl gap-3 landing-sm:grid-cols-3">
          {story.points.map((point) => (
            <li key={point} className={`${landingTypography.pointLabel} rounded-xl border border-gray-border bg-white px-4 py-3 text-center`}>
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
