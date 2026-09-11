import { Section, Eyebrow } from "@/components/ui/Section";

/** "Church Like No Other" welcome / intro block. */
export function WelcomeIntro({ heading, body }: { heading: string; body: string }) {
  return (
    <Section>
      <div className="mx-auto max-w-3xl text-center">
        <Eyebrow>Welcome</Eyebrow>
        <h2 className="kbcf-section-title mt-3 text-balance font-display text-3xl font-semibold sm:text-4xl lg:text-[2.75rem]">
          {heading}
        </h2>
        <p className="mt-6 text-pretty text-lg leading-relaxed text-muted">{body}</p>
      </div>
    </Section>
  );
}
