import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function loadEnv() {
  const envPath = join(rootDir, '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        const key = m[1];
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
          val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

export const config = {
  /** Directory containing PDF files (books) */
  assetsDir: process.env.ASSETS_DIR || join(rootDir, 'assets'),
  /** Number of PDF pages to treat as one "chapter" */
  pagesPerChapter: parseInt(process.env.PAGES_PER_CHAPTER || '10', 10),
  /** Progress file path */
  progressPath: process.env.PROGRESS_PATH || join(rootDir, 'data', 'progress.json'),
  /** OpenAI-compatible API (OpenAI, or e.g. OpenAI base URL for other providers) */
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: process.env.OPENAI_BASE_URL || undefined,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  /** Substack: get token from browser cookie substack.sid */
  substackToken: process.env.SUBSTACK_TOKEN || '',
  substackPublicationUrl: process.env.SUBSTACK_PUBLICATION_URL || '',
};

export default config;
