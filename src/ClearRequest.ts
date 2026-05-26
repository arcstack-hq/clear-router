import { Middleware as EMiddleware } from 'src/types/express'
import { Middleware as FMiddleware } from 'src/types/fastify'
import { Middleware as HMiddleware } from 'src/types/h3'
import { Middleware as HNMiddleware } from 'src/types/hono'
import { Middleware as KMiddleware } from 'src/types/koa'
import { RequestData } from 'src/types'
import { Route } from './Route'

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