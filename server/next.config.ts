import path from 'node:path';
import { createRequire } from 'node:module';
import type { NextConfig } from 'next';

const require = createRequire(import.meta.url);
const pdfAssets = ['pdf.mjs', 'pdf.worker.mjs'].map(name =>
  path.relative(process.cwd(), require.resolve(`pdfjs-dist/legacy/build/${name}`)).split(path.sep).join('/'));

const config: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_BUILD_DIR || '.next',
  serverExternalPackages: ['pdfkit', 'qrcode', 'pdfjs-dist'],
  outputFileTracingExcludes: { '/*': ['./data/**/*'] },
  outputFileTracingRoot: path.resolve(process.cwd(), '..'),
  outputFileTracingIncludes: { '/*': pdfAssets },
  turbopack: { root: path.resolve(process.cwd(), '..') },
};
export default config;
