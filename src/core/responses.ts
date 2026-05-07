import type { HttpMethod } from 'types/basic'

type HeaderSource = Record<string, any> | Headers | undefined

export type ResponseMeta = {
    body: any
    status: number
    contentType?: string
    isEmpty: boolean
    isNativeResponse: boolean
}

export function isFetchResponse (value: any): value is Response {
    return typeof Response !== 'undefined' && value instanceof Response
}

export function isH3Response (value: any): boolean {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.constructor?.name === 'HTTPResponse'
    )
}

export function responseWasSent (target: any): boolean {
    return Boolean(target?.headersSent || target?.sent || target?.raw?.headersSent)
}

export function getHeader (headers: HeaderSource, name: string): string {
    if (!headers) return ''

    if (headers instanceof Headers) {
        return headers.get(name) || ''
    }

    const lowerName = name.toLowerCase()
    const value = headers[name] ?? headers[lowerName]

    return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

export function isApiRequest (headers: HeaderSource, path?: string): boolean {
    const accept = getHeader(headers, 'accept').toLowerCase()
    const requestedWith = getHeader(headers, 'x-requested-with').toLowerCase()

    return Boolean(
        requestedWith === 'xmlhttprequest' ||
        accept.includes('application/json') ||
        (accept.includes('application/xml') &&
            !accept.includes('application/xhtml') &&
            !accept.includes('text/html')
        ) ||
        path?.startsWith('/api/')
    )
}

export function resolveResponseMeta (
    value: any,
    options: {
        headers?: HeaderSource
        method?: HttpMethod | string
        path?: string
        status?: number
    } = {}
): ResponseMeta | undefined {
    if (typeof value === 'undefined') return undefined

    if (isFetchResponse(value) || isH3Response(value)) {
        return {
            body: value,
            status: getStatus(value, options.method, options.status),
            isEmpty: false,
            isNativeResponse: true,
        }
    }

    const method = String(options.method || 'get').toLowerCase()
    const status = getStatus(value, method, options.status)

    if (value === null) {
        return {
            body: null,
            status,
            isEmpty: true,
            isNativeResponse: false,
        }
    }

    if (typeof value === 'string') {
        return {
            body: value,
            status,
            contentType: inferStringContentType(value, isApiRequest(options.headers, options.path)),
            isEmpty: false,
            isNativeResponse: false,
        }
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return {
            body: String(value),
            status,
            contentType: 'text/plain; charset=utf-8',
            isEmpty: false,
            isNativeResponse: false,
        }
    }

    return {
        body: value,
        status,
        contentType: 'application/json; charset=utf-8',
        isEmpty: false,
        isNativeResponse: false,
    }
}

function getStatus (value: any, method?: string, explicitStatus?: number): number {
    if (typeof value?.status === 'number' && value.status >= 100 && value.status <= 999) {
        return value.status
    }

    if (typeof explicitStatus === 'number' && explicitStatus >= 100 && explicitStatus <= 999) {
        return explicitStatus
    }

    return String(method || '').toLowerCase() === 'post' ? 201 : 200
}

function inferStringContentType (value: string, apiRequest: boolean): string {
    if (apiRequest) return 'text/plain; charset=utf-8'

    const trimmed = value.trimStart().toLowerCase()
    if (
        trimmed.startsWith('<!doctype html') ||
        trimmed.startsWith('<html') ||
        trimmed.startsWith('<')
    ) {
        return 'text/html; charset=utf-8'
    }

    return 'text/plain; charset=utf-8'
}
