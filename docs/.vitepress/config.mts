import { defineConfig } from 'vitepress'

export default defineConfig({
    base: '/clear-router/',
    title: 'clear-router',
    description: 'Laravel-style routing for Express, H3, Fastify, and Hono',
    lang: 'en-US',
    cleanUrls: true,
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/index' },
            { text: 'Express', link: '/guide/express' },
            { text: 'Fastify', link: '/guide/fastify' },
            { text: 'H3', link: '/guide/h3' },
            { text: 'Hono', link: '/guide/hono' },
            { text: 'Adapters', link: '/guide/adapters' },
            { text: 'API', link: '/api' },
            { text: 'Testing', link: '/testing' },
        ],
        sidebar: [
            {
                text: 'Documentation',
                items: [
                    { text: 'Overview', link: '/index' },
                    { text: 'Using with Express', link: '/guide/express' },
                    { text: 'Using with Fastify', link: '/guide/fastify' },
                    { text: 'Using with H3', link: '/guide/h3' },
                    { text: 'Using with Hono', link: '/guide/hono' },
                    { text: 'Adapter Authoring Guide', link: '/guide/adapters' },
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
