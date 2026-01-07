import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Next 15 + ESLint 옵션 호환 이슈로 빌드 중 lint 단계는 비활성화
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // ignoreBuildErrors: true,
  },
};

export default nextConfig;
