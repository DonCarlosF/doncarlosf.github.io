import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Play } from "lucide-react";
import type { SiteSettings } from "@/lib/content/types";

export function Hero({ settings }: { settings: SiteSettings }) {
  const { address, serviceTimes } = settings;
  const sunday = serviceTimes.find((s) => s.day === "Sunday");
  const wednesday = serviceTimes.find((s) => s.day === "Wednesday");

  return (
    <section className="hero-grain relative isolate overflow-hidden text-white">
      <div className="hero-bg absolute inset-0 -z-10" aria-hidden />
      <Container className="relative py-20 sm:py-28 lg:py-32">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">
            {settings.churchName} · {address.city}, {address.state}
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
            Church Like <span className="hero-accent">No Other.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/90 sm:text-xl">
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

          <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-4 border-t border-white/20 pt-6">
            {sunday && (
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-white/65">Sundays</dt>
                <dd className="font-display text-lg">{sunday.time} {sunday.label}</dd>
              </div>
            )}
            {wednesday && (
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-white/65">Wednesdays</dt>
                <dd className="font-display text-lg">{wednesday.time} {wednesday.label}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs uppercase tracking-[0.12em] text-white/65">Find us</dt>
              <dd className="font-display text-lg">{address.street}, {address.city}</dd>
            </div>
          </dl>
        </div>
      </Container>
    </section>
  );
}
