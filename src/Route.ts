import { Middleware as HMiddleware, Handler } from 'types/h3'
import { HttpMethod, RequestData } from 'types'

import { ClearRequest } from './ClearRequest'
import { Middleware as EMiddleware } from 'types/express'

export class Route<X = any, M = HMiddleware | EMiddleware> {
    ctx!: X
    body: RequestData = {}
    query: RequestData = {}
    params: RequestData = {}
    clearRequest!: ClearRequest

    methods: HttpMethod[]
    path: string
    handler: Handler
    middlewares: M[]

    constructor(
        methods: HttpMethod[],
        path: string,
        handler: Handler,
        middlewares: M[] = []
    ) {
        this.methods = methods
        this.path = path
        this.handler = handler
        this.middlewares = middlewares
    }
}