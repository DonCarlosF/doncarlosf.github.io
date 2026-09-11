import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export function GivingBlock() {
  return (
    <Section>
      <div className="hero-grain relative isolate overflow-hidden rounded-card bg-primary px-6 py-14 text-center text-primary-fg sm:px-10 sm:py-16">
        <div className="relative">
          <Eyebrow className="text-primary-fg/80">Giving</Eyebrow>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Your generosity is changing lives.</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-fg/85">
            From this house to the Dream Center and across Oakland — every gift moves the mission forward.
          </p>
          <div className="mt-7">
            <Button href="/give" variant="accent">Give Now</Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
