import { ClearRequest } from 'src/ClearRequest'

import type { HttpMethod, RequestData } from 'types/basic'
import type { Route } from 'src/Route'

export class Request<X = any, M = any> extends ClearRequest<X, M> {
    original?: any
    method = 'GET'
    path = '/'
    url = '/'
    headers: Headers | Record<string, any> = {}

    constructor(init?: Partial<Request<X, M>> & {
        body?: RequestData
        query?: RequestData
        params?: RequestData
        route?: Route<X, M>
    }) {
        super(init as any)
        Object.assign(this, init)
    }

    getBody (): RequestData {
        return this.body ?? {}
    }

    header (name: string): string {
        if (typeof (this.headers as Headers).get === 'function') {
            return (this.headers as Headers).get(name) || ''
        }

        const headers = this.headers as Record<string, any>
        const value = headers[name] ?? headers[name.toLowerCase()]

        return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
    }

    param (name: string): any {
        return this.params?.[name]
    }

    input (name: string): any {
        return this.body?.[name] ?? this.query?.[name] ?? this.params?.[name]
    }

    is (method: HttpMethod | string): boolean {
        return this.method.toLowerCase() === String(method).toLowerCase()
    }
}
