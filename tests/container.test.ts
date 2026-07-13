import {
    BindToken,
    Container,
    ContainerResolutionError,
    InjectionToken,
} from '../src/core/bindings'
import { beforeEach, describe, expect, it } from 'vitest'
import ExpressRouter from '../src/express/router'
import HonoRouter from '../src/hono/router'
import { definePlugin } from '../src/core/plugins'

describe('Container', () => {
    beforeEach(() => {
        Container.clear()
    })

    it('resolves structured providers and recursive constructor dependencies', async () => {
        const config = new InjectionToken<{ prefix: string }>('config')

        class Repository {
            static inject = [config]

            constructor(readonly options: { prefix: string }) { }
        }

        class AuditService {
            static inject = [Repository]

            constructor(readonly repository: Repository) { }
        }

        const container = new Container()
        container.bind(config, { useValue: { prefix: 'audit' } })
        container.bind(Repository, { useClass: Repository, scope: 'singleton' })
        container.bind(AuditService, { useClass: AuditService })

        const audit = await container.resolveOrFail(AuditService)
        const nextAudit = await container.resolveOrFail(AuditService)

        expect(audit.repository.options.prefix).toBe('audit')
        expect(audit).not.toBe(nextAudit)
        expect(audit.repository).toBe(nextAudit.repository)
    })

    it('supports aliases and request, singleton, and transient lifetimes', async () => {
        const alias = new InjectionToken<Service>('service-alias')
        let instances = 0

        class Service {
            readonly id = ++instances
        }

        class RequestService {
            readonly id = ++instances
        }

        class TransientService {
            readonly id = ++instances
        }

        const container = new Container()
        container.bind(Service, { useClass: Service, scope: 'singleton' })
        container.bind(alias, { useExisting: Service })
        container.bind(RequestService, { useClass: RequestService, scope: 'request' })
        container.bind(TransientService, { useClass: TransientService, scope: 'transient' })

        const firstRequest = container.createRequestScope({})
        const secondRequest = container.createRequestScope({})

        expect(await firstRequest.resolveOrFail(alias)).toBe(await secondRequest.resolveOrFail(Service))
        expect(await firstRequest.resolveOrFail(RequestService)).toBe(await firstRequest.resolveOrFail(RequestService))
        expect(await firstRequest.resolveOrFail(RequestService)).not.toBe(await secondRequest.resolveOrFail(RequestService))
        expect(await firstRequest.resolveOrFail(TransientService)).not.toBe(
            await firstRequest.resolveOrFail(TransientService)
        )
    })

    it('deduplicates concurrent scoped factories', async () => {
        class AsyncService { }
        let calls = 0

        const container = new Container()
        container.bind(AsyncService, {
            scope: 'singleton',
            async useFactory() {
                calls++
                await Promise.resolve()

                return new AsyncService()
            },
        })

        const [first, second] = await Promise.all([
            container.resolveOrFail(AsyncService),
            container.resolveOrFail(AsyncService),
        ])

        expect(first).toBe(second)
        expect(calls).toBe(1)
    })

    it('keeps the active container isolated across async request contexts', async () => {
        const requestId = new InjectionToken<string>('request-id')
        const container = new Container()
        container.bind(requestId, {
            scope: 'request',
            useFactory: ctx => ctx.id,
        })

        const resolveIn = (id: string) => {
            const scope = container.createRequestScope({ id })

            return Container.run(scope, async () => {
                await Promise.resolve()

                return Container.resolve(requestId)
            })
        }

        await expect(Promise.all([resolveIn('first'), resolveIn('second')]))
            .resolves.toEqual(['first', 'second'])
    })

    it('reports circular dependency resolution paths', async () => {
        class First {
            static inject: BindToken[] = []
        }

        class Second {
            static inject: BindToken[] = []
        }

        First.inject = [Second]
        Second.inject = [First]

        const container = new Container()
        container.bind(First, { useClass: First })
        container.bind(Second, { useClass: Second })

        await expect(container.resolveOrFail(First)).rejects.toEqual(
            expect.objectContaining<Partial<ContainerResolutionError>>({
                name: 'ContainerResolutionError',
                path: [First, Second, First],
            })
        )
    })

    it('installs named plugins and their bindings once per adapter', async () => {
        class AdapterService { }
        let setups = 0

        const plugin = definePlugin({
            name: 'adapter-scoped-container-test',
            setup({ bind }) {
                setups++
                bind(AdapterService, { useClass: AdapterService, scope: 'singleton' })
            },
        })

        await ExpressRouter.use(plugin)
        await ExpressRouter.use(plugin)
        await HonoRouter.use(plugin)

        expect(setups).toBe(2)
        expect(ExpressRouter.container.has(AdapterService)).toBe(true)
        expect(HonoRouter.container.has(AdapterService)).toBe(true)
    })
})
