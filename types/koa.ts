import type Koa from 'koa'
import type Router from '@koa/router'

import { ClearRequest } from 'src/ClearRequest'
import type { ControllerHandler } from './basic'

export interface RequestWithGetBody extends Koa.Request {
    getBody: () => Record<string, any>
    body?: any
}

export interface HttpContext extends Koa.Context {
    request: RequestWithGetBody
    params: Record<string, any>
    query: Record<string, any>
}

export type RouteHandler = (
    ctx: HttpContext,
    req: ClearRequest
) => any | Promise<any>

export type Handler = RouteHandler | ControllerHandler

export type NextFunction = Koa.Next

export type Middleware = Koa.Middleware<any, any>

export type KoaRouterApp = Router<any, any>
