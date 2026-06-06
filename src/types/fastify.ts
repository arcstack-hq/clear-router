import type { ClassMiddleware, ControllerHandler, MiddlewareHandle } from './basic'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import type { ClearHttpContext } from '../Contracts'
import type { Request as CoreRequest } from '../core/Request'
import type { Response as CoreResponse } from '../core/Response'

export interface RequestWithGetBody extends FastifyRequest {
    getBody: () => Record<string, any>
}

export interface HttpContext extends ClearHttpContext {
    req: RequestWithGetBody
    reply: FastifyReply
    clearRequest: CoreRequest
    clearResponse: CoreResponse
}

export type RouteHandler = (
    ctx: HttpContext,
    req: CoreRequest
) => any | Promise<any>

export type Handler<T = any> = RouteHandler | ControllerHandler<T>

export type NextFunction = (err?: Error) => void

export type MiddlewareFunction = MiddlewareHandle<[
    req: RequestWithGetBody,
    reply: FastifyReply,
    next: NextFunction
]>

export type Middleware = MiddlewareFunction | ClassMiddleware<MiddlewareFunction>

export type FastifyApp = FastifyInstance
