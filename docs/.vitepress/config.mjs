import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "V-Train",
  description: "智慧影片收藏與進度追蹤",
  base: '/v-train-extension/', // GitHub Pages 需要這行
  
  locales: {
    root: {
      label: '繁體中文',
      lang: 'zh-TW',
      themeConfig: {
        nav: [
          { text: '首頁', link: '/' },
          { text: '使用指南', link: '/guide/installation' }
        ],
        sidebar: [
          {
            text: '介紹',
            items: [
              { text: '快速上手', link: '/guide/installation' }
            ]
          },
          {
            text: '核心功能',
            items: [
              { text: '控制面板詳解', link: '/guide/dashboard' },
              { text: '適應引擎：訓練新網站', link: '/guide/adaptive-engine' },
              { text: '書籤庫與互動面板', link: '/guide/bookmark-vault' },
              { text: '備份與還原中心', link: '/guide/backup' }
            ]
          },
          {
            text: '進階',
            items: [
              { text: 'Pro 版進階功能', link: '/guide/pro-features' },
              { text: '常見問題 (FAQ)', link: '/guide/faq' }
            ]
          }
        ]
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/en/' },
          { text: 'Guide', link: '/en/guide/installation' }
        ],
        sidebar: [
          {
            text: 'Introduction',
            items: [
              { text: 'Quick Start', link: '/en/guide/installation' }
            ]
          },
          {
            text: 'Core Features',
            items: [
              { text: 'Dashboard Overview', link: '/en/guide/dashboard' },
              { text: 'Adaptive Engine', link: '/en/guide/adaptive-engine' },
              { text: 'Bookmark Vault', link: '/en/guide/bookmark-vault' },
              { text: 'Backup & Restore', link: '/en/guide/backup' }
            ]
          },
          {
            text: 'Advanced',
            items: [
              { text: 'Pro Features', link: '/en/guide/pro-features' },
              { text: 'FAQ', link: '/en/guide/faq' }
            ]
          }
        ]
      }
    }
  },

  themeConfig: {
    logo: '/icon.png',
    socialLinks: [
      { icon: 'github', link: 'https://github.com/vtrain-labs/v-train-extension' }
    ]
  }
})
