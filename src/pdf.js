import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

/**
 * Default page render: get text from a single page (same as pdf-parse default).
 */
function defaultRenderPage(pageData) {
  const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
  return pageData.getTextContent(renderOptions).then((textContent) => {
    let lastY;
    let text = '';
    for (const item of textContent.items) {
      if (lastY === item.transform[5] || !lastY) {
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = item.transform[5];
    }
    return text;
  });
}

/**
 * Extract text from a PDF, returning an array of page texts (1-based index 0 = page 1).
 * @param {Buffer} dataBuffer - PDF file buffer
 * @returns {{ numpages: number, pages: string[] }}
 */
export async function extractPagesFromPdf(dataBuffer) {
  const pages = [];
  const result = await pdfParse(dataBuffer, {
    pagerender: async (pageData) => {
      const text = await defaultRenderPage(pageData);
      pages.push(text);
      return text;
    },
  });
  return { numpages: result.numpages, pages };
}

/**
 * Get list of PDF paths in assetsDir, sorted by name.
 * @param {string} assetsDir
 * @returns {string[]}
 */
export function listPdfPaths(assetsDir) {
  const names = readdirSync(assetsDir).filter((n) => n.toLowerCase().endsWith('.pdf'));
  names.sort();
  return names.map((n) => join(assetsDir, n));
}

/**
 * Get one chapter of text: a range of pages from a PDF.
 * @param {string} pdfPath - Path to PDF
 * @param {number} startPage - 1-based start page (inclusive)
 * @param {number} endPage - 1-based end page (inclusive)
 * @returns {{ text: string, numpages: number }}
 */
export async function getChapterText(pdfPath, startPage, endPage) {
  const buffer = readFileSync(pdfPath);
  const { numpages, pages } = await extractPagesFromPdf(buffer);
  const from = Math.max(0, startPage - 1);
  const to = Math.min(pages.length, endPage);
  const chapterPages = pages.slice(from, to);
  const text = chapterPages.join('\n\n').trim();
  return { text, numpages };
}

/**
 * Get total page count of a PDF (without extracting full text).
 * Uses pdf-parse with max: 1 to avoid reading all pages, then we only need numpages.
 */
export async function getPdfPageCount(pdfPath) {
  const buffer = readFileSync(pdfPath);
  const result = await pdfParse(buffer, { max: 1 });
  return result.numpages;
}

export default { extractPagesFromPdf, listPdfPaths, getChapterText, getPdfPageCount };
