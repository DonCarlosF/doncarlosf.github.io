const DAY = { weekday: "short", month: "short", day: "numeric" } as const;

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatEventDate(iso: string, allDay?: boolean): string {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("en-US", DAY).format(d);
    if (allDay) return date;
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(d);
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}
