export class Response {
    body: any
    headers = new Headers()
    sent = false
    statusCode = 200

    constructor(init?: Partial<Response>) {
        Object.assign(this, init)

        if (init?.headers && !(init.headers instanceof Headers)) {
            this.headers = new Headers(init.headers as any)
        }
    }

    status (code: number): this {
        this.statusCode = code

        return this
    }

    code (code: number): this {
        return this.status(code)
    }

    setHeader (name: string, value: string): this {
        this.headers.set(name, value)

        return this
    }

    header (name: string, value: string): this {
        return this.setHeader(name, value)
    }

    set (name: string, value: string): this {
        return this.setHeader(name, value)
    }

    type (contentType: string): this {
        return this.setHeader('Content-Type', contentType)
    }

    send (body?: any): this {
        this.body = body
        this.sent = true

        return this
    }

    json (body: any): this {
        return this
            .type('application/json; charset=utf-8')
            .send(body)
    }

    html (body: string): this {
        return this
            .type('text/html; charset=utf-8')
            .send(body)
    }

    text (body: string): this {
        return this
            .type('text/plain; charset=utf-8')
            .send(body)
    }

    noContent (): this {
        return this.status(204).send(null)
    }
}
