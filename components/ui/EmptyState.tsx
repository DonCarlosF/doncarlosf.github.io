export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-card border border-dashed border-border bg-surface p-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>}
    </div>
  );
}
