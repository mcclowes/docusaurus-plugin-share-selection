import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('@docusaurus/types').Config} */
export default {
  title: 'Share selection example',
  url: 'https://example.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  i18n: { defaultLocale: 'en', locales: ['en'] },

  presets: [
    [
      'classic',
      {
        docs: { sidebarPath: path.resolve(__dirname, './sidebars.js') },
        blog: { showReadingTime: true, onUntruncatedBlogPosts: 'ignore' },
        theme: { customCss: path.resolve(__dirname, './src/css/custom.css') },
      },
    ],
  ],

  plugins: [
    [
      path.resolve(__dirname, '../../dist/index.js'),
      /** @type {import('docusaurus-plugin-share-selection').ShareSelectionOptions} */ ({
        actions: [
          'copy',
          'ai',
          'markdown',
          'share',
          {
            label: 'Report issue',
            url: 'https://github.com/mcclowes/docusaurus-plugin-share-selection/issues/new?title=Docs:%20{title}&body={quote}',
          },
        ],
        // Normally picked up from docusaurus-plugin-open-with-llm when it's installed.
        ai: { markdownFile: 'index.md' },
      }),
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Share selection',
      items: [
        { to: '/docs/intro', label: 'Docs', position: 'left' },
        { to: '/blog', label: 'Blog', position: 'left' },
      ],
    },
  },
};
