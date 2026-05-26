import type { Middleware as EMiddleware } from './types/express'
import type { Middleware as FMiddleware } from './types/fastify'
import type { Middleware as HMiddleware } from './types/h3'
import type { Middleware as HNMiddleware } from './types/hono'
import type { Middleware as KMiddleware } from './types/koa'
import type { RequestData } from './types'
import type { Route } from './Route'

export class ClearRequest<
    X = any,
    M = HMiddleware | EMiddleware | FMiddleware | HNMiddleware | KMiddleware
> {
    [key: string]: any

    /**
     * @param body - Parsed request body
     */
    body!: RequestData

    /**
     * @param query - Parsed query parameters
     */
    query!: RequestData

    /**
     * @param params - Parsed route parameters
     */
    params!: RequestData

    route!: Route<X, M>

    constructor(init?: Partial<ClearRequest>) {
        Object.assign(this, init)
    }
}