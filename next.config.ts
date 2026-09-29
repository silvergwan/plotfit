import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더의 lockfile 대신 이 프로젝트를 기준으로 파일을 탐색한다.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  reactCompiler: true,
};

export default nextConfig;
