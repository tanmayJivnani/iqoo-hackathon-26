import path from 'node:path';

export const config = {
  // User data is runtime storage, not an asset to include in the build.
  dataDir: path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), 'data')),
  get databasePath() { return path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || path.join(this.dataDir, 'complaints.db')); },
  get mediaDir() { return path.join(this.dataDir, 'media'); },
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  openrouterKey: process.env.OPENROUTER_API_KEY || '',
  openrouterModel: process.env.OPENROUTER_MODEL || 'qwen/qwen3.7-plus',
  treeEmail: process.env.PMC_TREE_AUTHORITY_EMAIL || 'ashok.ghorpade@punecorporation.org',
  disasterEmail: process.env.PMC_DISASTER_CELL_EMAIL || 'ganesh.sonune@punecorporation.org',
  generalEmail: process.env.PMC_GENERAL_FEEDBACK_EMAIL || 'info@punecorporation.org',
  whatsapp: process.env.PMC_WHATSAPP_HELPLINE || '919689900002',
};
