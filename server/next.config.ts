import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  serverExternalPackages: ['pdfkit', 'qrcode'],
  outputFileTracingExcludes: { '/*': ['./data/**/*'] },
  turbopack: { root: path.resolve(process.cwd(), '..') },
};
export default config;
