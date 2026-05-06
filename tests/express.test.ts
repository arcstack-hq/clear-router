import '../example/express/web'

import { beforeEach, describe, expect, it } from 'vitest'
import express, { Router as ExRouter } from 'express'

import Router from '../src/express/router'
import request from 'supertest'

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
        Router.get('/fetch-response', () => new Response('accepted', {
            status: 202,
            headers: { 'content-type': 'text/custom' },
        }))

        await setupApp()

        const html = await request(app).get('/html')
        expect(html.statusCode).toBe(200)
        expect(html.headers['content-type']).toContain('text/html')
        expect(html.text).toBe('<h1>Hello</h1>')

        const xhr = await request(app).get('/api/text').set('x-requested-with', 'XMLHttpRequest')
        expect(xhr.headers['content-type']).toContain('text/plain')

        const created = await request(app).post('/created')
        expect(created.statusCode).toBe(201)
        expect(created.text).toBe('true')

        const payload = await request(app).get('/payload')
        expect(payload.headers['content-type']).toContain('application/json')
        expect(payload.body).toEqual({ ok: true })

        const fetchResponse = await request(app).get('/fetch-response')
        expect(fetchResponse.statusCode).toBe(202)
        expect(fetchResponse.headers['content-type']).toContain('text/custom')
        expect(fetchResponse.text).toBe('accepted')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', ({ res }) => res.send('Hello'))
        await setupApp()
        const res = await request(app).options('/peeps/123')

        expect(res.status).toBe(204)
        expect(res.headers['allow']).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
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

        const getRes = await request(app).get('/body-check')
        expect(getRes.status).toBe(200)
        expect(getRes.body).toEqual({
            hasGetBody: true,
            body: {},
        })

        const payload = { foo: 'bar' }
        const postRes = await request(app).post('/body-check').send(payload)
        expect(postRes.status).toBe(200)
        expect(postRes.body).toEqual({
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

        const res = await request(app)
            .post('/api/users/123')
            .send({ _method: 'PUT' })

        expect(res.statusCode).toBe(200)
        expect(res.body).toEqual({
            method: 'PUT',
            id: '123',
        })
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', ({ res }) => res.send('updated'))

        await setupApp()

        const res = await request(app)
            .post('/api/users/123')
            .send({})

        expect(res.statusCode).toBe(404)
    })
})
