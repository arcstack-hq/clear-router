import '../example/h3/web'

import { beforeEach, describe, it } from 'vitest'

import { Controller } from 'src'
import { H3 } from 'h3'
import Router from '../src/h3/router'
import request from 'parasito'

describe('H3 App (JS)', () => {
    let app: H3

    beforeEach(() => {
        Router.routes = []
        Router.prefix = ''
        Router.groupMiddlewares = []
        Router.globalMiddlewares = []
        Router.routesByPathMethod = {}
        Router.routesByMethod = {}

        app = new H3()
    })

    const setupApp = async (): Promise<void> => {
        Router.apply(app)
    }

    it('GET / should return 200', async () => {
        Router.get('/directly', () => 'Hello World')
        await setupApp()

        await request(app).get('/directly').expect(200).expect('Hello World')
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

        await request(app).get('/api/text')
            .set('x-requested-with', 'XMLHttpRequest')
            .expect(200)
            .expect('content-type', 'text/plain; charset=utf-8')

        await request(app).post('/created')
            .set('x-requested-with', 'XMLHttpRequest')
            .expect(201)
            .expect('true')


        await request(app).get('/payload')
            .set('x-requested-with', 'XMLHttpRequest')
            .expect(200)
            .expect('content-type', 'application/json; charset=utf-8')
            .expect({ ok: true })

        await request(app).put('/api/users/123')
            .send({ name: 'Ada' })
            .expect(202)
            .expect('content-type', 'application/json; charset=utf-8')
            .expect('x-user-id', '123')
            .expect({ id: '123', name: 'Ada', method: 'PUT' })

        await request(app).get('/fetch-response')
            .set('x-requested-with', 'XMLHttpRequest')
            .expect(202)
            .expect('content-type', 'text/custom')
            .expect('accepted')
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', () => 'Hello')
        await setupApp()
        await request(app).options('/peeps/123')
            .expect(204)
            .expect('Allow', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    })

    it('can parse multipart form data', async () => {
        class TestControler extends Controller {
            async upload () {
                return `Received file: ${this.body.file.name}`
            }
        }
        Router.post('/upload', [TestControler, 'upload'])

        await setupApp()

        const formData = new FormData()
        formData.append('file', new Blob(['Hello World'], { type: 'text/plain' }), 'hello.txt')

        await request(app).post('/upload')
            .expect(201)
            .expect('Received file: hello.txt')
            .send(formData)
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', () => 'updated')

        await setupApp()

        await request(app).post('/api/users/123')
            .set('content-type', 'application/json')
            .expect(404)
            .send(JSON.stringify({}))
    })

    it('should always expose req.getBody in handlers', async () => {
        Router.get('/body-check', (ctx) => {
            return JSON.stringify({
                hasGetBody: typeof ctx.req.getBody === 'function',
                body: ctx.req.getBody(),
            })
        })

        Router.post('/body-check', (ctx) => {
            return JSON.stringify({
                hasGetBody: typeof ctx.req.getBody === 'function',
                body: ctx.req.getBody(),
            })
        })

        await setupApp()

        await request(app).get('/body-check')
            .expect(200)
            .expect(JSON.stringify({
                hasGetBody: true,
                body: {},
            }))

        const payload = { foo: 'bar' }

        await request(app).post('/body-check')
            .set('content-type', 'application/json')
            .send(JSON.stringify(payload))
            .expect(201)
            .expect(JSON.stringify({
                hasGetBody: true,
                body: payload,
            }))
    })
})
