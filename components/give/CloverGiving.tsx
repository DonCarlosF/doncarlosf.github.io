import { Button } from "@/components/ui/Button";
import { ExternalLink } from "lucide-react";

/**
 * Clover pay-widget embed. Provider-agnostic: the URL comes from siteSettings,
 * so swapping providers later is a content change, not a code change.
 */
export function CloverGiving({ url }: { url: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-2">
      <iframe
        src={url}
        title="Give to Kingdom Builders Christian Fellowship"
        className="h-[640px] w-full rounded-[12px] border-0"
        loading="lazy"
      />
      <div className="p-3 text-center">
        <Button href={url} variant="ghost" size="sm">
          Trouble loading? Open the giving page <ExternalLink size={15} aria-hidden />
        </Button>
      </div>
    </div>
  );
}
