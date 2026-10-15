/**
 * Per-tool on-page SEO content.
 *
 * Every tool page pulls its unique title, meta description, introduction,
 * supporting copy and FAQs from here so that no two tool pages share the same
 * metadata or the same blocks of text.
 *
 * `body` paragraphs may contain inline `<a href="/slug/">…</a>` links — they
 * are authored here (never user input) and are used for contextual internal
 * links between related tools.
 *
 * Claims are limited to what the tool actually does; the limitations captured
 * in tools.ts are restated honestly instead of being hidden.
 */
export type ToolSeo = {
	/** Unique SEO title, ideally <= 60 characters, brand at the end. */
	title: string;
	/** Unique meta description, ideally 140-160 characters. */
	description: string;
	/** Unique introduction paragraph shown under the page H1. */
	intro: string;
	/** Unique H2 heading for the supporting content block. */
	heading: string;
	/** One or two unique paragraphs of supporting content (may contain links). */
	body: string[];
	/** Genuine user questions about this tool. */
	faq: { q: string; a: string }[];
};

export const toolSeo: Record<string, ToolSeo> = {
	'merge-pdf': {
		title: 'Merge PDF Online — Combine PDF Files Free | PDF AI',
		description:
			'Merge PDF files online in the order you choose. PDF AI combines documents free in your browser — no signup, no uploads, no software to install.',
		intro:
			'Combine two or more documents into a single file with this free merge PDF tool. Add your files, arrange them in the order you want, and download the merged result — the whole merge runs in this browser tab.',
		heading: 'How to merge PDF files online',
		body: [
			'Pick every document you want to join on the upload screen, then continue to the preview. Files are joined in the order you selected, so check the sequence before you press Continue. If the order is wrong, go back, re-select the files and try again — nothing is saved between attempts.',
			'Merging is usually the first step in a longer job: people often <a href="/split-pdf/">split PDF online</a> documents they no longer need, <a href="/compress-pdf/">compress the combined file</a> before emailing it, or <a href="/rotate-pdf/">rotate PDF pages</a> that were scanned the wrong way round.',
		],
		faq: [
			{
				q: 'Can I merge more than two PDF files?',
				a: 'Yes. Select as many PDF files as you need on the upload screen and they are combined into one document in the order you chose.',
			},
			{
				q: 'Does merging change the quality of my PDF?',
				a: 'No. The pages are copied into the new document exactly as they are — merging does not re-render or re-compress the pages.',
			},
		],
	},
	'split-pdf': {
		title: 'Split PDF Online Free — Extract Pages | PDF AI',
		description:
			'Split a PDF into separate files online. Select the pages you want, create new documents and download them — free, private and in your browser.',
		intro:
			'Break a large document into smaller PDFs with this free split PDF tool. Open a file, click the pages you want to separate, and download each new document without installing anything.',
		heading: 'How to split a PDF online',
		body: [
			'Choose a PDF, then click the thumbnails of the pages you want to split off into their own document. Press Continue and the tool builds the new files for you to preview and download. Splitting works best when you already know which pages you need — check the page count in the preview first.',
			'If you only need a couple of pages out of a long file, <a href="/extract-pdf-pages/">extract PDF pages</a> keeps just the ones you select and discards the rest, while <a href="/remove-pdf-pages/">remove PDF pages</a> does the opposite. You can always <a href="/merge-pdf/">merge PDF</a> the pieces back together later.',
		],
		faq: [
			{
				q: 'Can I split a PDF into single pages?',
				a: 'Yes. Select individual pages to create one PDF per page, or select a group of pages to create a single shorter document.',
			},
			{
				q: 'Do I need to install software to split a PDF?',
				a: 'No. PDF AI runs entirely in your browser, so you can split a PDF on any computer or phone without downloading a program or creating an account.',
			},
		],
	},
	'remove-pdf-pages': {
		title: 'Remove PDF Pages Online — Delete Pages Free | PDF AI',
		description:
			'Remove unwanted pages from a PDF online. Click the pages you want to delete, preview the shorter document and download it — free in your browser.',
		intro:
			'Take out the pages you do not need with this free remove PDF pages tool. Select the pages to discard, keep the rest, and download a shorter document — no signup and no uploads.',
		heading: 'How to remove pages from a PDF',
		body: [
			'Open a PDF with at least two pages, then click every thumbnail you want to remove. The selected pages are marked clearly so you can double-check before continuing. Press Continue to rebuild the document without them, review the preview, and download the result.',
			'Removing pages is a quick way to trim a scan or a report before you <a href="/compress-pdf/">compress PDF online free</a> for email. If the pages you want are scattered through the file, it can be quicker to <a href="/extract-pdf-pages/">extract PDF pages</a> instead and keep only what you need.',
		],
		faq: [
			{
				q: 'Can I remove more than one page at a time?',
				a: 'Yes. Click as many pages as you like, then continue — every selected page is dropped from the new document in one pass.',
			},
			{
				q: 'Is the original file changed?',
				a: 'No. The tool creates a new, shorter PDF and leaves your original file untouched on your device.',
			},
		],
	},
	'extract-pdf-pages': {
		title: 'Extract PDF Pages Online — Save Pages as a PDF | PDF AI',
		description:
			'Extract selected pages from a PDF into a brand-new document. Pick the pages, press Continue and download the result free in your browser.',
		intro:
			'Pull the pages you need out of a longer document with this free extract PDF pages tool. Select them from the thumbnail preview and save them as a separate, brand-new PDF.',
		heading: 'How to extract pages from a PDF',
		body: [
			'Choose the document that holds the pages, click the thumbnails you want to keep, and press Continue. The selected pages are written into a fresh PDF in the order they appeared in the original file, ready to preview and download.',
			'Extraction pairs well with other page tools: <a href="/remove-pdf-pages/">remove PDF pages</a> if you prefer to keep everything except a few, <a href="/split-pdf/">split PDF online</a> when you want several smaller files, or <a href="/organize-pdf-pages/">organize PDF pages</a> if the order also needs fixing.',
		],
		faq: [
			{
				q: 'Do extracted pages keep their original layout?',
				a: 'Yes. The selected pages are copied from the source document, so text, images and formatting stay exactly as they were.',
			},
			{
				q: 'Are the pages removed from my original file?',
				a: 'No. Extraction builds a new PDF from your selection; the original document on your device is never modified.',
			},
		],
	},
	'organize-pdf-pages': {
		title: 'Organize PDF Pages — Reorder & Rearrange | PDF AI',
		description:
			'Reorganize PDF pages in your browser. Drag thumbnails to reorder, rotate or remove pages, then rebuild the document — free, no signup needed.',
		intro:
			'Rearrange the pages of a document in any order with this free organize PDF pages tool. Drag the thumbnails, rotate or delete the ones that are out of place, and rebuild the file in seconds.',
		heading: 'How to organize PDF pages',
		body: [
			'Open a PDF to see every page as a thumbnail. Drag them into the order you want, use the rotate control on pages that are the wrong way round, and remove anything you no longer need. When the sequence looks right, press Continue to rebuild the document and download it.',
			'A tidy page order makes the rest of the workflow easier: pages that scan out of sequence are fixed here before you <a href="/add-page-numbers/">add page numbers to the PDF</a> or <a href="/compress-pdf/">compress the finished document</a>. For a single page that simply needs turning, <a href="/rotate-pdf/">rotate PDF</a> is faster.',
		],
		faq: [
			{
				q: 'Can I reorder and rotate pages at the same time?',
				a: 'Yes. The page grid lets you drag pages into a new order, rotate individual pages and delete pages before you rebuild the document.',
			},
			{
				q: 'Will reordering pages change the file size?',
				a: 'Reordering does not re-render the pages, so the resulting file stays close to the size of the original document.',
			},
		],
	},
	'rotate-pdf': {
		title: 'Rotate PDF Online — Rotate PDF Pages 90° or 180° | PDF AI',
		description:
			'Rotate PDF pages online for free. Choose 90, 180 or 270 degrees, select the pages to fix and download the corrected PDF from your browser.',
		intro:
			'Fix sideways scans in a click with this free rotate PDF tool. Choose an angle, select the pages that need turning, and download a PDF where every page faces the right way up.',
		heading: 'How to rotate PDF pages',
		body: [
			'Select an angle — 90, 180 or 270 degrees — then click the pages you want to rotate. Pages you do not select stay as they are, so mixed documents are easy to correct. Press Continue, check the preview and download the rotated copy.',
			'Rotation is normally the first fix for a scanned document: once the pages are upright you can <a href="/add-page-numbers/">add page numbers</a>, <a href="/crop-pdf/">crop the margins</a> or <a href="/compress-pdf/">compress the PDF</a> before sharing it. If several pages are also in the wrong order, use <a href="/organize-pdf-pages/">organize PDF pages</a> to drag them into place.',
		],
		faq: [
			{
				q: 'Can I rotate only some pages of a PDF?',
				a: 'Yes. Select exactly the pages you want to turn — anything you leave unselected keeps its original orientation.',
			},
			{
				q: 'Does rotating a PDF reduce its quality?',
				a: 'No. The pages keep their original content; only the viewing direction changes, so text and images are not re-compressed.',
			},
		],
	},
	'scan-to-pdf': {
		title: 'Scan to PDF — Turn a Photo of a Document into PDF | PDF AI',
		description:
			'Scan documents to PDF with your camera or an uploaded photo. PDF AI turns each image into a PDF page free, right in your browser.',
		intro:
			'No scanner needed: take or upload a photo of a page and this free scan to PDF tool turns it into a proper PDF document you can save, print or send.',
		heading: 'How to scan to PDF',
		body: [
			'Open the tool, take a photo with your device camera or pick an existing image, and the picture becomes a single PDF page. Press Continue to create the document, then preview and download it. For multi-page documents, scan each page and combine them afterwards.',
			'After scanning, most people tidy the result: <a href="/crop-pdf/">crop the margins</a> that caught the desk, <a href="/rotate-pdf/">rotate PDF</a> pages taken upside down, or <a href="/compress-pdf/">compress the PDF</a> so it fits an email attachment limit. If you scanned several pages separately, <a href="/merge-pdf/">merge PDF</a> joins them into one file.',
		],
		faq: [
			{
				q: 'Can I scan a document with my phone camera?',
				a: 'Yes. On a phone or tablet the tool opens the camera directly, and on a computer you can upload a photo of the page instead.',
			},
			{
				q: 'Can I combine several scans into one PDF?',
				a: 'Create each scan first, then use the merge PDF tool to join the images into a single multi-page document.',
			},
		],
	},
	'compress-pdf': {
		title: 'Compress PDF Online Free — Reduce File Size | PDF AI',
		description:
			'Compress PDF files online free. Re-render pages at a lower resolution to reduce file size for email and uploads — private, in your browser.',
		intro:
			'Make a heavy document easier to send with this free compress PDF tool. Pages are re-rendered at a lower resolution, which usually produces a noticeably smaller file you can preview and download instantly.',
		heading: 'How to compress a PDF online',
		body: [
			'Choose a PDF, set the quality slider, and press Continue. Each page is re-rendered and re-encoded locally, and the result appears in the preview so you can judge the trade-off before downloading. Because pages are rasterized, text in the compressed copy may no longer be selectable — keep the original if you need to copy text out of it.',
			'The final size depends on what your pages contain, so it is worth checking the result against your target. If you are working to a strict upload limit, <a href="/reduce-pdf-size/">reduce PDF to a target size</a> lets you aim at a specific number of megabytes, and <a href="/split-pdf/">split PDF online</a> can remove the pages you do not need to send at all.',
		],
		faq: [
			{
				q: 'How much smaller will my compressed PDF be?',
				a: 'It depends on the original pages — image-heavy documents shrink the most. Preview the result and keep the version that suits you; PDF AI does not promise a fixed ratio.',
			},
			{
				q: 'Is compressing a PDF online free?',
				a: 'Yes. Compression in PDF AI is free and unlimited in practice, with no signup, no watermark and no software to install.',
			},
		],
	},
	'reduce-pdf-size': {
		title: 'Reduce PDF to a Target Size — Set a Size Goal | PDF AI',
		description:
			'Aim for a specific file size with PDF AI. Set a target in MB and the tool works toward it in your browser — best effort, free, no signup.',
		intro:
			'Working to an upload limit? This tool lets you reduce a PDF toward a target size you choose, then preview the result and adjust until the document fits.',
		heading: 'How to reduce a PDF to a target size',
		body: [
			'Open a PDF and enter the size you need in megabytes. The tool renders the pages at progressively lower quality to get as close to your target as it can, then shows you the result. Treat the number as a goal rather than a guarantee — very detailed pages may not reach it without becoming hard to read.',
			'If the file is still too big after a pass, try removing the pages you do not need with <a href="/remove-pdf-pages/">remove PDF pages</a>, or split the document with <a href="/split-pdf/">split PDF online</a> and send the halves separately. For general shrinking without a number in mind, the standard <a href="/compress-pdf/">compress PDF</a> tool is quicker.',
		],
		faq: [
			{
				q: 'Can you guarantee my PDF will reach the target size?',
				a: 'No. The target is best effort: the tool gets as close as it can while keeping the pages readable, and you preview the outcome before downloading.',
			},
			{
				q: 'What happens if the result is still too large?',
				a: 'Lower the quality further, remove pages you do not need, or split the document — the preview always shows the current size so you can decide.',
			},
		],
	},
	'compress-image': {
		title: 'Compress Image Online — Resize & Reduce Size | PDF AI',
		description:
			'Compress JPG and PNG images online free. Resize and re-encode photos in your browser to shrink file sizes before you upload or share them.',
		intro:
			'Shrink photos and graphics before you share them with this free image compressor. Resize and re-encode JPG or PNG files locally, then download the lighter version in seconds.',
		heading: 'How to compress images online',
		body: [
			'Choose an image, adjust the dimensions and the quality, and press Continue to re-encode it. The preview shows the new picture alongside its new file size so you can see what you are trading away before you download.',
			'Compressed images are also useful as PDF ingredients: smaller photos make a lighter document when you <a href="/jpg-to-pdf/">convert JPG to PDF</a>, and <a href="/compress-pdf/">compressing the finished PDF</a> removes the rest of the weight. If you are working with a single format, the dedicated <a href="/compress-jpg/">compress JPG</a> and <a href="/compress-png/">compress PNG</a> tools skip the format detection.',
		],
		faq: [
			{
				q: 'Which image formats can I compress?',
				a: 'JPG and PNG are both supported, so photos and transparent graphics can be resized and re-encoded with the same controls.',
			},
			{
				q: 'Does compressing an image lower its quality?',
				a: 'Re-encoding at a lower quality reduces the file size, so very high settings keep more detail and lower settings save more space — the preview shows the result either way.',
			},
		],
	},
	'compress-jpg': {
		title: 'Compress JPG Online Free — Reduce JPG File Size | PDF AI',
		description:
			'Shrink JPG files online free. Choose a size and quality, re-compress the photo in your browser and download the smaller file in seconds.',
		intro:
			'Cut the weight out of JPEG photos with this free compress JPG tool. Resize the picture, pick a quality level and download a smaller file — the image never leaves your device.',
		heading: 'How to compress a JPG',
		body: [
			'Pick a JPG, set the new dimensions if you need them, and move the quality slider to taste. The tool re-encodes the image locally and shows the resulting size before you download, so you can find the balance between sharpness and file weight.',
			'Smaller photos upload faster to forms and job applications, and they keep documents slim when you <a href="/jpg-to-pdf/">convert JPG to PDF</a>. If you are batching a folder of mixed images, the general <a href="/compress-image/">compress image</a> tool handles JPG and PNG together — and <a href="/compress-png/">compress PNG</a> covers transparent graphics.',
		],
		faq: [
			{
				q: 'Will the compressed JPG still look sharp?',
				a: 'At high quality settings the difference is usually hard to notice. Lower the quality to save more space, check the preview, and keep the version you prefer.',
			},
			{
				q: 'Can I resize the photo as well as compress it?',
				a: 'Yes. You can change the pixel dimensions and the quality together, which is the quickest way to cut a large file down to size.',
			},
		],
	},
	'compress-png': {
		title: 'Compress PNG Online Free — Reduce PNG File Size | PDF AI',
		description:
			'Compress PNG images online free. Resize and re-encode transparent graphics locally in your browser, then download the smaller file.',
		intro:
			'Shrink PNG graphics and screenshots with this free compress PNG tool. Resize the image and re-encode it in your browser to get a lighter file without uploading anything.',
		heading: 'How to compress a PNG',
		body: [
			'Choose a PNG, set the dimensions you want, and continue to re-encode the image. Because PNG compression is lossless by nature, the main savings here come from resizing and colour handling rather than from lowering visual quality — the tool notes this before you process anything.',
			'PNGs that carry a lot of photographic detail usually shrink further as JPG, so the general <a href="/compress-image/">compress image</a> tool and the <a href="/compress-jpg/">compress JPG</a> tool are worth trying for screenshots full of photos. Once your images are lean, <a href="/jpg-to-pdf/">convert JPG to PDF</a> keeps the document small too.',
		],
		faq: [
			{
				q: 'Why does PNG compression behave differently from JPG?',
				a: 'PNG is a lossless format, so quality cannot be lowered the way it can with JPG. Reducing the pixel dimensions is the reliable way to cut a PNG file size.',
			},
			{
				q: 'Are transparent PNGs supported?',
				a: 'Yes. Transparency is preserved when the image is re-encoded, so logos and icons stay usable on any background.',
			},
		],
	},
	'jpg-to-pdf': {
		title: 'JPG to PDF Converter — Turn Images into PDF | PDF AI',
		description:
			'Convert JPG and PNG images to PDF online. Add one or more photos, arrange them as pages and download the PDF — free in your browser.',
		intro:
			'Turn photos, scans and screenshots into a single document with this free JPG to PDF converter. Each image becomes one page, and the whole conversion happens on your device.',
		heading: 'How to convert JPG to PDF',
		body: [
			'Select one or more JPG or PNG files, then press Continue. Every image becomes a page of the new document in the order you added it, and the preview lets you check the result before downloading it as a PDF.',
			'Converting is often the start of a longer job: <a href="/organize-pdf-pages/">organize PDF pages</a> if the order is wrong, <a href="/crop-pdf/">crop the margins</a> of a rough scan, or <a href="/compress-pdf/">compress the PDF</a> before you send it. If you need the reverse direction, <a href="/pdf-to-jpg/">PDF to JPG</a> renders pages back into images.',
		],
		faq: [
			{
				q: 'Can I put several images into one PDF?',
				a: 'Yes. Select multiple JPG or PNG files and each one becomes its own page of a single document, in the order you added them.',
			},
			{
				q: 'Does converting JPG to PDF change the image quality?',
				a: 'The images are placed into the document as they are, so the pages keep the resolution of the photos you started with.',
			},
		],
	},
	'word-to-pdf': {
		title: 'Word to PDF Converter — Convert DOCX to PDF | PDF AI',
		description:
			'Convert Word documents to PDF online free. Upload a DOCX file and PDF AI extracts the text into a simple PDF — no software, no signup.',
		intro:
			'Convert a DOCX document into a shareable PDF with this free Word to PDF converter. The text of your document is extracted and laid out on PDF pages, ready to preview and download.',
		heading: 'How to convert Word to PDF',
		body: [
			'Choose a .docx file, press Continue, and the tool reads the document and builds a PDF from its text. This is a text-first conversion: paragraphs, headings and lists come across cleanly, while complex layouts, tables and images from the original are not reproduced.',
			'If the document needs a final pass afterwards, you can <a href="/add-page-numbers/">add page numbers</a>, <a href="/add-watermark/">add a watermark</a> or <a href="/compress-pdf/">compress the PDF</a> before sharing it. For documents that already exist as PDFs, the reverse direction is <a href="/pdf-to-word/">PDF to Word</a>.',
		],
		faq: [
			{
				q: 'Are tables and images from my Word file preserved?',
				a: 'No. This converter extracts the text of the document, so complex layouts, embedded images and tables are not carried over into the PDF.',
			},
			{
				q: 'Which Word formats are supported?',
				a: 'The tool accepts modern .docx files. Older .doc documents should be saved as .docx before converting.',
			},
		],
	},
	'html-to-pdf': {
		title: 'HTML to PDF Converter — Save an HTML File as PDF | PDF AI',
		description:
			'Convert a local HTML file to PDF in your browser. PDF AI renders the page and saves it as a downloadable PDF — free and private.',
		intro:
			'Save a local HTML file as a PDF document with this free converter. The page is rendered and printed to PDF inside your browser tab, with no file uploaded anywhere.',
		heading: 'How to convert HTML to PDF',
		body: [
			'Choose a .html file from your device and press Continue to render it. The tool draws the document on an invisible canvas and turns that into a PDF you can preview and download. External images, fonts and scripts may be blocked by your browser’s security rules, so self-contained pages convert best.',
			'A PDF is the simplest way to share a page you have written: you can <a href="/add-page-numbers/">add page numbers</a>, <a href="/add-watermark/">watermark it</a> or <a href="/compress-pdf/">compress the result</a> with the other tools. If you are starting from images instead, <a href="/jpg-to-pdf/">convert JPG to PDF</a> does the same job for photos.',
		],
		faq: [
			{
				q: 'Will my CSS styles be included in the PDF?',
				a: 'Styles embedded in the HTML file are rendered as they appear in the browser. Assets loaded from the web may be blocked, so inline everything you can.',
			},
			{
				q: 'Do I need to upload my HTML file?',
				a: 'No. The file is read and rendered on your device; nothing about your page is sent to a server.',
			},
		],
	},
	'pdf-to-word': {
		title: 'PDF to Word Converter — PDF to DOCX Free | PDF AI',
		description:
			'Convert PDF to Word online free. Extract the text from a PDF into an editable DOCX document — text-first conversion, run in your browser.',
		intro:
			'Make a PDF editable again with this free PDF to Word converter. Text is pulled from every page and written into a DOCX document you can open in any word processor.',
		heading: 'How to convert PDF to Word',
		body: [
			'Choose a PDF, press Continue, and the tool reads the text of each page in order and builds a .docx file from it. Headings and lists are inferred from the layout, which works well for reports, contracts and letters — but it is a text-first conversion rather than a perfect visual copy.',
			'Complex documents usually need a quick tidy-up in your word processor afterwards. Once you are done, you can convert back with <a href="/word-to-pdf/">Word to PDF</a>, or keep working with the original by <a href="/split-pdf/">splitting</a> and <a href="/compress-pdf/">compressing</a> the PDF version.',
		],
		faq: [
			{
				q: 'Will the converted Word file look exactly like the PDF?',
				a: 'Not exactly. The text, order of paragraphs and basic headings are preserved, while complex layouts, columns and images are not rebuilt.',
			},
			{
				q: 'Can I edit the DOCX after converting?',
				a: 'Yes. The output is a normal .docx document, so it opens and edits in Word, Google Docs, LibreOffice and similar editors.',
			},
		],
	},
	'pdf-to-jpg': {
		title: 'PDF to JPG Converter — PDF Pages to Images | PDF AI',
		description:
			'Convert a PDF page to JPG online free. Pick a scale, render the page and download the image — private and browser-based, no signup.',
		intro:
			'Render a PDF page as an image with this free PDF to JPG converter. Choose the resolution, export the page as a JPG, and download it without creating an account.',
		heading: 'How to convert PDF to JPG',
		body: [
			'Open a PDF, pick a scale — 1×, 1.5× or 2× — and click the pages you want to convert. The tool renders each selected page to a JPG image that you can preview and download. Larger scales give you sharper images and bigger files.',
			'Images are handy for sharing a single page in a chat or inserting into a slide deck. To go the other way, <a href="/jpg-to-pdf/">convert JPG to PDF</a> rebuilds a document from pictures, and <a href="/compress-image/">compress image</a> shrinks the exports before you send them.',
		],
		faq: [
			{
				q: 'Can I convert every page of a PDF at once?',
				a: 'You can select the pages you need and render them in one pass. This build downloads images individually rather than as a single ZIP archive.',
			},
			{
				q: 'Which image format do I get?',
				a: 'The pages are exported as JPG files, with the resolution determined by the scale you choose before converting.',
			},
		],
	},
	'pdf-to-markdown': {
		title: 'PDF to Markdown — Extract PDF Text into Markdown | PDF AI',
		description:
			'Convert PDF to Markdown online free. PDF AI extracts the text, structures it into headings and lists, and gives you a clean .md file.',
		intro:
			'Turn a PDF into Markdown you can edit or publish with this free converter. Text is extracted from every page and structured into a plain .md document.',
		heading: 'How to convert a PDF to Markdown',
		body: [
			'Choose a PDF and press Continue: the tool reads the text, then infers headings, paragraphs and lists from the original layout and writes the result as Markdown. The preview shows the raw output so you can copy it or download the file.',
			'Headings and tables are inferred rather than perfectly retained, so it is worth a quick read-through afterwards. If you need an editable word-processing file instead, <a href="/pdf-to-word/">PDF to Word</a> produces a .docx, and <a href="/word-to-pdf/">Word to PDF</a> converts it back when the draft is finished.',
		],
		faq: [
			{
				q: 'Are headings and tables converted correctly?',
				a: 'The tool infers headings, paragraphs and lists from the layout, but complex tables are flattened into plain text rather than kept as tables.',
			},
			{
				q: 'What can I do with the Markdown file?',
				a: 'Edit it in any text editor, paste it into a static site generator or documentation tool, or copy the content straight into a CMS.',
			},
		],
	},
	'edit-pdf': {
		title: 'Edit PDF Online Free — Add Text to a PDF | PDF AI',
		description:
			'Edit PDF files online free. Add text notes to any page, choose size, colour and position, and save the edited document — no signup needed.',
		intro:
			'Add text to a PDF with this free online PDF editor. Open a file, type your note, choose where it sits on the page, and download the edited document — everything stays in your browser.',
		heading: 'How to edit a PDF online',
		body: [
			'Choose a PDF, click the pages that need the text, type your note and adjust the font size, colour and position. This tool adds new content to a page: it is ideal for filling in a date, a name or a short comment. Rewriting the text that already exists inside a PDF is a different job — the original content stream has to be covered and redrawn.',
			'For that, open the <a href="/editor/">full PDF editor</a>, which also handles drawing, highlights, images, redaction, signatures, cropping and page reordering. Once a document is edited you can <a href="/add-page-numbers/">add page numbers</a>, <a href="/add-watermark/">watermark it</a> or <a href="/compress-pdf/">compress the PDF</a> before sharing it.',
		],
		faq: [
			{
				q: 'Can I change the text that is already in a PDF?',
				a: 'Not with this quick tool — it adds new text to the page. The full PDF editor can cover and rewrite existing text, and its Edit Text tool explains the process as you use it.',
			},
			{
				q: 'Is the edited PDF free to download?',
				a: 'Yes. Editing is free, there is no signup, and the finished file is downloaded straight from your browser.',
			},
		],
	},
	'add-page-numbers': {
		title: 'Add Page Numbers to PDF — Number Pages Free | PDF AI',
		description:
			'Add page numbers to a PDF online free. Choose the position, starting number and font size, then download the numbered document.',
		intro:
			'Number every page of a document with this free tool. Pick the position, the starting number and the font size, and PDF AI stamps the numbers on before you download.',
		heading: 'How to add page numbers to a PDF',
		body: [
			'Open a PDF, choose where the numbers should sit — six positions from top-left to bottom-right — set the starting value and the font size, then continue. Every page is stamped in one pass and the preview shows exactly how the finished document reads.',
			'Page numbers make long documents usable, especially after a reorganisation: <a href="/organize-pdf-pages/">organize PDF pages</a> first if the order changed, then <a href="/compress-pdf/">compress the PDF</a> so the numbered copy stays light enough to email.',
		],
		faq: [
			{
				q: 'Can I start numbering from a page other than the first?',
				a: 'Yes. Set the "Start at" value to control the number stamped on the first page, so numbering can continue from an earlier document.',
			},
			{
				q: 'Do page numbers cover any existing text?',
				a: 'Numbers are placed in the position you choose, so pick an empty margin area if the page already has content near the edge.',
			},
		],
	},
	'add-watermark': {
		title: 'Add Watermark to PDF — Text Watermarks Free | PDF AI',
		description:
			'Add a text watermark to every PDF page online. Set the text, size, opacity, angle and colour, then download the watermarked PDF free.',
		intro:
			'Brand or mark a document as draft with this free watermark tool. The same text is stamped across every page with the size, opacity, angle and colour you choose.',
		heading: 'How to add a watermark to a PDF',
		body: [
			'Choose a PDF, type your watermark text — DRAFT or CONFIDENTIAL are common choices — and set the size, opacity, angle and colour. The settings preview on the page as you change them, so you can keep it subtle or make it obvious before you download.',
			'Watermarks are a quick way to mark drafts before review, and they pair naturally with <a href="/sign-pdf/">signing the document</a> once it is approved. If the file is going out by email, <a href="/compress-pdf/">compress the PDF</a> afterwards, and remove anything sensitive first with the <a href="/pdf-metadata-remover/">PDF metadata remover</a>.',
		],
		faq: [
			{
				q: 'Is the watermark added to every page?',
				a: 'Yes. The same text is centred on each page of the document, with the angle and opacity you configured.',
			},
			{
				q: 'Can I make the watermark faint enough to read through?',
				a: 'Yes — lower the opacity to keep the page readable underneath, or raise it when the mark needs to be unmistakable.',
			},
		],
	},
	'crop-pdf': {
		title: 'Crop PDF Online — Trim PDF Margins | PDF AI',
		description:
			'Crop the margins of a PDF online free. Enter the top, right, bottom and left margins, preview the result and download the cropped file.',
		intro:
			'Trim unwanted white space from a document with this free crop PDF tool. Set the margins on each side and every page of the document is cropped to match.',
		heading: 'How to crop a PDF',
		body: [
			'Open a PDF and enter how many units to cut from the top, right, bottom and left of each page. The same margins are applied to every page, which keeps scanned documents consistent — press Continue and check the preview before downloading.',
			'Cropping is a common clean-up step for scans: after <a href="/scan-to-pdf/">scanning to PDF</a> you can cut away the desk around the page, <a href="/rotate-pdf/">rotate PDF</a> pages that came out sideways, then <a href="/compress-pdf/">compress the PDF</a> before sending it on.',
		],
		faq: [
			{
				q: 'Are the cropped areas deleted from the file?',
				a: 'The pages are redrawn without the margins you set, so the removed area is no longer visible or printed in the downloaded document.',
			},
			{
				q: 'Does cropping apply to every page?',
				a: 'Yes. One set of margins is applied to the whole document, which keeps page sizes and alignment consistent throughout.',
			},
		],
	},
	'protect-pdf': {
		title: 'Protect PDF with a Password | PDF AI',
		description:
			'PDF AI cannot encrypt PDF files with a password in this browser build. See why, and which document privacy tools do work in your browser today.',
		intro:
			'Password protection is not available in this build of PDF AI. Browser-safe encryption for existing PDFs is not implemented here, so this page will not process a file rather than simulate protection it cannot deliver.',
		heading: 'Why password protection is not available',
		body: [
			'Encrypting a PDF properly means writing a standards-compliant password security handler into the file. That is not implemented in this release, so the tool is deliberately switched off instead of producing a document that only appears to be protected — a file that looks locked but is not would be worse than no protection at all.',
			'If you need to share a document carefully today, you can still strip identifying details with the <a href="/pdf-metadata-remover/">PDF metadata remover</a>, add a visible mark with <a href="/add-watermark/">add watermark</a>, or remove the pages that should not travel with the file using <a href="/remove-pdf-pages/">remove PDF pages</a>. Everything else on the site runs in your browser as usual.',
		],
		faq: [
			{
				q: 'Can I password protect a PDF with PDF AI?',
				a: 'Not in this build. The encryption step is not implemented, and the page says so instead of producing a file that only looks protected.',
			},
			{
				q: 'What can I use instead?',
				a: 'Clear metadata with the PDF metadata remover, mark pages with a watermark, or remove sensitive pages entirely — all of them run fully in your browser.',
			},
		],
	},
	'sign-pdf': {
		title: 'Sign PDF Online Free — Add a Signature to a PDF | PDF AI',
		description:
			'Add a visible electronic signature to a PDF online. Type your signature, choose the position and size, and download — free in your browser.',
		intro:
			'Place a signature on a document with this free sign PDF tool. Type your name, choose where it sits on the page, and download a signed copy without printing or scanning anything.',
		heading: 'How to sign a PDF online',
		body: [
			'Open a PDF, type the signature text, then click the page where it should go. Adjust the size, colour and position — bottom-right is the conventional spot — and continue to preview and download the signed document. You can add the same signature to several pages in one pass.',
			'This creates a visible electronic signature: an image of your name drawn onto the page, not a certificate-backed digital signature. For a complete signing workflow, add the date with the <a href="/edit-pdf/">edit PDF tool</a> and stamp page numbers with <a href="/add-page-numbers/">add page numbers</a> before you <a href="/compress-pdf/">compress the PDF</a> to send it.',
		],
		faq: [
			{
				q: 'Is this a legally binding digital signature?',
				a: 'No. It is a visible typed signature drawn onto the page — not a certificate-backed or PAdES signature — so treat it as you would a handwritten mark on a printed copy.',
			},
			{
				q: 'Can I sign more than one page at once?',
				a: 'Yes. Select the pages that need the signature and the same signature is added to each of them in a single pass.',
			},
		],
	},
	'pdf-metadata-remover': {
		title: 'PDF Metadata Remover — Clear Document Info | PDF AI',
		description:
			'Remove metadata from a PDF online free. Clear the title, author, producer and keyword fields in your browser before you share a document.',
		intro:
			'Clear the hidden details a PDF carries with it — title, author, producer and keywords — using this free metadata remover. The document is cleaned locally and downloaded as usual.',
		heading: 'How to remove PDF metadata',
		body: [
			'Choose a PDF and press Continue. The standard document information fields are cleared from the file, and the preview confirms the result before you download it. Embedded XMP or custom metadata written by other applications may remain, so review the file if the document is sensitive.',
			'Metadata cleaning fits into a wider tidy-up: <a href="/remove-pdf-pages/">remove PDF pages</a> that should not travel with the document, <a href="/edit-pdf/">edit the PDF</a> to add a note, and <a href="/compress-pdf/">compress the PDF</a> before sending it. The <a href="/help/">help page</a> lists the technical limits of every tool in one place.',
		],
		faq: [
			{
				q: 'Which metadata fields are removed?',
				a: 'The standard document fields — title, author, producer and keywords — are cleared. Custom XMP metadata written by other apps may still be present in the file.',
			},
			{
				q: 'Is my document uploaded to be cleaned?',
				a: 'No. The metadata is edited inside your browser tab; the file is read and written on your device like every other tool here.',
			},
		],
	},
	'ocr-pdf': {
		title: 'OCR PDF — Text Recognition Not in This Build | PDF AI',
		description:
			'PDF AI does not bundle the offline OCR language model in this build, so OCR cannot run here. See what works instead in your browser.',
		intro:
			'Optical character recognition is not available in this build of PDF AI. The offline language model is not bundled with the site, so this page does not process files rather than guess at text it cannot read accurately.',
		heading: 'Why OCR is not available here',
		body: [
			'OCR needs a language model of tens of megabytes to be downloaded before it can read a scanned page. This build does not bundle that model, and downloading one would break the promise the rest of the site keeps: nothing leaves your device. Rather than quietly fail on a scanned document, the tool says so upfront.',
			'If your PDF already contains real text — most downloaded documents do — <a href="/pdf-to-word/">PDF to Word</a> and <a href="/pdf-to-markdown/">PDF to Markdown</a> extract it directly, and <a href="/compare-pdf/">compare PDF</a> can read two documents side by side. Photographs of pages can be turned into documents with <a href="/scan-to-pdf/">scan to PDF</a>.',
		],
		faq: [
			{
				q: 'Can PDF AI read text from a scanned PDF?',
				a: 'Not in this build. OCR requires an offline language model that is not bundled here, so scanned images cannot be converted into text on this site.',
			},
			{
				q: 'Which tools work on a PDF that already has text?',
				a: 'PDF to Word, PDF to Markdown and Compare PDF all read embedded text directly, without any OCR step.',
			},
		],
	},
	'compare-pdf': {
		title: 'Compare PDF Online — Diff Two Documents | PDF AI',
		description:
			'Compare two PDF files online free. PDF AI extracts the text of both documents and shows the differences side by side in your browser.',
		intro:
			'See what changed between two versions of a document with this free compare PDF tool. Both files are read as text and the differences are laid out for you to review.',
		heading: 'How to compare two PDF files',
		body: [
			'Select exactly two PDFs on the upload screen, then press Continue. Each document is read as text and the results are presented side by side so you can spot added, removed or changed wording. The report is a plain text comparison rather than a visual redline of the pages.',
			'Comparison is most useful late in a review cycle: read the differences, then fix the copy you need with <a href="/edit-pdf/">edit PDF</a> or the <a href="/editor/">full editor</a>, stamp the final version with <a href="/add-page-numbers/">page numbers</a>, and <a href="/compress-pdf/">compress the PDF</a> before it goes out.',
		],
		faq: [
			{
				q: 'Is this a legal redline comparison?',
				a: 'No. The tool compares the extracted text of two documents — wording changes are easy to see, while formatting and layout differences are not reported.',
			},
			{
				q: 'How many files can I compare?',
				a: 'Exactly two at a time. Compare the current version against the previous one, then repeat for older drafts if you need to track changes further back.',
			},
		],
	},
};
