import type { ClearHttpContext, ControllerHandler } from './basic'
import type { Context, HonoRequest, MiddlewareHandler } from 'hono'

import { Request as CoreRequest } from 'src/core/Request'
import { Response as CoreResponse } from 'src/core/Response'

export type RequestWithGetBody = HonoRequest & {
    getBody: () => Record<string, any>
}

type MergedHttpContext = ClearHttpContext & Context

export interface HttpContext extends MergedHttpContext {
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
