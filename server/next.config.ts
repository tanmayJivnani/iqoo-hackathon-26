import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  serverExternalPackages: ['pdfkit', 'qrcode'],
  outputFileTracingExcludes: { '/*': ['./data/**/*'] },
  outputFileTracingIncludes: { '/*': ['./node_modules/pdfjs-dist/legacy/build/pdf.mjs', './node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'] },
  turbopack: { root: path.resolve(process.cwd(), '..') },
};
export default config;
