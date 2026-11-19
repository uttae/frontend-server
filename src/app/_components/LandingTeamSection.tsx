import { GithubIcon, LinkedinIcon } from "@/components/icons";

import { LANDING_CONTAINER_CLASS, LANDING_SECTION_PY, LANDING_TEAM_MEMBERS } from "@/lib/landing/landing-content";

export function LandingTeamSection() {
  return (
    <section
      id="team"
      className={`scroll-mt-24 bg-[#211719] text-white ${LANDING_SECTION_PY}`}
      aria-labelledby="team-heading"
    >
      <div className={LANDING_CONTAINER_CLASS}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#ff8589]">TEAM UTTAE</p>
          <h2
            id="team-heading"
            className="mt-3 text-[2rem] font-bold leading-tight tracking-[-0.04em] landing-sm:text-4xl landing-lg:text-5xl"
          >
            우때를 만드는 사람들
          </h2>
          <p className="mt-4 text-base font-medium leading-[1.75] text-white/65 landing-sm:text-lg">
            더 나은 여행 계획 경험을 만들고 안정적으로 운영합니다.
          </p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-5 landing-sm:grid-cols-2">
          {LANDING_TEAM_MEMBERS.map((member) => (
            <article key={member.name} className="rounded-2xl border border-white/15 bg-white/[0.06] p-7">
              <p className="text-sm font-extrabold text-[#ff8589]">{member.role}</p>
              <h3 className="mt-2 text-2xl font-bold text-white">{member.name}</h3>
              <p className="mt-1 text-sm font-semibold text-white/55">{member.englishName}</p>
              <p className="mt-3 min-h-[5rem] text-base font-medium leading-[1.7] text-white/65">
                {member.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={member.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white transition hover:border-white/45 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <GithubIcon className="h-4 w-4" aria-hidden />
                  GitHub
                </a>
                <a
                  href={member.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white transition hover:border-white/45 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <LinkedinIcon className="h-4 w-4" aria-hidden />
                  LinkedIn
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
