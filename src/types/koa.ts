import type { ClearHttpContext } from '../Contracts'
import type { ClassMiddleware, ControllerHandler } from './basic'
import type { Request as CoreRequest } from '../core/Request'
import type { Response as CoreResponse } from '../core/Response'
import type Koa from 'koa'
import type Router from '@koa/router'

export interface RequestWithGetBody extends Koa.Request {
    getBody: () => Record<string, any>
    body?: any
}

export interface HttpContext extends Koa.Context, ClearHttpContext {
    request: RequestWithGetBody
    clearRequest: CoreRequest
    clearResponse: CoreResponse
    params: Record<string, any>
    query: Record<string, any>
}

export type RouteHandler = (
    ctx: HttpContext,
    req: CoreRequest
) => any | Promise<any>

export type Handler = RouteHandler | ControllerHandler

export type NextFunction = Koa.Next

export type MiddlewareFunction = Koa.Middleware<any, any>

export type Middleware = MiddlewareFunction | ClassMiddleware<MiddlewareFunction>

export type KoaRouterApp = Router<any, any>
