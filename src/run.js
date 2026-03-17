#!/usr/bin/env node

import { basename } from 'path';
import config from './config.js';
import { getChapterText, listPdfPaths } from './pdf.js';
import {
  getNextChapter,
  loadProgress,
  saveProgress,
  advanceProgress,
  getBookMeta,
} from './progress.js';
import { findAndDownloadNewBook } from './book-finder.js';
import { getBestQuote, getEpicExplanation } from './llm.js';
import { publishQuoteToSubstack, postReplyToNote } from './substack.js';

const runOnce = process.argv.includes('--once');

async function main() {
  console.log('Substack Quote Bot — fetching next chapter...');

  let state = await getNextChapter();

  if (state.needsNewBook) {
    console.log('Out of books. Searching for and downloading a new book...');
    const existingBasenames = state.pdfPaths.map((p) => basename(p));
    const newPath = await findAndDownloadNewBook(config.assetsDir, existingBasenames);
    console.log('Downloaded:', basename(newPath));
    const pdfPaths = listPdfPaths(config.assetsDir);
    const bookMeta = await getBookMeta(pdfPaths);
    const progress = loadProgress() || {};
    progress.bookIndex = bookMeta.length - 1;
    progress.chapterIndex = 0;
    progress.bookMeta = bookMeta;
    saveProgress(progress);
    state = await getNextChapter();
  }

  const { bookIndex, chapterIndex, bookMeta, pdfPaths, alreadyRanToday } = state;

  if (alreadyRanToday && !runOnce) {
    console.log('Already ran today. Skipping. (Use --once to run anyway.)');
    process.exit(0);
  }

  const meta = bookMeta[bookIndex];
  const pdfPath = pdfPaths[bookIndex];
  const bookLabel = basename(pdfPath, '.pdf').replace(/_/g, ' ');
  const chapterNumber = chapterIndex + 1;
  const startPage = chapterIndex * config.pagesPerChapter + 1;
  const endPage = Math.min(
    meta.totalPages,
    (chapterIndex + 1) * config.pagesPerChapter
  );

  console.log(`Book: ${bookLabel}, Chapter ${chapterNumber} (pages ${startPage}-${endPage})`);

  const { text: chapterText } = await getChapterText(pdfPath, startPage, endPage);
  if (!chapterText || chapterText.length < 50) {
    console.warn('Chapter text too short; advancing and skipping.');
    const progress = loadProgress() || { bookIndex, chapterIndex, bookMeta };
    saveProgress(advanceProgress(progress, bookMeta));
    process.exit(0);
  }

  console.log('Asking LLM for best quote...');
  const result = await getBestQuote(chapterText, bookLabel, chapterNumber);
  console.log('Quote:', result.quote.slice(0, 80) + (result.quote.length > 80 ? '...' : ''));

  console.log('Asking LLM for epic explanation (5 lines)...');
  const attribution = result.attribution || bookLabel;
  const epicExplanation = await getEpicExplanation(result.quote, attribution);

  console.log('Publishing quote to Substack...');
  const pub = await publishQuoteToSubstack(result, bookLabel);
  console.log('Published note:', pub.noteId);

  console.log('Posting epic explanation as reply...');
  try {
    await postReplyToNote(pub.noteId, epicExplanation);
    console.log('Reply posted.');
  } catch (err) {
    console.warn('Reply failed (Substack may not support reply API):', err.message);
    console.log('Posting explanation as a second note instead...');
    const { postExplanationAsNote } = await import('./substack.js');
    await postExplanationAsNote(epicExplanation);
    console.log('Explanation posted as separate note.');
  }

  const progress = loadProgress() || { bookIndex, chapterIndex, bookMeta };
  const next = advanceProgress(progress, bookMeta);
  saveProgress(next);
  console.log(
    `Next: book ${next.bookIndex + 1}/${bookMeta.length}, chapter ${next.chapterIndex + 1}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
