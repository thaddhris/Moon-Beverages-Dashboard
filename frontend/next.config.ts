import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static CSR export — deployer expects an `out/` directory
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
