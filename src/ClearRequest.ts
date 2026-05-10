import { Middleware as EMiddleware } from 'types/express'
import { Middleware as FMiddleware } from 'types/fastify'
import { Middleware as HMiddleware } from 'types/h3'
import { Middleware as HNMiddleware } from 'types/hono'
import { Middleware as KMiddleware } from 'types/koa'
import { RequestData } from 'types'
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