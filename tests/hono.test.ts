import { beforeEach, describe, expect, it } from 'vitest'

import { Hono } from 'hono'
import Router from '../src/hono/router'

describe('Hono App (JS)', () => {
    let app: Hono

    beforeEach(() => {
        Router.routes = []
        Router.prefix = ''
        Router.groupMiddlewares = []
        Router.globalMiddlewares = []
        Router.routesByPathMethod = {}
        Router.routesByMethod = {}

        app = new Hono()
    })

    const setupApp = (): void => {
        Router.apply(app as any)
    }

    it('GET / should return 200', async () => {
        Router.get('/directly', () => 'Hello World')
        setupApp()

        const res = await app.fetch(new Request('http://localhost/directly'))
        expect(res.status).toBe(200)
        expect(await res.text()).toBe('Hello World')
    })

    it('supports direct primitive, object, and Response returns', async () => {
        Router.get('/html', () => '<h1>Hello</h1>')
        Router.get('/api/text', () => '<h1>Hello</h1>')
        Router.post('/created', () => false)
        Router.get('/payload', () => ({ ok: true }))
        Router.get('/fetch-response', () => new Response('accepted', {
            status: 202,
            headers: { 'content-type': 'text/custom' },
        }))

        setupApp()

        const html = await app.fetch(new Request('http://localhost/html'))
        expect(html.status).toBe(200)
        expect(html.headers.get('content-type')).toContain('text/html')
        expect(await html.text()).toBe('<h1>Hello</h1>')

        const xhr = await app.fetch(new Request('http://localhost/api/text', {
            headers: { 'x-requested-with': 'XMLHttpRequest' },
        }))
        expect(xhr.headers.get('content-type')).toContain('text/plain')

        const created = await app.fetch(new Request('http://localhost/created', { method: 'POST' }))
        expect(created.status).toBe(201)
        expect(await created.text()).toBe('false')

        const payload = await app.fetch(new Request('http://localhost/payload'))
        expect(payload.headers.get('content-type')).toContain('application/json')
        expect(await payload.json()).toEqual({ ok: true })

        const fetchResponse = await app.fetch(new Request('http://localhost/fetch-response'))
        expect(fetchResponse.status).toBe(202)
        expect(fetchResponse.headers.get('content-type')).toContain('text/custom')
        expect(await fetchResponse.text()).toBe('accepted')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', () => 'Hello')
        setupApp()

        const res = await app.fetch(new Request('http://localhost/peeps/123', {
            method: 'OPTIONS',
        }))

        expect(res.status).toBe(204)
        expect(res.headers.get('Allow')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    })

    it('should always expose req.getBody in handlers', async () => {
        Router.get('/body-check', (ctx) => {
            return ctx.json({
                hasGetBody: typeof ctx.req.getBody === 'function',
                body: ctx.req.getBody(),
            })
        })

        Router.post('/body-check', (ctx) => {
            return ctx.json({
                hasGetBody: typeof ctx.req.getBody === 'function',
                body: ctx.req.getBody(),
            })
        })

        setupApp()

        const getRes = await app.fetch(new Request('http://localhost/body-check'))
        expect(getRes.status).toBe(200)
        expect(await getRes.json()).toEqual({
            hasGetBody: true,
            body: {},
        })

        const payload = { foo: 'bar' }
        const postRes = await app.fetch(new Request('http://localhost/body-check', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify(payload),
        }))
        expect(postRes.status).toBe(200)
        expect(await postRes.json()).toEqual({
            hasGetBody: true,
            body: payload,
        })
    })

    it('supports POST _method override for PUT routes', async () => {
        Router.put('/api/users/:id', (ctx) => {
            return ctx.json({
                method: ctx.req.method,
                id: ctx.req.param('id'),
            })
        })

        setupApp()

        const res = await app.fetch(new Request('http://localhost/api/users/123', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({ _method: 'PUT' }),
        }))

        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({
            method: 'POST',
            id: '123',
        })
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', () => 'updated')

        setupApp()

        const res = await app.fetch(new Request('http://localhost/api/users/123', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({}),
        }))

        expect(res.status).toBe(404)
    })
})
