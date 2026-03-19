import '../example/h3/web'

import { beforeEach, describe, expect, it } from 'vitest'

import { Controller } from 'src'
import { H3 } from 'h3'
import { H3App } from 'types/h3'
import Router from '../src/h3/router'

describe('H3 App (JS)', () => {
    let app: H3
    let router: H3App

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
        router = Router.apply(app)
    }

    it('GET / should return 200', async () => {
        Router.get('/directly', () => 'Hello World')
        await setupApp()
        const res = await router.fetch(new Request(new URL('http://localhost/directly')))
        expect(res.status).toBe(200)
        expect(await res.text()).toBeDefined()
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', () => 'Hello')
        await setupApp()
        const res = await router
            .fetch(new global.Request(new URL('http://localhost/peeps/123'), {
                method: 'OPTIONS',
            }))

        expect(res.status).toBe(204)
        expect(res.headers.get('Allow')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
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

        const res = await router.fetch(new global.Request(new URL('http://localhost/upload'), {
            method: 'POST',
            body: formData,
        }))

        expect(res.status).toBe(200)
        expect(await res.text()).toBe('Received file: hello.txt')
    })

    it('returns 404 for POST to PUT route when _method override is missing', async () => {
        Router.put('/api/users/:id', () => 'updated')

        await setupApp()

        const res = await router.fetch(new global.Request(new URL('http://localhost/api/users/123'), {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({}),
        }))

        expect(res.status).toBe(404)
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

        const getRes = await router.fetch(new global.Request(new URL('http://localhost/body-check')))
        expect(getRes.status).toBe(200)
        expect(await getRes.json()).toEqual({
            hasGetBody: true,
            body: {},
        })

        const payload = { foo: 'bar' }
        const postRes = await router.fetch(new global.Request(new URL('http://localhost/body-check'), {
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
})
