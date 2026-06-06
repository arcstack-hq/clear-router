import '../example/express/web'

import { Bind, Container } from '../src/decorators'
import { beforeEach, describe, expect, it } from 'vitest'
import express, { Router as ExRouter } from 'express'

import { Request as ClearRouterRequest } from '../src/core/Request'
import { Response as ClearRouterResponse } from '../src/core/Response'
import Router from '../src/express/router'
import { definePlugin } from '../src/core/plugins'
import request from 'parasito'
import { basename, resolve } from 'node:path'

describe('Express App (JS)', () => {
    let app: express.Application
    let router: ExRouter

    beforeEach(() => {
        Router.configure({
            container: {
                enabled: false,
                autoDiscover: false,
            },
        })
        Router.reset()
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

    it('loads route groups from relative files and absolute directories', async () => {
        await Router.group('/api', 'tests/fixtures/group-file.ts')
        await Router.group('/account', resolve('tests/fixtures/group-directory'))

        await setupApp()

        await request(app)
            .get('/api/loaded-file')
            .expect(200)
            .expect({ source: 'file' })

        await request(app)
            .get('/account/profile')
            .expect(200)
            .expect({ source: 'directory' })

        await request(app)
            .get('/account/settings')
            .expect(200)
            .expect({ source: 'nested-directory' })
    })

    it('supports conditional groups and arrays of paths or callbacks', async () => {
        const conditionalCallback = () => {
            Router.get('/hidden', () => ({ hidden: false }))
        }
        await Router.group('/conditional', conditionalCallback).when((source) => {
            expect(source).toBe(conditionalCallback)

            return false
        })

        const callbackSources = [
            () => Router.get('/first', () => ({ source: 'first-callback' })),
            () => Router.get('/second', () => ({ source: 'second-callback' })),
        ]
        const seenCallbacks: unknown[] = []
        await Router.group('/callbacks', callbackSources).when((source) => {
            seenCallbacks.push(source)

            return true
        })
        expect(seenCallbacks).toHaveLength(2)
        expect(seenCallbacks).toContain(callbackSources[0])
        expect(seenCallbacks).toContain(callbackSources[1])

        await Router.group('/files', [
            'tests/fixtures/group-array/first.ts',
            'tests/fixtures/group-array/second.ts',
        ])

        const seenDirectoryFiles: string[] = []
        await Router
            .group('/filtered', 'tests/fixtures/group-filter')
            .when((source) => {
                if (typeof source !== 'string') return true

                seenDirectoryFiles.push(basename(source))

                return basename(source) !== 'api.ts'
            })
        expect(seenDirectoryFiles).toEqual(['api.ts', 'users.ts'])

        await Router.group('/parent', async () => {
            Router.get('/visible', () => ({ visible: true }))
            await Router.group('/child', () => {
                Router.get('/hidden', () => ({ hidden: true }))
            }).when(() => false)
        }).when(() => true)

        await setupApp()

        await request(app)
            .get('/conditional/hidden')
            .expect(404)

        await request(app)
            .get('/callbacks/first')
            .expect(200)
            .expect({ source: 'first-callback' })

        await request(app)
            .get('/callbacks/second')
            .expect(200)
            .expect({ source: 'second-callback' })

        await request(app)
            .get('/files/first')
            .expect(200)
            .expect({ source: 'first-file' })

        await request(app)
            .get('/files/second')
            .expect(200)
            .expect({ source: 'second-file' })

        await request(app)
            .get('/filtered/api-file')
            .expect(404)

        await request(app)
            .get('/filtered/users-file')
            .expect(200)
            .expect({ source: 'users-file' })

        await request(app)
            .get('/parent/visible')
            .expect(200)
            .expect({ visible: true })

        await request(app)
            .get('/parent/child/hidden')
            .expect(404)
    })

    it('supports group middleware chaining', async () => {
        await Router.group('/parent', async () => {
            Router.get('/visible', ({ req }: any) => ({
                visible: true,
                middlewareCalled: req.groupMiddlewareCalled,
            }))
        }).middleware((req: any, _res, next) => {
            req.groupMiddlewareCalled = true
            next()
        })

        await setupApp()

        await request(app)
            .get('/parent/visible')
            .expect(200)
            .expect({
                visible: true,
                middlewareCalled: true,
            })
    })

    it('supports class based middleware with a handle method', async () => {
        class AuthMiddleware {
            handle (req: any, _res: any, next: any) {
                req.authenticated = true
                next()
            }
        }

        Router.get('/class-middleware', ({ req, res }) => {
            res.json({ authenticated: (req as any).authenticated })
        }, [AuthMiddleware])

        await setupApp()

        await request(app)
            .get('/class-middleware')
            .expect(200)
            .expect({ authenticated: true })
    })

    it('supports chaining middleware onto route methods', async () => {
        const authMiddleware = (req: any, _res: any, next: any) => {
            req.authenticated = true
            next()
        }

        const route = Router
            .get('/chained-middleware', ({ req, res }) => {
                res.json({ authenticated: (req as any).authenticated })
            })
            .middleware(authMiddleware)

        expect(route.middlewareCount).toBe(1)

        await setupApp()

        await request(app)
            .get('/chained-middleware')
            .expect(200)
            .expect({ authenticated: true })
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

    it('resolves bindings for equivalent class tokens from different loaders', async () => {
        class Model { }

        const LoadedUser = class User extends Model {
            source = 'loaded'
        }
        const ImportedUser = class User extends Model { }

        class LoaderSplitController {
            @Bind(ImportedUser)
            show (user: InstanceType<typeof LoadedUser>) {
                return {
                    source: user.source,
                    loadedInstance: user instanceof LoadedUser,
                    importedInstance: user instanceof ImportedUser,
                }
            }
        }

        Container.bind(LoadedUser, () => new LoadedUser())
        Router.configure({
            container: {
                enabled: true,
            },
        })
        Router.get('/api/loader-split', [LoaderSplitController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/loader-split')
            .expect(200)
            .expect({
                source: 'loaded',
                loadedInstance: true,
                importedInstance: false,
            })
    })

    it('allows plugins to augment http context', async () => {
        const plugin = definePlugin<{ name: string }, { pluginName: string }>({
            name: 'test-plugin',
            setup ({ useHttpContext }) {
                useHttpContext(({ ctx }) => {
                    ctx.pluginName = 'test-plugin'

                    return undefined
                })
            },
        })

        class PluginUsersController {
            show (ctx: { pluginName: string }) {
                return {
                    pluginName: ctx.pluginName
                }
            }
        }

        Router.use(plugin, { name: 'plugin' })
        Router.get('/api/plugin/augment', [PluginUsersController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/plugin/augment')
            .expect(200)
            .expect({ pluginName: 'test-plugin' })
    })

    it('supports plugins registering container bindings', async () => {
        class AuditService {
            constructor(readonly name: string) { }
        }

        const auditPlugin = definePlugin<{ name: string }>({
            name: 'test-audit-plugin',
            setup ({ bind, options }) {
                bind(AuditService, () => new AuditService(options.name))
            },
        })

        class PluginUsersController {
            @Bind(ClearRouterRequest, AuditService)
            show (request: ClearRouterRequest, audit: AuditService) {
                return {
                    id: request.param('id'),
                    audit: audit.name,
                }
            }
        }

        Router.configure({
            container: {
                enabled: true,
            },
        })
        Router.use(auditPlugin, { name: 'plugin' })
        Router.get('/api/plugin/:id', [PluginUsersController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/plugin/246')
            .expect(200)
            .expect({ id: '246', audit: 'plugin' })
    })

    it('waits for async plugins before resolving container bindings', async () => {
        class AsyncAuditService {
            constructor(readonly name: string) { }
        }

        const asyncAuditPlugin = definePlugin<{ name: string }>({
            name: 'test-async-audit-plugin',
            async setup ({ bind, options }) {
                await new Promise(resolve => setTimeout(resolve, 10))
                bind(AsyncAuditService, () => new AsyncAuditService(options.name))
            },
        })

        class PluginUsersController {
            @Bind(ClearRouterRequest, AsyncAuditService)
            show (request: ClearRouterRequest, audit: AsyncAuditService) {
                return {
                    id: request.param('id'),
                    audit: audit.name,
                }
            }
        }

        Router.configure({
            container: {
                enabled: true,
            },
        })
        Router.use(asyncAuditPlugin, { name: 'async-plugin' })
        Router.get('/api/async-plugin/:id', [PluginUsersController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/async-plugin/135')
            .expect(200)
            .expect({ id: '135', audit: 'async-plugin' })
    })

    it('passes the current Request instance to plugin bindings', async () => {
        class RequestAuditService {
            constructor(
                readonly id: string,
                readonly method: string,
            ) { }
        }

        const requestAuditPlugin = definePlugin({
            name: 'test-request-aware-plugin',
            setup ({ bind, getRequest }) {
                expect(getRequest()).toBeUndefined()

                bind(RequestAuditService, (d: { request: ClearRouterRequest }) => {
                    return new RequestAuditService(
                        d.request.param('id'),
                        d.request.method,
                    )
                })
            },
        })

        class PluginUsersController {
            @Bind(RequestAuditService)
            show (audit: RequestAuditService) {
                return {
                    id: audit.id,
                    method: audit.method,
                }
            }
        }

        Router.configure({
            container: {
                enabled: true,
            },
        })
        Router.use(requestAuditPlugin)
        Router.put('/api/request-plugin/:id', [PluginUsersController, 'show'])

        await setupApp()

        await request(app)
            .put('/api/request-plugin/864')
            .expect(200)
            .expect({
                id: '864',
                method: 'PUT',
            })
    })

    it('allows plugins to replace all controller method arguments', async () => {
        class BoundUser {
            constructor(
                readonly id: string,
                readonly source: string
            ) { }
        }

        const routeModelPlugin = definePlugin({
            name: 'test-replace-arguments-plugin',
            setup ({ resolveArguments }) {
                resolveArguments(({ method, request }) => {
                    if (method !== 'showPluginArguments') return undefined

                    return [
                        new BoundUser(request.param('id'), 'plugin'),
                        request,
                        { touched: true },
                    ]
                })
            },
        })

        class PluginArgumentsController {
            showPluginArguments (
                user: BoundUser,
                request: ClearRouterRequest,
                meta: { touched: boolean }
            ) {
                return {
                    id: user.id,
                    source: user.source,
                    requestId: request.param('id'),
                    touched: meta.touched,
                }
            }
        }

        Router.configure({
            container: {
                enabled: true,
            },
        })
        Router.use(routeModelPlugin)
        Router.get('/api/plugin-arguments/:id', [PluginArgumentsController, 'showPluginArguments'])

        await setupApp()

        await request(app)
            .get('/api/plugin-arguments/579')
            .expect(200)
            .expect({
                id: '579',
                source: 'plugin',
                requestId: '579',
                touched: true,
            })
    })

    it('falls back to the default handler signature when plugin arguments are empty', async () => {
        const emptyArgumentsPlugin = definePlugin({
            name: 'test-empty-arguments-plugin',
            setup ({ resolveArguments }) {
                resolveArguments(() => [])
            },
        })

        class EmptyArgumentsController {
            show (ctx: any, request: ClearRouterRequest) {
                return {
                    hasContext: Boolean(ctx.req),
                    id: request.param('id'),
                }
            }
        }

        Router.configure({
            container: {
                enabled: true,
            },
        })
        Router.use(emptyArgumentsPlugin)
        Router.get('/api/empty-plugin-arguments/:id', [EmptyArgumentsController, 'show'])

        await setupApp()

        await request(app)
            .get('/api/empty-plugin-arguments/246')
            .expect(200)
            .expect({ hasContext: true, id: '246' })
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

    it('lets static and dynamic route schemas coexist regardless of registration order', async () => {
        Router.get('/api/users/:id', ({ req, res }) => {
            res.json({ route: 'show', id: req.params.id })
        })

        Router.get('/api/users/books', ({ res }) => {
            res.json({ route: 'books' })
        })

        await setupApp()

        await request(app)
            .get('/api/users/books')
            .expect(200)
            .expect({ route: 'books' })

        await request(app)
            .get('/api/users/123')
            .expect(200)
            .expect({ route: 'show', id: '123' })
    })

    it('lets later routes overwrite the same method and path schema', async () => {
        Router.get('/api/overlap/:id', ({ req, res }) => {
            res.json({ route: 'first', id: req.params.id })
        })

        Router.get('/api/overlap/:id', ({ req, res }) => {
            res.json({ route: 'second', id: req.params.id })
        })

        await setupApp()

        expect(Router.allRoutes().filter(route => route.path === '/api/overlap/:id')).toHaveLength(1)

        await request(app)
            .get('/api/overlap/123')
            .expect(200)
            .expect({ route: 'second', id: '123' })
    })

    it('should create options route for non-OPTIONS method routes', async () => {
        Router.get('/peeps/:id', ({ res }) => res.send('Hello'))
        await setupApp()

        await request(app)
            .options('/peeps/123')
            .expect(204)
            .expect('allow', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
    })

    it('supports named routes and curly wrapped required parameters', async () => {
        const route = Router.get('/books/{book}', ({ req, res }) => {
            res.json({ book: req.params.book })
        }).name('books.show')

        await setupApp()

        expect(route.routeName).toBe('books.show')
        expect(Router.route('books.show')).toBe(route)
        expect(Router.url('books.show', { book: 123 })).toBe('/books/123')
        expect(Router.allRoutes('name')['books.show']).toBe(route)
        expect(route.path).toBe('/books/{book}')
        expect(route.registrationPaths).toEqual(['/books/:book'])
        expect(route.parameters).toEqual([
            { name: 'book', optional: false },
        ])

        await request(app)
            .get('/books/123')
            .expect(200)
            .expect({ book: '123' })
    })

    it('supports curly wrapped scoped and optional parameters', async () => {
        const scoped = Router.get('/profiles/{book:profile}', ({ req, res }) => {
            res.json({ book: req.params.book })
        }).name('books.profile')

        const optional = Router.get('/optional-books/{book?}', ({ req, res }) => {
            res.json({ book: req.params.book ?? null })
        }).name('books.optional')

        await setupApp()

        expect(scoped.parameters).toEqual([
            { name: 'book', field: 'profile', optional: false },
        ])
        expect(scoped.registrationPaths).toEqual(['/profiles/:book'])
        expect(Router.url('books.profile', { book: { profile: 'ada' } })).toBe('/profiles/ada')
        expect(optional.parameters).toEqual([
            { name: 'book', optional: true },
        ])
        expect(optional.registrationPaths).toEqual([
            '/optional-books',
            '/optional-books/:book',
        ])
        expect(Router.url('books.optional')).toBe('/optional-books')
        expect(Router.url('books.optional', { book: 456 })).toBe('/optional-books/456')

        await request(app)
            .get('/profiles/ada')
            .expect(200)
            .expect({ book: 'ada' })

        await request(app)
            .get('/optional-books')
            .expect(200)
            .expect({ book: null })

        await request(app)
            .get('/optional-books/456')
            .expect(200)
            .expect({ book: '456' })
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
