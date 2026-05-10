import { defineConfig } from 'vitepress'

export default defineConfig({
    base: '/clear-router/',
    title: 'clear-router',
    description: 'Laravel-style routing for Node.js with support for Express, H3, Fastify, Hono, and Koa, including CommonJS, ESM, and TypeScript support.',
    lang: 'en-US',
    cleanUrls: true,
    themeConfig: {
        nav: [
            { text: 'Guide', link: '/index' },
            { text: 'Express', link: '/guide/express' },
            { text: 'Fastify', link: '/guide/fastify' },
            { text: 'H3', link: '/guide/h3' },
            { text: 'Hono', link: '/guide/hono' },
            { text: 'Koa', link: '/guide/koa' },
            { text: 'Container Binding', link: '/guide/container-binding' },
            { text: 'Adapters', link: '/guide/adapters' },
            { text: 'API', link: '/api' },
            { text: 'Testing', link: '/testing' },
        ],
        sidebar: [
            {
                text: 'Documentation',
                items: [
                    { text: 'Overview', link: '/index' },
                    {
                        text: 'Usage', collapsed: true, items: [
                            { text: 'Using with Express', link: '/guide/usage/express' },
                            { text: 'Using with Fastify', link: '/guide/usage/fastify' },
                            { text: 'Using with H3', link: '/guide/usage/h3' },
                            { text: 'Using with Hono', link: '/guide/usage/hono' },
                            { text: 'Using with Koa', link: '/guide/usage/koa' },
                        ]
                    },
                    { text: 'Routing', link: '/guide/routing' },
                    { text: 'Requests', link: '/guide/request' },
                    { text: 'Responses', link: '/guide/response' },
                    { text: 'Container Binding', link: '/guide/container-binding' },
                    { text: 'Plugins', link: '/guide/plugins' },
                    { text: 'Adapter Authoring Guide', link: '/guide/adapters' },
                    { text: 'API Reference', link: '/api' },
                    { text: 'Testing Guide', link: '/testing' },
                ],
            },
        ],
        socialLinks: [
            { icon: 'discord', link: 'https://discord.gg/jmQybxKQ7R' },
            { icon: 'github', link: 'https://github.com/toneflix/clear-router' },
            { icon: 'npm', link: 'https://www.npmjs.com/package/clear-router' }
        ],
        search: {
            provider: 'local',
        },
    },
})
