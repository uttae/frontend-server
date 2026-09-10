const body =
  "font-sans text-base font-medium leading-[1.75] text-dark-gray landing-sm:text-lg";

export const landingTypography = {
  eyebrow:
    "font-sans text-sm font-extrabold uppercase tracking-[0.14em] text-primary",
  heroTitle:
    "font-sans text-[2.5rem] font-extrabold leading-[1.08] tracking-[-0.055em] text-black landing-sm:text-5xl landing-lg:text-6xl",
  heroBody: body,
  sectionTitle:
    "font-sans text-[2rem] font-bold leading-[1.18] tracking-[-0.04em] text-black landing-sm:text-4xl landing-lg:text-5xl",
  sectionBody: body,
  pointLabel:
    "font-sans text-sm font-semibold leading-relaxed text-dark-gray landing-sm:text-base",
  cardTitle:
    "font-sans text-2xl font-bold leading-tight tracking-[-0.035em] text-black landing-sm:text-3xl",
  cardBody:
    "font-sans text-base font-medium leading-[1.7] text-dark-gray landing-sm:text-[1.0625rem]",
  ctaTitle:
    "font-sans text-[2rem] font-bold leading-tight tracking-[-0.04em] text-black landing-sm:text-4xl",
  primaryAction: "font-sans text-base font-bold landing-sm:text-lg",
} as const;
