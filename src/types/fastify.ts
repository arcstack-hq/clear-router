import type { ClearHttpContext, ControllerHandler } from './basic'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { Request as CoreRequest } from 'src/core/Request'
import { Response as CoreResponse } from 'src/core/Response'

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

export type Handler = RouteHandler | ControllerHandler

export type NextFunction = (err?: Error) => void

export type Middleware = (
    req: RequestWithGetBody,
    reply: FastifyReply,
    next: NextFunction
) => any | Promise<any>

export type FastifyApp = FastifyInstance
