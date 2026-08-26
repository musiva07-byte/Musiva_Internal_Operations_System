import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Next.js's default Server Action body limit is 1 MB. Product image uploads
      // (uploadProductImageAction) validate and accept images up to 4 MB — without raising
      // this limit, any real photo between ~1 MB and 4 MB is rejected by the framework itself
      // before it ever reaches our validation/error-handling code, surfacing as a raw
      // "unexpected response was received from the server" crash instead of a friendly
      // message.
      //
      // 4.4 MB (not higher): this app is hosted on Vercel, and Vercel Functions hard-cap
      // every request body at 4.5 MB at the infrastructure level — a limit this setting
      // cannot raise or bypass, confirmed against Vercel's own docs
      // (https://vercel.com/docs/functions/limitations,
      // https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
      // Setting this above 4.5 MB would be a no-op in production and just mask the real
      // ceiling in local dev. Our own MAX_FILE_SIZE (product-image.service.ts,
      // product-image-widget.tsx, product-wizard.tsx) is 4 MB, so every file our own
      // validation accepts has ~400 KB of margin under this limit for multipart/form-data
      // overhead, and ~100 KB more under Vercel's hard cap above that.
      bodySizeLimit: "4.4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
