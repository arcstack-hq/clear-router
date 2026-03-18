import { defineConfig } from 'vitepress'

export default defineConfig({
    title: 'clear-router',
    description: 'Laravel-style routing for Express and H3',
    lang: 'en-US',
    cleanUrls: true,
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/index' },
            { text: 'Express', link: '/EXPRESS' },
            { text: 'H3', link: '/H3' },
            { text: 'API', link: '/API' },
            { text: 'Testing', link: '/TESTING' },
        ],
        sidebar: [
            {
                text: 'Documentation',
                items: [
                    { text: 'Overview', link: '/index' },
                    { text: 'Using with Express', link: '/EXPRESS' },
                    { text: 'Using with H3', link: '/H3' },
                    { text: 'API Reference', link: '/API' },
                    { text: 'Testing Guide', link: '/TESTING' },
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
