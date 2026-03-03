import '../example/h3/web'

import { beforeAll, describe, expect, it } from 'vitest'

import { H3 } from 'h3'
import { H3App } from 'types/h3'
import Router from '../src/h3/router'

describe('H3 App (JS)', () => {
    let app: H3
    let router: H3App

    beforeAll(() => {
        app = new H3()

        router = Router.apply(app)
    })

    it('GET / should return 200', async () => {
        const res = await router.fetch(new Request(new URL('http://localhost/directly')))
        expect(res.status).toBe(200)
        expect(await res.text()).toBeDefined()
    })
})
