import '../example/express/web'

import { beforeEach, describe, expect, it } from 'vitest'
import express, { Router as ExRouter } from 'express'

import Router from '../src/express/router'
import request from 'parasito'

describe('Express App (JS)', () => {
    let app: express.Application
    let router: ExRouter

    beforeEach(() => {
        Router.routes = []
        Router.prefix = ''
        Router.groupMiddlewares = []
        Router.globalMiddlewares = []
        Router.routesByPathMethod = {}
        Router.routesByMethod = {}

        app = express()
        router = ExRouter()
        app.use(express.json())
    })

    const setupApp = async (): Promise<void> => {
        Router.apply(router)
        app.use(router)
    }

    it('GET / should return 200', async () => {
        Router.get('/directly', ({ res }) => res.send('Hello World'))
        await setupApp()
        const res = await request(app).get('/directly')
        expect(res.statusCode).toBe(200)
        expect(res.text || res.body).toBeDefined()
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

        await setupApp()

        await request(app).get('/html')
            .expect(200)
            .expect('content-type', 'text/html; charset=utf-8')
            .expect('<h1>Hello</h1>')

        await request(app)
            .get('/api/text')
            .set('x-requested-with', 'XMLHttpRequest')
            .expect('content-type', 'text/plain; charset=utf-8')

        await request(app)
            .post('/created')
            .expect(201)
            .expect('true')

        await request(app)
            .get('/payload')
            .expect(200)
            .expect('content-type', 'application/json; charset=utf-8')
            .expect({ ok: true })

        await request(app)
            .put('/api/users/123')
            .send({ name: 'Ada' })
            .expect(202)
            .expect('content-type', 'application/json; charset=utf-8')
            .expect('x-user-id', '123')
            .expect({ id: '123', name: 'Ada', method: 'PUT' })

        await request(app)
            .get('/fetch-response')
            .expect(202)
            .expect('content-type', 'text/custom')
            .expect('accepted')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', ({ res }) => res.send('Hello'))
        await setupApp()

        await request(app)
            .options('/peeps/123')
            .expect(204)
            .expect('allow', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    })

    it('should always expose req.getBody in handlers', async () => {
        Router.get('/body-check', ({ req, res }) => {
            res.json({
                hasGetBody: typeof req.getBody === 'function',
                body: req.getBody(),
            })
        })

        Router.post('/body-check', ({ req, res }) => {
            res.json({
                hasGetBody: typeof req.getBody === 'function',
                body: req.getBody(),
            })
        })

        await setupApp()

        await request(app)
            .get('/body-check')
            .expect(200)
            .expect({
                hasGetBody: true,
                body: {},
            })

        const payload = { foo: 'bar' }
        await request(app).post('/body-check').send(payload)
            .expect(200)
            .expect({
                hasGetBody: true,
                body: payload,
            })
    })

    it('supports POST _method override for PUT routes', async () => {
        Router.put('/api/users/:id', ({ req, res }) => {
            res.json({
                method: req.method,
                id: req.params.id,
            })
        })

        await setupApp()

        await request(app)
            .post('/api/users/123')
            .send({ _method: 'PUT' })
            .expect(200)
            .expect({
                method: 'PUT',
                id: '123',
            })
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', ({ res }) => res.send('updated'))

        await setupApp()

        await request(app)
            .post('/api/users/123')
            .send({})
            .expect(404)
    })
})
