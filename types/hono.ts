import type { Context, HonoRequest, MiddlewareHandler } from 'hono'

import { Request as CoreRequest } from 'src/core/Request'
import { Response as CoreResponse } from 'src/core/Response'
import type { ControllerHandler } from './basic'

export type RequestWithGetBody = HonoRequest & {
    getBody: () => Record<string, any>
}

export type HttpContext = Context & {
    req: RequestWithGetBody
    clearRequest: CoreRequest
    clearResponse: CoreResponse
}

export type RouteHandler = (
    ctx: HttpContext,
    req: CoreRequest
) => any | Promise<any>

export type Handler = RouteHandler | ControllerHandler

export type NextFunction = () => Promise<void>

export type Middleware = MiddlewareHandler

export type HonoApp = {
    [K in 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head']: (
        path: string,
        ...handlers: Middleware[]
    ) => any
}
