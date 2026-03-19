import { beforeEach, describe, expect, it } from 'vitest'
import fastify, { FastifyInstance } from 'fastify'

import Router from '../src/fastify/router'

describe('Fastify App (JS)', () => {
    let app: FastifyInstance

    beforeEach(() => {
        Router.routes = []
        Router.prefix = ''
        Router.groupMiddlewares = []
        Router.globalMiddlewares = []
        Router.routesByPathMethod = {}
        Router.routesByMethod = {}

        app = fastify()
    })

    const setupApp = async (): Promise<void> => {
        Router.apply(app)
        await app.ready()
    }

    it('GET / should return 200', async () => {
        Router.get('/directly', () => 'Hello World')

        await setupApp()

        const res = await app.inject({ method: 'GET', url: '/directly' })
        expect(res.statusCode).toBe(200)
        expect(res.body).toBe('Hello World')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', () => 'Hello')

        await setupApp()

        const res = await app.inject({ method: 'OPTIONS', url: '/peeps/123' })

        expect(res.statusCode).toBe(204)
        expect(res.headers['allow']).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    })

    it('should always expose req.getBody in handlers', async () => {
        Router.get('/body-check', ({ req }) => {
            return {
                hasGetBody: typeof req.getBody === 'function',
                body: req.getBody(),
            }
        })

        Router.post('/body-check', ({ req }) => {
            return {
                hasGetBody: typeof req.getBody === 'function',
                body: req.getBody(),
            }
        })

        await setupApp()

        const getRes = await app.inject({ method: 'GET', url: '/body-check' })
        expect(getRes.statusCode).toBe(200)
        expect(getRes.json()).toEqual({
            hasGetBody: true,
            body: {},
        })

        const payload = { foo: 'bar' }
        const postRes = await app.inject({
            method: 'POST',
            url: '/body-check',
            payload,
        })
        expect(postRes.statusCode).toBe(200)
        expect(postRes.json()).toEqual({
            hasGetBody: true,
            body: payload,
        })
    })

    it('supports POST _method override for PUT routes', async () => {
        Router.put('/api/users/:id', ({ req }) => {
            return {
                method: req.method,
                id: (req.params as Record<string, string>).id,
            }
        })

        await setupApp()

        const res = await app.inject({
            method: 'POST',
            url: '/api/users/123',
            payload: { _method: 'PUT' },
        })

        expect(res.statusCode).toBe(200)
        expect(res.json()).toEqual({
            method: 'POST',
            id: '123',
        })
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', () => 'updated')

        await setupApp()

        const res = await app.inject({
            method: 'POST',
            url: '/api/users/123',
            payload: {},
        })

        expect(res.statusCode).toBe(404)
    })
})
