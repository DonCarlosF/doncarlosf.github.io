/** Keyless Google Maps embed for the church address + directions. */
export function MapEmbed({ query, title = "Map to Kingdom Builders Christian Fellowship" }: { query: string; title?: string }) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  return (
    <div className="overflow-hidden rounded-card border border-border">
      <iframe
        src={src}
        title={title}
        className="h-72 w-full sm:h-96"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
