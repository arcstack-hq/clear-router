import { beforeEach, describe, expect, it } from 'vitest'

import { H3 } from 'h3'
import { Hono } from 'hono'
import Koa from 'koa'
import KoaRouter from '@koa/router'
import fastify, { FastifyInstance } from 'fastify'
import request from 'parasito'

import H3Router from '../src/h3/router'
import HonoRouter from '../src/hono/router'
import KoaClearRouter from '../src/koa/router'
import FastifyRouter from '../src/fastify/router'

// Each adapter handler reads from the injected ClearRequest (2nd argument), whose
// params always carry the resolved domain/wildcard values regardless of adapter.
const defineRoutes = (Router: any): void => {
    Router.domain('{account}.example.com').group(() => {
        Router.get('/dashboard', (_ctx: any, req: any) => ({ account: req.params.account }))
    })
    Router.get('/users/{id}', (_ctx: any, req: any) => ({ id: req.params.id })).whereNumber('id')
    Router.get('/search/{search}', (_ctx: any, req: any) => ({ search: req.params.search })).where('search', '.*')
}

describe('Routing features across adapters', () => {
    describe('H3', () => {
        let app: H3
        beforeEach(() => {
            H3Router.reset()
            app = new H3()
            defineRoutes(H3Router)
            H3Router.apply(app)
        })

        it('domain param, constraint and wildcard', async () => {
            const dash = await request(app).get('/dashboard').set('Host', 'acme.example.com')
            expect(dash.body).toEqual({ account: 'acme' })
            expect((await request(app).get('/users/5')).body).toEqual({ id: '5' })
            expect((await request(app).get('/users/abc')).statusCode).toBe(404)
            expect((await request(app).get('/search/a/b/c')).body).toEqual({ search: 'a/b/c' })
        })
    })

    describe('Hono', () => {
        let app: Hono
        beforeEach(() => {
            HonoRouter.reset()
            app = new Hono()
            defineRoutes(HonoRouter)
            HonoRouter.apply(app as any)
        })

        it('domain param, constraint and wildcard', async () => {
            const dash = await request(app).get('/dashboard').set('Host', 'acme.example.com')
            expect(dash.body).toEqual({ account: 'acme' })
            expect((await request(app).get('/users/5')).body).toEqual({ id: '5' })
            expect((await request(app).get('/users/abc')).statusCode).toBe(404)
            expect((await request(app).get('/search/a/b/c')).body).toEqual({ search: 'a/b/c' })
        })
    })

    describe('Koa', () => {
        let app: Koa
        beforeEach(() => {
            KoaClearRouter.reset()
            app = new Koa()
            const router = new KoaRouter()
            defineRoutes(KoaClearRouter)
            KoaClearRouter.apply(router)
            app.use(router.routes())
        })

        it('domain param, constraint and wildcard', async () => {
            const dash = await request(app.callback()).get('/dashboard').set('Host', 'acme.example.com')
            expect(dash.body).toEqual({ account: 'acme' })
            expect((await request(app.callback()).get('/users/5')).body).toEqual({ id: '5' })
            expect((await request(app.callback()).get('/users/abc')).statusCode).toBe(404)
            expect((await request(app.callback()).get('/search/a/b/c')).body).toEqual({ search: 'a/b/c' })
        })
    })

    describe('Fastify', () => {
        let app: FastifyInstance
        beforeEach(async () => {
            FastifyRouter.reset()
            app = fastify()
            defineRoutes(FastifyRouter)
            FastifyRouter.apply(app)
            await app.ready()
        })

        const json = (res: { payload: string }): any => JSON.parse(res.payload)

        it('domain param, constraint and wildcard', async () => {
            const dash = await app.inject({ method: 'GET', url: '/dashboard', headers: { host: 'acme.example.com' } })
            expect(json(dash)).toEqual({ account: 'acme' })
            expect(json(await app.inject({ method: 'GET', url: '/users/5' }))).toEqual({ id: '5' })
            expect((await app.inject({ method: 'GET', url: '/users/abc' })).statusCode).toBe(404)
            expect(json(await app.inject({ method: 'GET', url: '/search/a/b/c' }))).toEqual({ search: 'a/b/c' })
        })
    })
})
