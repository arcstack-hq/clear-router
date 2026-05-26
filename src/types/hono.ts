import type { Context, HonoRequest, MiddlewareHandler } from 'hono'

import type { ClearHttpContext } from '../Contracts'
import type { ControllerHandler } from './basic'
import { Request as CoreRequest } from 'src/core/Request'
import { Response as CoreResponse } from 'src/core/Response'

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

export type Middleware = MiddlewareHandler

export type HonoApp = {
    [K in 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head']: (
        path: string,
        ...handlers: Middleware[]
    ) => any
}
