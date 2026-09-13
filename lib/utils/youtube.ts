/** Extract the 11-character video id from watch, shorts, embed and youtu.be URLs. */
export function youtubeId(url?: string | null): string | null {
  const m = url?.match(/(?:youtu\.be\/|shorts\/|v=|embed\/)([\w-]{11})/);
  return m?.[1] ?? null;
}
