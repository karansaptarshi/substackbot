import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const dataDir = join(rootDir, 'data');
const usedBooksPath = join(dataDir, 'used-books.json');
const bookSourcesPath = join(rootDir, 'data', 'book-sources.json');

/** Default list of public-domain philosophy/classics PDFs (archive.org and similar). */
const DEFAULT_SOURCES = [
  { title: 'Meditations_Marcus_Aurelius', url: 'https://archive.org/download/meditations01marcuoft/meditations01marcuoft.pdf' },
  { title: 'Thus_Spoke_Zarathustra_Nietzsche', url: 'https://archive.org/download/thuspokezarathustr00niet/thuspokezarathustr00niet.pdf' },
  { title: 'Beyond_Good_and_Evil_Nietzsche', url: 'https://archive.org/download/beyondgoodandevil00nietuoft/beyondgoodandevil00nietuoft.pdf' },
  { title: 'The_Republic_Plato', url: 'https://archive.org/download/RepublicPlatoJowett/RepublicPlatoJowett.pdf' },
  { title: 'Ethics_Spinoza', url: 'https://archive.org/download/ethicademonstrate00spin/ethicademonstrate00spin.pdf' },
  { title: 'Discourse_on_Method_Descartes', url: 'https://archive.org/download/discourseonmethod00desc/discourseonmethod00desc.pdf' },
  { title: 'The_Prince_Machiavelli', url: 'https://archive.org/download/theprince00mach/theprince00mach.pdf' },
  { title: 'Thus_Spake_Zarathustra_Common', url: 'https://archive.org/download/thuspakezarathust00niet/thuspakezarathust00niet.pdf' },
];

function loadUsedBooks() {
  try {
    const raw = readFileSync(usedBooksPath, 'utf8');
    return new Set(JSON.parse(raw));
  } catch (_) {
    return new Set();
  }
}

function saveUsedBooks(used) {
  try {
    mkdirSync(dataDir, { recursive: true });
  } catch (_) {}
  writeFileSync(usedBooksPath, JSON.stringify([...used], null, 2), 'utf8');
}

function loadBookSources() {
  try {
    if (existsSync(bookSourcesPath)) {
      const raw = readFileSync(bookSourcesPath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (_) {}
  return DEFAULT_SOURCES;
}

/** Sanitize for filename: no path, no dangerous chars. */
function safeFilename(title) {
  return String(title)
    .replace(/[^\w\s\-_.]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120) || 'book';
}

/**
 * Download a PDF from url and save to assetsDir. Returns path to the saved file.
 */
async function downloadPdf(url, destPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SubstackBot/1.0)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1000) throw new Error('Downloaded file too small to be a PDF');
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, buf);
  return destPath;
}

/**
 * Find a book we haven't used yet, download it to assetsDir, and return its path.
 * Uses book-sources.json (or built-in list); records used URLs in data/used-books.json.
 * @param {string} assetsDir
 * @param {string[]} existingBasenames - existing PDF filenames in assets (so we don't duplicate)
 */
export async function findAndDownloadNewBook(assetsDir, existingBasenames = []) {
  const used = loadUsedBooks();
  const sources = loadBookSources();
  const existing = new Set(existingBasenames.map((b) => b.toLowerCase()));

  for (const { title, url } of sources) {
    const key = url;
    if (used.has(key)) continue;
    const base = safeFilename(title) + '.pdf';
    if (existing.has(base.toLowerCase())) {
      used.add(key);
      saveUsedBooks(used);
      continue;
    }
    const destPath = join(assetsDir, base);
    try {
      await downloadPdf(url, destPath);
      used.add(key);
      saveUsedBooks(used);
      return destPath;
    } catch (err) {
      console.warn(`Skipping ${url}:`, err.message);
      continue;
    }
  }

  throw new Error('No new book could be downloaded. Add more URLs to data/book-sources.json or check network.');
}

export { loadBookSources, usedBooksPath, bookSourcesPath };
