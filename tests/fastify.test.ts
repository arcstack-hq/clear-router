import { beforeEach, describe, expect, it } from 'vitest'
import fastify, { FastifyInstance } from 'fastify'

import Router from '../src/fastify/router'
import request from 'parasito'

describe('Fastify App (JS)', () => {
    let app: FastifyInstance

    beforeEach(() => {
        Router.reset()

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

    it('supports direct primitive, object, and Response returns', async () => {
        Router.get('/html', () => '<h1>Hello</h1>')
        Router.get('/api/text', () => '<h1>Hello</h1>')
        Router.post('/created', () => 42)
        Router.get('/payload', () => ({ ok: true }))
        Router.put('/api/users/:id', ({ clearRequest, clearResponse }) => {
            return clearResponse
                .status(202)
                .setHeader('x-user-id', clearRequest.param('id'))
                .json({
                    id: clearRequest.param('id'),
                    name: clearRequest.input('name'),
                    method: clearRequest.method,
                })
        })
        Router.get('/fetch-response', () => new Response('accepted', {
            status: 202,
            headers: { 'content-type': 'text/custom' },
        }))

        await setupApp()

        await request(app).get('/html')
            .expect(200)
            .expect('content-type', 'text/html; charset=utf-8')
            .expect('<h1>Hello</h1>')

        await request(app).get('/api/text')
            .expect(200)
            .expect('content-type', 'text/plain; charset=utf-8')

        await request(app).post('/created').expect(201).expect('42')

        await request(app).get('/payload')
            .expect('content-type', 'application/json; charset=utf-8')
            .expect({ ok: true })

        await request(app).put('/api/users/123')
            .send({ name: 'Ada' })
            .expect(202)
            .expect('content-type', 'application/json; charset=utf-8')
            .expect('x-user-id', '123')
            .expect({ id: '123', name: 'Ada', method: 'PUT' })

        await request(app).get('/fetch-response')
            .expect('content-type', 'text/custom')
            .expect('accepted')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', () => 'Hello')

        await setupApp()

        await request(app).options('/peeps/123')
            .expect(204)
            .expect('allow', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
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
        expect(postRes.statusCode).toBe(201)
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
