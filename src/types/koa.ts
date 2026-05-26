import type { ClearHttpContext } from '../Contracts'
import type { ControllerHandler } from './basic'
import { Request as CoreRequest } from 'src/core/Request'
import { Response as CoreResponse } from 'src/core/Response'
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

export type Middleware = Koa.Middleware<any, any>

export type KoaRouterApp = Router<any, any>
