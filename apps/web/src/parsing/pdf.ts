import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

// pdfjs worker needs to be set explicitly when bundling in the browser.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

export type PdfText = string[][]; // pages -> lines

const getDocument = (source: Uint8Array | ArrayBuffer | string): Promise<PDFDocumentProxy> =>
  pdfjs.getDocument({ data: source }).promise;

export const extractPdfText = async (file: File): Promise<PdfText> => {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument(buffer);
  const pages: PdfText = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: string[] = [];

    content.items.forEach((item) => {
      if ('str' in item && item.str.trim().length > 0) {
        items.push(item.str);
      }
    });

    pages.push(items);
  }

  return pages;
};
