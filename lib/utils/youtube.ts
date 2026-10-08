/**
 * Extract the 11-character video id from a YouTube watch, shorts, embed, live
 * or youtu.be URL — and only YouTube. The sermon field also accepts Facebook
 * links, whose numeric ?v= id would otherwise be truncated to 11 characters and
 * rendered as a dead embed with a 404 poster.
 */
export function youtubeId(url?: string | null): string | null {
  const m = url?.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:shorts\/|embed\/|live\/|watch\?(?:[^#]*&)?v=))([\w-]{11})(?![\w-])/
  );
  return m?.[1] ?? null;
}
