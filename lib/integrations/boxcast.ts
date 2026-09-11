/**
 * BoxCast helpers. KBCF streams via BoxCast (house-of-worship channel).
 * The channel id lives in siteSettings.boxcastId (CMS-editable, seeded with the
 * verified KBCF id); sermons may carry their own per-broadcast id.
 */

/**
 * Build the BoxCast channel embed URL. We use the rich `view-embed` view (same
 * as the church's current site) so visitors get the live/next player PLUS the
 * playlist of past broadcasts, highlights, and a countdown — not just a bare
 * player. Giving stays on the dedicated Clover page, so BoxCast donations are
 * disabled here.
 */
export function boxcastEmbedUrl(id: string, opts: { compact?: boolean } = {}): string {
  const { compact = false } = opts;
  // Compact = just the live/next player (for the homepage preview). Full = the
  // rich channel view with the past-broadcast playlist + highlights (Watch page).
  const params = new URLSearchParams({
    showTitle: "1",
    showDescription: compact ? "0" : "1",
    showHighlights: compact ? "0" : "1",
    showRelated: compact ? "0" : "1", // playlist of past broadcasts
    showCountdown: "1",
    showDonations: "0", // giving is handled on the Clover page
    defaultVideo: "next",
    market: "house-of-worship",
    layout: "playlist-to-right",
  });
  return `https://boxcast.tv/view-embed/${encodeURIComponent(id)}?${params.toString()}`;
}

/**
 * BoxCast does not require server credentials for an embed. A live/idle state
 * can be detected client-side by the player; we render the embed and let the
 * player surface the live or "next broadcast" state itself.
 */
