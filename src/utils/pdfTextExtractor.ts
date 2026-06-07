/**
 * PDF text extractor — browser-only, no servers.
 *
 * Strategy A: pdfjs-dist native text layer (fast, works for text-based PDFs).
 * Strategy B: pdfjs renders each page to canvas → Tesseract.js OCR (local,
 *             works for scanned / image-based PDFs).
 *
 * Privacy: the file is never sent anywhere. OCR runs entirely in the browser.
 */

import * as pdfjsLib from 'pdfjs-dist';

// ── pdfjs worker ────────────────────────────────────────────────────────────
// Vite resolves `new URL(..., import.meta.url)` to a real asset URL at build
// time, so the worker is bundled into dist without any CDN dependency.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).href;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ProgressCallback = (message: string) => void;

/** Threshold: fewer than this many non-whitespace chars → text layer is empty */
const MIN_TEXT_CHARS = 80;

export function isTextTooShort(text: string): boolean {
  return text.replace(/\s/g, '').length < MIN_TEXT_CHARS;
}

// ---------------------------------------------------------------------------
// Strategy A — pdfjs native text layer
// ---------------------------------------------------------------------------

export async function extractTextWithPdfJs(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch {
    await loadingTask.destroy();
    return ''; // password-protected or corrupt — fall through to OCR
  }

  const pages: string[] = [];

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();

    const pageText = content.items
      .map(item => ('str' in item ? (item as { str: string }).str : ''))
      .join(' ');

    pages.push(pageText);
    page.cleanup();
  }

  await loadingTask.destroy();
  return pages.join('\n');
}

// ---------------------------------------------------------------------------
// Strategy B — pdfjs render → canvas → Tesseract OCR (local)
// ---------------------------------------------------------------------------

export async function extractTextWithOcr(
  file: File,
  onProgress?: ProgressCallback,
): Promise<string> {
  // Dynamic import so Tesseract is only loaded when actually needed
  const { createWorker } = await import('tesseract.js');

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch {
    await loadingTask.destroy();
    throw new Error('לא ניתן לפתוח את הקובץ. ייתכן שהוא מוגן בסיסמה.');
  }

  const numPages = pdf.numPages;

  // Build a tesseract worker — prefer Hebrew+English, fall back to English
  let tessWorker;
  onProgress?.('מאתחל מנוע OCR...');
  try {
    tessWorker = await createWorker('heb+eng');
  } catch {
    try {
      tessWorker = await createWorker('heb');
    } catch {
      tessWorker = await createWorker('eng');
    }
  }

  const pages: string[] = [];

  try {
    for (let n = 1; n <= numPages; n++) {
      onProgress?.(`קוראים עמוד ${n} מתוך ${numPages}...`);

      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 2.0 }); // 2× ≈ 150 dpi, good for OCR

      const canvas = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      if (!ctx) { page.cleanup(); continue; }

      // pdfjs v6 requires explicit `canvas` in render params
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      page.cleanup();

      const { data: { text } } = await tessWorker.recognize(canvas);
      pages.push(text);
    }
  } finally {
    await tessWorker.terminate();
    await loadingTask.destroy();
  }

  return pages.join('\n');
}

// ---------------------------------------------------------------------------
// Main entry — auto-selects strategy
// ---------------------------------------------------------------------------

export async function extractTextFromPdf(
  file: File,
  onProgress?: ProgressCallback,
): Promise<string> {
  // Step 1: try the fast native text layer
  onProgress?.('מחלצים טקסט מהקובץ...');
  const nativeText = await extractTextWithPdfJs(file);

  if (!isTextTooShort(nativeText)) {
    return nativeText;
  }

  // Step 2: scanned / image PDF — switch to local OCR
  onProgress?.('הקובץ נראה סרוק, מפעילים קריאת OCR מקומית...');
  const ocrText = await extractTextWithOcr(file, onProgress);

  if (!ocrText.trim()) {
    throw new Error(
      'לא הצלחנו לקרוא את הקובץ. ייתכן שהוא מוגן בסיסמה או באיכות סריקה נמוכה.',
    );
  }

  return ocrText;
}
