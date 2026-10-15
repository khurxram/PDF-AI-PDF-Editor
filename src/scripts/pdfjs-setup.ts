import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// pdf.js v6 needs a real worker URL; without it every document open throws
// "No GlobalWorkerOptions.workerSrc specified". Vite resolves this to a
// bundled asset URL so it works in dev and in the static build.
// @ts-ignore vite asset query
import workerSrc from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc as string;

/** Load a PDF with pdf.js from raw bytes. */
export function openPdf(data: Uint8Array) {
	return pdfjs.getDocument({ data }).promise;
}

export { pdfjs };
