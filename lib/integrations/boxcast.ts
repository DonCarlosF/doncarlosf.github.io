/**
 * BoxCast helpers. KBCF streams via BoxCast (house-of-worship channel).
 * The default channel id is the verified KBCF id; it can be overridden per
 * sermon or via siteSettings in the CMS.
 */
export const KBCF_BOXCAST_ID = "wsiikymmlhksnkgmc24r";

/**
 * Build the BoxCast channel embed URL. KBCF's id is a channel id; the player
 * surfaces the live broadcast or the "next up" state automatically.
 * (Confirm against BoxCast's current embed snippet before launch.)
 */
export function boxcastEmbedUrl(id: string): string {
  return `https://player.boxcast.com/channel/${encodeURIComponent(id)}`;
}

/**
 * BoxCast does not require server credentials for an embed. A live/idle state
 * can be detected client-side by the player; we render the embed and let the
 * player surface the live or "next broadcast" state itself.
 */
