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
