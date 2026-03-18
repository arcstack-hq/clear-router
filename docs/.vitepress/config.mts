import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'clear-router',
    description: 'Laravel-style routing for Express and H3',
    lang: 'en-US',
    cleanUrls: true,
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/index' },
            { text: 'Express', link: '/express' },
            { text: 'H3', link: '/h3' },
            { text: 'Adapters', link: '/adapters' },
            { text: 'API', link: '/api' },
            { text: 'Testing', link: '/testing' },
        ],
        sidebar: [
            {
                text: 'Documentation',
                items: [
                    { text: 'Overview', link: '/index' },
                    { text: 'Using with Express', link: '/express' },
                    { text: 'Using with H3', link: '/h3' },
                    { text: 'Adapter Authoring Guide', link: '/adapters' },
                    { text: 'API Reference', link: '/api' },
                    { text: 'Testing Guide', link: '/testing' },
                ],
            },
        ],
        socialLinks: [
            { icon: 'github', link: 'https://github.com/toneflix/clear-router' },
        ],
        search: {
            provider: 'local',
        },
    },
})
