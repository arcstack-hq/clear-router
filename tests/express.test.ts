import '../example/express/web'

import { Bind, Container } from '../src/decorators'
import { beforeEach, describe, expect, it } from 'vitest'
import express, { Router as ExRouter } from 'express'

import { Request as ClearRouterRequest } from '../src/core/Request'
import { Response as ClearRouterResponse } from '../src/core/Response'
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
        Router.configure({
            container: {
                enabled: false,
                autoDiscover: false,
            },
        })
        Container.clear()

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

    it('supports opt-in decorated container binding', async () => {
        class AuditService {
            name = 'discovered'
        }

        class BoundUsersController {
            @Bind(ClearRouterRequest, ClearRouterResponse, AuditService)
            update (request: ClearRouterRequest, response: ClearRouterResponse, audit: AuditService) {
                return response.status(202).json({
                    id: request.param('id'),
                    name: request.input('name'),
                    audit: audit.name,
                })
            }
        }

        Router.configure({
            container: {
                enabled: true,
                autoDiscover: true,
            },
        })
        Router.put('/api/bound/:id', [BoundUsersController, 'update'])

        await setupApp()

        await request(app)
            .put('/api/bound/123')
            .send({ name: 'Ada' })
            .expect(202)
            .expect({ id: '123', name: 'Ada', audit: 'discovered' })
    })

    it('supports TS 5.2 standard decorator metadata without reflect-metadata', async () => {
        class AuditService {
            name = 'standard'
        }

        class StandardUsersController {
            update (request: ClearRouterRequest, audit: AuditService) {
                return {
                    id: request.param('id'),
                    audit: audit.name,
                }
            }
        }

        const metadata = {}
        Bind(ClearRouterRequest, AuditService)(
            StandardUsersController.prototype.update,
            {
                kind: 'method',
                name: 'update',
                static: false,
                private: false,
                access: {
                    has: () => true,
                    get: object => (object as StandardUsersController).update,
                },
                metadata,
                addInitializer: () => undefined,
            } as ClassMethodDecoratorContext<StandardUsersController>
        );

        (StandardUsersController as any)[(Symbol as any).metadata] = metadata

        Router.configure({
            container: {
                enabled: true,
                autoDiscover: true,
            },
        })
        Router.get('/api/standard/:id', [StandardUsersController, 'update'])

        await setupApp()

        await request(app)
            .get('/api/standard/555')
            .expect(200)
            .expect({ id: '555', audit: 'standard' })
    })

    it('enables binding through the decorators setup entry', async () => {
        class SetupController {
            @Bind(ClearRouterRequest)
            show (request: ClearRouterRequest) {
                return { id: request.param('id') }
            }
        }

        await import('../src/decorators/setup')
        Router.get('/api/setup/:id', [SetupController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/setup/999')
            .expect(200)
            .expect({ id: '999' })
    })

    it('supports tokenless @Bind() with design param metadata', async () => {
        class AuditService {
            name = 'metadata'
        }

        @Bind()
        class MetadataController {
            show (request: ClearRouterRequest, audit: AuditService) {
                return {
                    id: request.param('id'),
                    audit: audit.name,
                }
            }
            audit (audit: AuditService, request: ClearRouterRequest) {
                return {
                    id: request.param('id'),
                    audit: audit.name,
                }
            }
        }

        await import('reflect-metadata')
        Router.configure({
            container: {
                enabled: true,
                autoDiscover: true,
            },
        })
        Reflect.defineMetadata('design:paramtypes', [
            ClearRouterRequest,
            AuditService,
        ], MetadataController.prototype, 'show')
        Reflect.defineMetadata('design:paramtypes', [
            AuditService,
            ClearRouterRequest,
        ], MetadataController.prototype, 'audit')

        Router.get('/api/metadata/:id', [MetadataController, 'show'])
        Router.get('/api/audit/:id', [MetadataController, 'audit'])

        await setupApp()

        await request(app)
            .get('/api/metadata/111')
            .expect(200)
            .expect({ id: '111', audit: 'metadata' })

        await request(app)
            .get('/api/audit/111')
            .expect(200)
            .expect({ id: '111', audit: 'metadata' })
    })

    it('uses explicit container bindings when available', async () => {
        class AuditService {
            name = 'fallback'
        }

        class BoundAuditService extends AuditService {
            name = 'bound'
        }

        class BoundUsersController {
            @Bind(ClearRouterRequest, AuditService)
            show (request: ClearRouterRequest, audit: AuditService) {
                return {
                    id: request.param('id'),
                    audit: audit.name,
                }
            }
        }

        Container.bind(AuditService, () => new BoundAuditService())
        Router.configure({
            container: {
                enabled: true,
                autoDiscover: true,
            },
        })
        Router.get('/api/bound/:id', [BoundUsersController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/bound/321')
            .expect(200)
            .expect({ id: '321', audit: 'bound' })
    })

    it('falls back to the default handler signature when binding is disabled', async () => {
        class BoundUsersController {
            @Bind(ClearRouterRequest)
            show (ctx: any, request: ClearRouterRequest) {
                return {
                    hasContext: Boolean(ctx.req),
                    id: request.param('id'),
                }
            }
        }

        Router.configure({
            container: {
                enabled: false,
            },
        })
        Router.get('/api/default/:id', [BoundUsersController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/default/777')
            .expect(200)
            .expect({ hasContext: true, id: '777' })
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
