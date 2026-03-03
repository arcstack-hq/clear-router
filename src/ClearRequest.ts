import { Middleware as EMiddleware } from 'types/express'
import { Middleware as HMiddleware } from 'types/h3'
import { RequestData } from 'types'
import { Route } from './Route'

export class ClearRequest<X = any, M = HMiddleware | EMiddleware> {
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