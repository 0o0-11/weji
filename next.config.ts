import type { NextConfig } from "next";

// WEJI pulls pictures from Unsplash, Pexels and an open-ended set of news CDNs.
// Because news images can come from any host, we render them with plain <img>
// rather than next/image — one unlisted hostname would otherwise break a whole
// row of the feed. Image sizing is handled by the providers' own CDN params.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

export default nextConfig;
