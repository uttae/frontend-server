import { LANDING_CONTAINER_CLASS, LANDING_VALUES } from "@/lib/landing/landing-content";

export function LandingValueStrip() {
  return (
    <section aria-label="우때 핵심 가치" className="border-y border-gray-border bg-white">
      <div className={`${LANDING_CONTAINER_CLASS} grid landing-sm:grid-cols-3`}>
        {LANDING_VALUES.map(({ icon: Icon, title, description }, index) => (
          <article
            key={title}
            className={`flex items-center gap-4 py-6 landing-sm:justify-center landing-sm:px-5 ${index > 0 ? "border-t border-gray-border landing-sm:border-t-0 landing-sm:border-l" : ""}`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-base font-bold text-black">{title}</h2>
              <p className="mt-1 text-sm font-medium text-dark-gray">{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
