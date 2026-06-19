import { Flame } from "lucide-react";
import { SmartImage } from "@/components/ui/Media";
import type { Clip } from "@/lib/content/types";

/** Horizontal rail of vertical short-form clips — the bridge to the clip tool. */
export function ClipRail({ clips }: { clips: Clip[] }) {
  if (!clips.length) return null;
  return (
    <ul className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
      {clips.map((clip) => (
        <li key={clip._id} className="group w-32 shrink-0 snap-start transition-transform duration-300 hover:-translate-y-1 sm:w-36">
          <div className="relative">
            <SmartImage
              image={clip.thumbnail || { alt: clip.hook, placeholder: true }}
              ratio="aspect-[9/16]"
              rounded="rounded-xl"
              imageClassName="transition-transform duration-500 group-hover:scale-105"
            />
            {typeof clip.viralityScore === "number" && (
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
                <Flame size={11} aria-hidden /> {clip.viralityScore}
              </span>
            )}
            <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-[11px] font-semibold text-white drop-shadow">
              {clip.hook}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
