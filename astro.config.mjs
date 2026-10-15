// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { tools } from './src/data/tools.ts';

// https://astro.build/config
export default defineConfig({
	site: 'https://pdfai.site',
	output: 'static',
	// the Astro dev toolbar is development-only tooling; never show it
	devToolbar: { enabled: false },
	// keeps the sitemap in sync with the current page URLs at build time
	integrations: [sitemap()],
	// tool pages moved from /tools/<slug>/ to /<slug>/
	redirects: Object.fromEntries(tools.map((tool) => [`/tools/${tool.slug}`, `/${tool.slug}`])),
});
