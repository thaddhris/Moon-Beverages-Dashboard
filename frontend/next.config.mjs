/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static CSR export — deployer expects an `out/` directory
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
