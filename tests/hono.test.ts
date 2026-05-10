import { beforeEach, describe, it } from 'vitest'

import { Hono } from 'hono'
import Router from '../src/hono/router'
import request from 'parasito'

describe('Hono App (JS)', () => {
    let app: Hono

    beforeEach(() => {
        Router.reset()

        app = new Hono()
    })

    const setupApp = (): void => {
        Router.apply(app as any)
    }

    it('GET / should return 200', async () => {
        Router.get('/directly', () => 'Hello World')
        setupApp()

        await request(app).get('/directly')
            .expect(200)
            .expect('Hello World')
    })

    it('supports direct primitive, object, and Response returns', async () => {
        Router.get('/html', () => '<h1>Hello</h1>')
        Router.get('/api/text', () => '<h1>Hello</h1>')
        Router.post('/created', () => false)
        Router.get('/payload', () => ({ ok: true }))
        Router.put('/api/users/:id', ({ clearRequest, clearResponse }) => {
            clearResponse
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

        setupApp()

        await request(app).get('/html')
            .expect(200)
            .expect('content-type', 'text/html; charset=utf-8')
            .expect('<h1>Hello</h1>')

        await request(app).get('/api/text')
            .set('x-requested-with', 'XMLHttpRequest')
            .expect('content-type', 'text/plain; charset=utf-8')

        await request(app).post('/created')
            .expect(201)
            .expect('false')

        await request(app).get('/payload')
            .expect('content-type', 'application/json; charset=utf-8')
            .expect({ ok: true })

        await request(app).put('/api/users/123')
            .set('content-type', 'application/json')
            .send({ name: 'Ada' })
            .expect(202)
            .expect('x-user-id', '123')
            .expect('content-type', 'application/json; charset=utf-8')
            .expect({ id: '123', name: 'Ada', method: 'PUT' })

        await request(app).get('/fetch-response')
            .expect('content-type', 'text/custom')
            .expect(202)
            .expect('accepted')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', () => 'Hello')
        setupApp()

        await request(app).options('/peeps/123')
            .expect(204)
            .expect('Allow', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
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

        await request(app).get('/body-check')
            .expect(200)
            .expect({
                hasGetBody: true,
                body: {},
            })

        const payload = { foo: 'bar' }

        await request(app).post('/body-check')
            .set('content-type', 'application/json')
            .send(payload)
            .expect(200)
            .expect({
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

        await request(app).post('/api/users/123')
            .set('content-type', 'application/json')
            .send({ _method: 'PUT' })
            .expect(200)
            .expect({
                method: 'POST',
                id: '123',
            })
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', () => 'updated')

        setupApp()

        await request(app).post('/api/users/123')
            .set('content-type', 'application/json')
            .expect(404)
    })
})
