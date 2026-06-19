import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { Img } from "@/lib/content/types";

/**
 * Renders a real image when a source exists, otherwise a clearly-labeled
 * placeholder — so the preview never shows an invented/fake photo.
 */
export function SmartImage({
  image, className, imageClassName, sizes, priority, ratio = "aspect-video", rounded = "rounded-card",
}: {
  image?: Img;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  ratio?: string;
  rounded?: string;
}) {
  const hasReal = image?.src && !image.placeholder;

  if (hasReal) {
    return (
      <div className={cn("relative overflow-hidden", ratio, rounded, className)}>
        <Image
          src={image!.src!}
          alt={image!.alt}
          fill
          sizes={sizes || "(max-width: 768px) 100vw, 50vw"}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label={image?.alt || "Image placeholder"}
      className={cn(
        "relative flex items-end overflow-hidden bg-gradient-to-br from-primary/80 via-primary/60 to-accent/70",
        ratio, rounded, className
      )}
    >
      <span className="m-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium text-white/85">
        Placeholder · {image?.alt || "add a real KBCF photo"}
      </span>
    </div>
  );
}
