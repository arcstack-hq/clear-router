import type { Context, HonoRequest, MiddlewareHandler } from 'hono'

import type { ClearHttpContext } from '../Contracts'
import type { ClassMiddleware, ControllerHandler } from './basic'
import type { Request as CoreRequest } from '../core/Request'
import type { Response as CoreResponse } from '../core/Response'

export type RequestWithGetBody = HonoRequest & {
    getBody: () => Record<string, any>
}

export interface HttpContext extends Context, ClearHttpContext {
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

export type MiddlewareFunction = MiddlewareHandler

export type Middleware = MiddlewareFunction | ClassMiddleware<MiddlewareFunction>

export type HonoApp = {
    [K in 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head']: (
        path: string,
        ...handlers: MiddlewareFunction[]
    ) => any
}
