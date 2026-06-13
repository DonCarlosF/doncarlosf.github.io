import Link from "next/link";
import { Play } from "lucide-react";
import { SmartImage } from "@/components/ui/Media";
import { formatDate } from "@/lib/utils/format";
import type { Sermon } from "@/lib/content/types";

export function SermonCard({ sermon }: { sermon: Sermon }) {
  return (
    <Link href={`/watch/${sermon.slug}`} className="group block">
      <div className="relative">
        <SmartImage image={sermon.thumbnail || { alt: `${sermon.title} thumbnail`, placeholder: true }} />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary">
            <Play size={20} aria-hidden />
          </span>
        </span>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted">
        {formatDate(sermon.date)}{sermon.series?.title ? ` · ${sermon.series.title}` : ""}
      </p>
      <h3 className="mt-1 font-display text-lg font-semibold leading-snug group-hover:text-primary">{sermon.title}</h3>
      <p className="text-sm text-muted">
        {sermon.speaker?.name}{sermon.scriptureRefs?.length ? ` · ${sermon.scriptureRefs.join(", ")}` : ""}
      </p>
    </Link>
  );
}
