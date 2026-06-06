import type { ClassMiddleware, ControllerHandler } from './basic'

import type { ClearHttpContext } from '../Contracts'
import type { Request as CoreRequest } from '../core/Request'
import type { Response as CoreResponse } from '../core/Response'
import type Koa from 'koa'
import type Router from '@koa/router'

interface RequestWithGetBody extends Koa.Request {
    getBody: () => Record<string, any>
    body?: any
}

interface HttpContext extends Koa.Context, ClearHttpContext {
    request: RequestWithGetBody
    clearRequest: CoreRequest
    clearResponse: CoreResponse
    params: Record<string, any>
    query: Record<string, any>
}

type RouteHandler = (
    ctx: HttpContext,
    req: CoreRequest
) => any | Promise<any>

type Handler<T = any> = RouteHandler | ControllerHandler<T>

type NextFunction = Koa.Next

type MiddlewareFunction = Koa.Middleware<any, any>

type Middleware = MiddlewareFunction | ClassMiddleware<MiddlewareFunction>

type KoaRouterApp = Router<any, any>

export { KoaRouterApp, Middleware, NextFunction, Handler, RouteHandler, HttpContext, RequestWithGetBody }
