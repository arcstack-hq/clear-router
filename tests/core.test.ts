import { Request, Response } from 'src'
import { beforeEach, describe, expect, it } from 'vitest'
import express, { Router as ExRouter } from 'express'

import { CoreRouter } from 'src/core/router'
import Router from '../src/express/router'
import request from 'parasito'

class SharedRouterA extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:test-shared'
}

class SharedRouterB extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:test-shared'
}

class IsolatedRouter extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:test-isolated'
}

describe('Core Router Shared State', () => {
    beforeEach(() => {
        SharedRouterA.routes = []
        SharedRouterA.routesByPathMethod = {}
        SharedRouterA.routesByMethod = {}
        SharedRouterA.prefix = ''
        SharedRouterA.groupMiddlewares = []
        SharedRouterA.globalMiddlewares = []

        IsolatedRouter.routes = []
        IsolatedRouter.routesByPathMethod = {}
        IsolatedRouter.routesByMethod = {}
        IsolatedRouter.prefix = ''
        IsolatedRouter.groupMiddlewares = []
        IsolatedRouter.globalMiddlewares = []
    })

    it('shares route state across routers with same namespace', () => {
        SharedRouterA.get('/shared-route', () => 'ok')

        const routesA = SharedRouterA.allRoutes()
        const routesB = SharedRouterB.allRoutes()

        expect(routesA).toHaveLength(1)
        expect(routesB).toHaveLength(1)
        expect(routesB[0].path).toBe('/shared-route')
    })

    it('keeps route state isolated across different namespaces', () => {
        SharedRouterA.get('/shared-route', () => 'ok')
        IsolatedRouter.get('/isolated-route', () => 'ok')

        expect(SharedRouterA.allRoutes()).toHaveLength(1)
        expect(SharedRouterA.allRoutes()[0].path).toBe('/shared-route')
        expect(IsolatedRouter.allRoutes()).toHaveLength(1)
        expect(IsolatedRouter.allRoutes()[0].path).toBe('/isolated-route')
    })
})

describe('Core Request and Reponse', () => {
    let app: express.Application
    let router: ExRouter

    beforeEach(() => {
        app = express()
        router = ExRouter()
        app.use(express.json())
    })

    const setupApp = async (): Promise<void> => {
        Router.apply(router)
        app.use(router)
    }

    it('can overwrite and set a custom Request provider', async () => {
        class CustomRequest extends Request {
            customBinding = 'successfull'
        }

        Router.setClearRequestProvider(CustomRequest)

        Router.get('/health', ({ clearRequest }) => {
            return {
                pass: clearRequest instanceof CustomRequest,
                binding: clearRequest.customBinding,
            }
        })

        await setupApp()
        await request(app).get('/health').expect(200).expect({
            pass: true,
            binding: 'successfull'
        })
    })

    it('can overwrite and set a custom Response provider', async () => {
        class CustomResponse extends Response {
            customBinding = 'successfull'
        }

        Router.setClearResponseProvider(CustomResponse)

        Router.get('/health', ({ clearResponse }) => {
            return {
                pass: clearResponse instanceof CustomResponse,
                binding: clearResponse.customBinding,
            }
        })

        await setupApp()
        await request(app).get('/health').expect(200).expect({
            pass: true,
            binding: 'successfull'
        })
    })
})