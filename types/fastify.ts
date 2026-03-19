import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'

import { ClearRequest } from 'src/ClearRequest'
import type { ControllerHandler } from './basic'

export interface RequestWithGetBody extends FastifyRequest {
    getBody: () => Record<string, any>
}

export interface HttpContext {
    req: RequestWithGetBody
    reply: FastifyReply
}

export type RouteHandler = (
    ctx: HttpContext,
    req: ClearRequest
) => any | Promise<any>

export type Handler = RouteHandler | ControllerHandler

export type NextFunction = (err?: Error) => void

export type Middleware = (
    req: RequestWithGetBody,
    reply: FastifyReply,
    next: NextFunction
) => any | Promise<any>

export type FastifyApp = FastifyInstance
