import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io" },
      { protocol: "https", hostname: "avatars.planningcenteronline.com" },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
    ],
  },

  // Redirects from likely old WordPress URLs so existing links/SEO don't 404.
  // NOTE: replace/extend with the real old sitemap before launch.
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/giving", destination: "/give", permanent: true },
      { source: "/give-online", destination: "/give", permanent: true },
      { source: "/live", destination: "/watch", permanent: true },
      { source: "/livestream", destination: "/watch", permanent: true },
      { source: "/watch-live", destination: "/watch", permanent: true },
      { source: "/sermons", destination: "/watch", permanent: true },
      { source: "/messages", destination: "/watch", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/im-new", destination: "/new-here", permanent: true },
      { source: "/imnew", destination: "/new-here", permanent: true },
      { source: "/plan-your-visit", destination: "/new-here", permanent: true },
      { source: "/connect", destination: "/new-here", permanent: true },
      { source: "/dreamcenter", destination: "/dream-center", permanent: true },
      { source: "/the-dream-center", destination: "/dream-center", permanent: true },
    ];
  },
};

export default nextConfig;
