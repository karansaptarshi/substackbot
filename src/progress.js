import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getPdfPageCount, listPdfPaths } from './pdf.js';
import config from './config.js';

/**
 * Progress shape:
 * {
 *   bookIndex: number,      // which PDF (0-based)
 *   chapterIndex: number,    // which chapter within that book (0-based)
 *   lastRunDate: string,    // YYYY-MM-DD
 *   bookMeta: [ { path, totalPages, chaptersCount } ]  // cached per book
 * }
 */

function getDataDir() {
  const dir = dirname(config.progressPath);
  try {
    mkdirSync(dir, { recursive: true });
  } catch (_) {}
  return dir;
}

export function loadProgress() {
  try {
    const raw = readFileSync(config.progressPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

export function saveProgress(progress) {
  getDataDir();
  writeFileSync(config.progressPath, JSON.stringify(progress, null, 2), 'utf8');
}

/**
 * Build or refresh book metadata (path, totalPages, chaptersCount).
 * @param {string[]} pdfPaths
 * @returns {Promise<Array<{ path: string, totalPages: number, chaptersCount: number }>>}
 */
export async function getBookMeta(pdfPaths) {
  const meta = [];
  for (const path of pdfPaths) {
    const totalPages = await getPdfPageCount(path);
    const chaptersCount = Math.max(1, Math.ceil(totalPages / config.pagesPerChapter));
    meta.push({ path, totalPages, chaptersCount });
  }
  return meta;
}

/**
 * Get the next chapter to process: which book and which chapter index, and whether we already ran today.
 * Returns { bookIndex, chapterIndex, bookMeta, pdfPaths, alreadyRanToday }.
 * If alreadyRanToday, caller may skip or run anyway (e.g. --once).
 */
export async function getNextChapter() {
  const pdfPaths = listPdfPaths(config.assetsDir);
  if (pdfPaths.length === 0) {
    throw new Error(`No PDF files found in ${config.assetsDir}`);
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  let progress = loadProgress();

  let bookMeta = progress?.bookMeta;
  if (!bookMeta || bookMeta.length !== pdfPaths.length) {
    bookMeta = await getBookMeta(pdfPaths);
  }

  let bookIndex = progress?.bookIndex ?? 0;
  let chapterIndex = progress?.chapterIndex ?? 0;

  const alreadyRanToday = progress?.lastRunDate === today;

  // If we're past the last chapter of current book, move to next book
  const currentMeta = bookMeta[bookIndex];
  if (!currentMeta) {
    bookIndex = 0;
    chapterIndex = 0;
  } else if (chapterIndex >= currentMeta.chaptersCount) {
    bookIndex += 1;
    chapterIndex = 0;
  }

  // If we've finished all books, signal that we need a new book (don't loop back)
  const needsNewBook = bookIndex >= bookMeta.length;

  return {
    bookIndex: needsNewBook ? bookMeta.length : bookIndex,
    chapterIndex,
    bookMeta,
    pdfPaths,
    alreadyRanToday,
    needsNewBook,
  };
}

/**
 * Advance progress to the next chapter (and mark today as run).
 */
export function advanceProgress(progress, bookMeta) {
  const next = { ...progress, bookMeta, lastRunDate: new Date().toISOString().slice(0, 10) };
  next.chapterIndex = (next.chapterIndex ?? 0) + 1;
  const currentMeta = bookMeta[next.bookIndex];
  if (currentMeta && next.chapterIndex >= currentMeta.chaptersCount) {
    next.chapterIndex = 0;
    next.bookIndex = (next.bookIndex ?? 0) + 1;
  }
  if (next.bookIndex >= bookMeta.length) {
    next.bookIndex = 0;
    next.chapterIndex = 0;
  }
  return next;
}
