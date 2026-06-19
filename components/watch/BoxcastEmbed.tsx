import { MonitorPlay } from "lucide-react";
import { boxcastEmbedUrl } from "@/lib/integrations/boxcast";

/**
 * BoxCast live player. The player itself surfaces the live / next-broadcast
 * state. When no channel id is configured we render a themed placeholder
 * instead of pointing an iframe at a missing channel.
 */
export function BoxcastEmbed({ id, title = "KBCF Live Stream" }: { id?: string; title?: string }) {
  if (!id) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center gap-3 rounded-card border border-border bg-surface-2 px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-primary">
          <MonitorPlay aria-hidden />
        </span>
        <div>
          <p className="font-display text-lg font-semibold">Live stream coming soon</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted">
            We stream every weekend service here. Check back at service time, or watch past messages below.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-card border border-border bg-surface-2">
      {/* Themed loading skeleton; the player iframe covers it once it paints. */}
      <span
        className="absolute inset-0 flex items-center justify-center text-primary"
        aria-hidden
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-surface">
          <MonitorPlay />
        </span>
      </span>
      <iframe
        src={boxcastEmbedUrl(id)}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
