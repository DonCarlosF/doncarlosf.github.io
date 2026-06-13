"use client";

import { useMemo, useState } from "react";
import { Users, MapPin, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/Media";
import { cn } from "@/lib/utils/cn";
import type { Group } from "@/lib/content/types";

export function GroupsExplorer({ groups }: { groups: Group[] }) {
  const types = useMemo(() => {
    const set = new Set<string>();
    groups.forEach((g) => g.type && set.add(g.type));
    return ["All", ...[...set].sort()];
  }, [groups]);

  const [active, setActive] = useState("All");
  const filtered = active === "All" ? groups : groups.filter((g) => g.type === active);

  return (
    <div>
      {types.length > 2 && (
        <div role="group" aria-label="Filter groups by type" className="mb-8 flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              aria-pressed={active === t}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
                active === t ? "border-primary bg-primary text-primary-fg" : "border-border text-muted hover:text-fg"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g) => (
          <Card key={g._id} className="flex h-full flex-col overflow-hidden p-0">
            <SmartImage image={g.image || { alt: g.name, placeholder: true }} ratio="aspect-[16/10]" rounded="rounded-none" />
            <div className="flex flex-1 flex-col p-6">
              {g.type && (
                <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-primary">
                  <Users size={12} aria-hidden /> {g.type}
                </span>
              )}
              <h2 className="font-display text-lg font-semibold">{g.name}</h2>
              {g.description && <p className="mt-2 flex-1 text-sm text-muted">{g.description}</p>}
              <dl className="mt-3 space-y-1 text-sm text-muted">
                {g.schedule && <div className="flex items-center gap-2"><Clock size={14} aria-hidden /> {g.schedule}</div>}
                {g.location && <div className="flex items-center gap-2"><MapPin size={14} aria-hidden /> {g.location}</div>}
              </dl>
              <div className="mt-5">
                <Button href={g.joinUrl || "/contact"} variant="outline" size="sm">Join this group</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
