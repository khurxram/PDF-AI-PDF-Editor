# PDF AI — pdfai.site

A free, open collection of **28 PDF and image tools** that run **entirely in your browser**.
No uploads, no accounts, no server-side processing — your files never leave the device.
---

## Highlights

- 🔒 **100% private** — all processing happens client-side with JavaScript. Files are
  read with the File API, handled in memory, and disappear when the tab closes.
- ⚡ **No backend** — the output is a static site; there is no API, database, or paid
  service behind the tools.
- 🧰 **28 tools** across 7 categories, all free to use.
- 🌐 **SEO-friendly** — every tool gets its own pre-rendered page with unique metadata,
  JSON-LD (`WebApplication` + `FAQPage`), and an auto-generated sitemap.

---

## Tools

| Category | Tools |
| :------- | :---- |
| **Organize PDF** | Merge PDF, Split PDF, Remove PDF Pages, Extract PDF Pages, Organize PDF Pages, Rotate PDF, Scan to PDF |
| **Optimize PDF** | Compress PDF, Reduce PDF to a Target Size, Compress Image, Compress JPG, Compress PNG |
| **Convert to PDF** | JPG to PDF, Word to PDF, HTML to PDF |
| **Convert from PDF** | PDF to Word, PDF to JPG, PDF to Markdown |
| **Edit PDF** | Edit PDF, Add Page Numbers to PDF, Add Watermark to PDF, Crop PDF |
| **PDF Privacy & Security** | Sign PDF, PDF Metadata Remover, Protect PDF* |
| **PDF Analysis** | Compare PDF, OCR PDF* |

\* **Protect PDF** and **OCR PDF** are intentionally marked unavailable in this build:
browser-safe password encryption and offline OCR language models are not bundled. Their
pages explain the limitation and point users to working alternatives.

---

## Tech stack

| Layer | Choice |
| :---- | :----- |
| Framework | [Astro](https://astro.build) (static output, `output: 'static'`) |
| PDF read/render | [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist) |
| PDF create/edit | [`pdf-lib`](https://www.npmjs.com/package/pdf-lib) |
| Text-based PDF | [`jspdf`](https://www.npmjs.com/package/jspdf) |
| DOCX → PDF | [`mammoth`](https://www.npmjs.com/package/mammoth) |
| PDF → DOCX | [`docx`](https://www.npmjs.com/package/docx) |
| HTML → PDF | [`html2canvas`](https://www.npmjs.com/package/html2canvas) |
| SEO | [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/) |
| Deploy | Cloudflare (static assets from `./dist`) |

Requires **Node.js ≥ 22.12.0**.

---

## Getting started

```sh
# 1. Install dependencies
npm install

# 2. Start the dev server (http://localhost:4321)
npm run dev

# 3. Build for production → ./dist
npm run build

# 4. Preview the production build locally
npm run preview
```

Other useful commands:

| Command | Action |
| :------ | :----- |
| `npm run astro ...` | Run Astro CLI commands (e.g. `astro add`, `astro check`) |
| `npm run astro -- --help` | Show Astro CLI help |

---

## Project structure

```text
/
├── public/              # Static assets: favicons, robots.txt, _redirects, og-image
├── src/
│   ├── components/      # Astro components (ToolWorkspace, ToolCard, Header, SEO, …)
│   ├── data/
│   │   ├── tools.ts     # Single source of truth: tool list, categories, steps
│   │   └── tool-seo.ts  # Per-tool titles, descriptions, guides, FAQs
│   ├── layouts/         # BaseLayout (page shell, meta, JSON-LD)
│   ├── pages/
│   │   ├── index.astro  # Home page with the tool grid
│   │   ├── [slug].astro # Dynamic page for every tool (getStaticPaths)
│   │   └── …            # about, help, contact, privacy, terms, 404, editor
│   ├── scripts/         # Client-side TypeScript (tool-workspace, pdfjs-setup, pdf-editor)
│   └── styles/          # global.css, tool-picker.css, editor.css
├── astro.config.mjs     # site URL, sitemap, /tools/* → /* redirects
└── wrangler.jsonc       # Cloudflare deployment config
```

---

## How it works

1. `src/data/tools.ts` defines every tool (slug, name, category, accepted file types,
   and a `mode` that selects the processing flow).
2. `src/pages/[slug].astro` uses `getStaticPaths()` to pre-render one page per tool,
   each embedding the `ToolWorkspace` component.
3. `src/scripts/tool-workspace.ts` drives the whole UI in the browser — upload →
   setup → result — and performs the actual work with `pdf-lib`, `pdfjs-dist`,
   `jspdf`, `mammoth`, `docx`, and `html2canvas`.
4. Nothing is sent to a server; results are generated as Blobs and downloaded directly.

### Adding a new tool

1. Add an entry to the `tools` array in `src/data/tools.ts` (slug, name, category,
   description, accepted types, mode).
2. Add matching SEO copy in `src/data/tool-seo.ts`.
3. Implement the new `mode` in `src/scripts/tool-workspace.ts`.
4. Run `npm run build` — the page, sitemap entry, and redirects are generated
   automatically.

---

## License

**Proprietary — not open source.** Copyright (c) 2026 Muhammad Khurram Shahzad.
See [`LICENSE`](./LICENSE) for the full terms.

In short:

- ✅ You may **download and use it locally** for your own private, personal, non-commercial use.
- ❌ You may **not host or publish** this website (on GitHub Pages, Netlify, Vercel, Cloudflare, your own server, or anywhere else) without written permission.
- ❌ You may **not use it commercially** (ads, subscriptions, resale, paid products, etc.) without a separate written license.
- ⚖️ Unauthorized hosting or commercial use is copyright infringement. The owner may pursue legal action and file takedown notices (e.g. DMCA) to have infringing websites taken down.

**Want to use it commercially or host it publicly?** Contact the copyright holder at **m.khurram.me@gmail.com** to negotiate a license.
