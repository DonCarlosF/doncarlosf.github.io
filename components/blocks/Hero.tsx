import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Play } from "lucide-react";
import type { SiteSettings } from "@/lib/content/types";

export function Hero({ settings }: { settings: SiteSettings }) {
  const { address, serviceTimes } = settings;
  const sunday = serviceTimes.find((s) => s.day === "Sunday");
  const wednesday = serviceTimes.find((s) => s.day === "Wednesday");

  return (
    <section className="hero-section hero-grain relative isolate overflow-hidden text-white">
      {settings.heroVideoUrl ? (
        <>
          <video
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            src={settings.heroVideoUrl}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/45 to-black/80" aria-hidden />
        </>
      ) : (
        <div className="hero-bg absolute inset-0 -z-10" aria-hidden />
      )}
      {/* Decorative kinetic glow — only rendered visible in the Movement theme. */}
      <div className="hero-glow" aria-hidden />
      <Container className="relative w-full py-20 sm:py-28 lg:py-32">
        <div className="max-w-3xl">
          <p className="hero-eyebrow text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
            {settings.churchName} · {address.city}, {address.state}
          </p>
          <h1 className="hero-title mt-4 text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
            Church Like <span className="hero-accent">No Other.</span>
          </h1>
          <p className="hero-lead mt-5 max-w-xl text-lg text-white/90 sm:text-xl">
            {settings.mission} Come as you are — there&apos;s a seat for you this weekend.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button href="/new-here" size="lg" variant="accent" className="hero-cta-primary">
              Plan Your Visit
            </Button>
            <Button href="/watch" size="lg" variant="onDark">
              <Play size={18} aria-hidden /> Watch Live
            </Button>
          </div>

          <dl className="hero-stats mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/20 pt-6">
            {sunday && (
              <div className="hero-stat">
                <dt className="hero-stat-label text-xs uppercase tracking-[0.12em] text-white/65">Sundays</dt>
                <dd className="hero-stat-value font-display text-lg">{sunday.time} {sunday.label}</dd>
              </div>
            )}
            {wednesday && (
              <div className="hero-stat">
                <dt className="hero-stat-label text-xs uppercase tracking-[0.12em] text-white/65">Wednesdays</dt>
                <dd className="hero-stat-value font-display text-lg">{wednesday.time} {wednesday.label}</dd>
              </div>
            )}
            <div className="hero-stat">
              <dt className="hero-stat-label text-xs uppercase tracking-[0.12em] text-white/65">Find us</dt>
              <dd className="hero-stat-value font-display text-lg">{address.street}, {address.city}</dd>
            </div>
          </dl>
        </div>
      </Container>
    </section>
  );
}
