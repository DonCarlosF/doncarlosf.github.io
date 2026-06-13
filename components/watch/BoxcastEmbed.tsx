import { boxcastEmbedUrl } from "@/lib/integrations/boxcast";

/** BoxCast live player. The player itself shows live / next-broadcast state. */
export function BoxcastEmbed({ id, title = "KBCF Live Stream" }: { id: string; title?: string }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-card border border-border bg-black">
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
