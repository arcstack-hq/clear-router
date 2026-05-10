import { beforeEach, describe, expect, it } from 'vitest'

import Koa from 'koa'
import KoaRouter from '@koa/router'
import Router from '../src/koa/router'
import request from 'parasito'

describe('Koa App (JS)', () => {
    let app: Koa
    let router: KoaRouter

    beforeEach(() => {
        Router.reset()

        app = new Koa()
        router = new KoaRouter()
    })

    const setupApp = (): void => {
        Router.apply(router)
        app.use(router.routes())
        app.use(router.allowedMethods())
    }

    it('GET / should return 200', async () => {
        Router.get('/directly', () => 'Hello World')
        setupApp()

        const res = await request(app.callback()).get('/directly')

        expect(res.statusCode).toBe(200)
        expect(res.text).toBe('Hello World')
    })

    it('supports direct primitive, object, and Response returns', async () => {
        Router.get('/html', () => '<h1>Hello</h1>')
        Router.get('/api/text', () => '<h1>Hello</h1>')
        Router.post('/created', () => true)
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

        const html = await request(app.callback()).get('/html')
        expect(html.statusCode).toBe(200)
        expect(html.header['content-type']).toContain('text/html')
        expect(html.text).toBe('<h1>Hello</h1>')

        const xhr = await request(app.callback())
            .get('/api/text')
            .set('x-requested-with', 'XMLHttpRequest')
        expect(xhr.header['content-type']).toContain('text/plain')

        const created = await request(app.callback()).post('/created')
        expect(created.statusCode).toBe(201)
        expect(created.text).toBe('true')

        const payload = await request(app.callback()).get('/payload')
        expect(payload.header['content-type']).toContain('application/json')
        expect(payload.body).toEqual({ ok: true })

        const unified = await request(app.callback()).put('/api/users/123').send({ name: 'Ada' })
        expect(unified.statusCode).toBe(202)
        expect(unified.header['content-type']).toContain('application/json')
        expect(unified.header['x-user-id']).toBe('123')
        expect(unified.body).toEqual({ id: '123', name: 'Ada', method: 'PUT' })

        const fetchResponse = await request(app.callback()).get('/fetch-response')
        expect(fetchResponse.statusCode).toBe(202)
        expect(fetchResponse.header['content-type']).toContain('text/custom')
        expect(fetchResponse.text).toBe('accepted')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', () => 'Hello')
        setupApp()

        const res = await request(app.callback()).options('/peeps/123')

        expect(res.statusCode).toBe(204)
        expect(res.header['allow']).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    })

    it('should always expose request.getBody in handlers', async () => {
        Router.get('/body-check', (ctx) => {
            return {
                hasGetBody: typeof ctx.request.getBody === 'function',
                body: ctx.request.getBody(),
            }
        })

        Router.post('/body-check', (ctx) => {
            return {
                hasGetBody: typeof ctx.request.getBody === 'function',
                body: ctx.request.getBody(),
            }
        })

        setupApp()

        const getRes = await request(app.callback()).get('/body-check')
        expect(getRes.statusCode).toBe(200)
        expect(getRes.body).toEqual({
            hasGetBody: true,
            body: {},
        })

        const payload = { foo: 'bar' }
        const postRes = await request(app.callback()).post('/body-check').send(payload)
        expect(postRes.statusCode).toBe(201)
        expect(postRes.body).toEqual({
            hasGetBody: true,
            body: payload,
        })
    })

    it('supports POST _method override for PUT routes', async () => {
        Router.put('/api/users/:id', (ctx) => {
            return {
                method: ctx.method,
                id: ctx.params.id,
            }
        })

        setupApp()

        const res = await request(app.callback())
            .post('/api/users/123')
            .send({ _method: 'PUT' })

        expect(res.statusCode).toBe(200)
        expect(res.body).toEqual({
            method: 'POST',
            id: '123',
        })
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', () => 'updated')
        setupApp()

        const res = await request(app.callback())
            .post('/api/users/123')
            .send({})

        expect(res.statusCode).toBe(404)
    })
})
