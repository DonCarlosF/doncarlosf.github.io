import { Container } from "@/components/ui/Container";
import { serviceLabelTime } from "@/lib/utils/format";
import type { SiteSettings } from "@/lib/content/types";

export function ServiceTimesBar({ settings }: { settings: SiteSettings }) {
  const { address } = settings;
  return (
    <div className="bg-primary text-primary-fg">
      <Container className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 py-3.5 text-sm">
        {settings.serviceTimes.map((s) => (
          <span key={`${s.day}-${s.label}`}>
            <span className="font-semibold">{s.day}</span> · {serviceLabelTime(s)}
          </span>
        ))}
        <span className="opacity-90">📍 {address.street}, {address.city}, {address.state} {address.zip}</span>
      </Container>
    </div>
  );
}
