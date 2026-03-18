import { HttpMethod, RequestData } from 'types'

import { ClearRequest } from './ClearRequest'
import { Middleware as EMiddleware } from 'types/express'
import { Middleware as HMiddleware } from 'types/h3'

export class Route<X = any, M = HMiddleware | EMiddleware, H = any> {
    ctx!: X
    body: RequestData = {}
    query: RequestData = {}
    params: RequestData = {}
    clearRequest!: ClearRequest

    methods: HttpMethod[]
    path: string
    handler: H
    middlewares: M[]
    controllerName?: string
    actionName?: string
    handlerType: 'function' | 'controller'
    middlewareCount: number

    constructor(
        methods: HttpMethod[],
        path: string,
        handler: H,
        middlewares: M[] = []
    ) {
        this.methods = methods
        this.path = path
        this.handler = handler
        this.middlewares = middlewares
        this.handlerType = Array.isArray(handler) ? 'controller' : 'function'
        this.middlewareCount = middlewares.length
        this.controllerName = Array.isArray(handler) ? handler[0]?.name : undefined
        this.actionName = Array.isArray(handler) ? handler[1] : typeof handler === 'function' ? handler.constructor.name ?? handler.name : undefined
    }
}