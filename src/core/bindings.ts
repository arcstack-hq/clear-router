import { Request } from './Request'
import { Response } from './Response'
import { AsyncLocalStorage } from 'node:async_hooks'

export type BindClass<T = any> = abstract new (...args: any[]) => T
export type BindToken<T = any> = BindClass<T> | InjectionToken<T> | symbol
export type BindFactory<T = any> = (ctx: any) => T | Promise<T>
export type BindingScope = 'singleton' | 'request' | 'transient'
export type BindingOptions = { scope?: BindingScope }
export type ValueProvider<T = any> = { useValue: T }
export type ClassProvider<T = any> = BindingOptions & {
    useClass: BindClass<T>
    dependencies?: BindToken[]
}
export type FactoryProvider<T = any> = BindingOptions & { useFactory: BindFactory<T> }
export type ExistingProvider<T = any> = { useExisting: BindToken<T> }
export type BindProvider<T = any> =
    | ValueProvider<T>
    | ClassProvider<T>
    | FactoryProvider<T>
    | ExistingProvider<T>
export type BindValue<T = any> = T | BindFactory<T> | BindClass<T> | BindProvider<T>
export type BindDecorator = MethodDecorator & ClassDecorator & {
    <This, Value extends (this: This, ...args: any[]) => any>(
        value: Value,
        context: ClassMethodDecoratorContext<This, Value>
    ): void | Value
    <Value extends abstract new (...args: any[]) => any>(
        value: Value,
        context: ClassDecoratorContext<Value>
    ): void | Value
}

type BindingMetadata = {
    tokens?: BindToken[]
    method?: PropertyKey
}

const metadataKey = Symbol.for('clear-router:binding-metadata')
const bindings = new WeakMap<object, Map<PropertyKey, BindingMetadata>>()

type NormalizedProvider<T = any> = BindProvider<T> & BindingOptions
type ResolutionState = { autoDiscover: boolean, stack: BindToken[] }

export class InjectionToken<T = any> {
    declare readonly __type?: T
    readonly key: symbol

    constructor(readonly description: string) {
        this.key = Symbol(description)
    }

    toString(): string {
        return `InjectionToken(${this.description})`
    }
}

export class ContainerResolutionError extends Error {
    constructor(message: string, readonly path: BindToken[]) {
        super(`${message}\nResolution path: ${path.map(describeToken).join(' -> ')}`)
        this.name = 'ContainerResolutionError'
    }
}

export class Container {
    private static readonly activeScope = new AsyncLocalStorage<Container>()
    private static readonly containers = new Set<Container>()
    private static readonly globalContainer = new Container()

    private readonly registry = new Map<BindToken, NormalizedProvider>()
    private readonly instances = new Map<BindToken, any>()
    private readonly pending = new Map<BindToken, Promise<any>>()

    constructor(
        readonly parent?: Container,
        private readonly context?: any,
        private readonly requestScope = false,
    ) { }

    static get global(): Container {
        return this.globalContainer
    }

    static current(): Container {
        return this.activeScope.getStore() ?? this.globalContainer
    }

    static run<T>(container: Container, callback: () => T): T {
        return this.activeScope.run(container, callback)
    }

    static create(parent: Container = this.globalContainer): Container {
        const container = new Container(parent)
        this.containers.add(container)

        return container
    }

    createRequestScope(ctx: any): Container {
        return new Container(this, ctx, true)
    }

    static bind<T>(token: BindToken<T>, value: BindValue<T>, options?: BindingOptions): void {
        this.globalContainer.bind(token, value, options)
    }

    static unbind<T>(token: BindToken<T>): void {
        this.globalContainer.unbind(token)
    }

    static clear(): void {
        this.globalContainer.clear()
        for (const container of this.containers) container.clear()
    }

    static has<T>(token: BindToken<T>): boolean {
        return this.current().has(token)
    }

    static bindings<V = any>(): Record<string, BindValue<V>> {
        return this.current().bindings()
    }

    static async resolve<T>(token: BindToken<T>, ctx?: any, autoDiscover = false): Promise<T | undefined> {
        return this.current().resolve(token, ctx, autoDiscover)
    }

    bind<T>(token: BindToken<T>, value: BindValue<T>, options?: BindingOptions): void {
        this.registry.set(token, normalizeProvider(value, options))
        this.instances.delete(token)
    }

    unbind<T>(token: BindToken<T>): void {
        this.registry.delete(token)
        this.instances.delete(token)
    }

    clear(): void {
        this.registry.clear()
        this.instances.clear()
        this.pending.clear()
    }

    has<T>(token: BindToken<T>): boolean {
        return Boolean(this.findProvider(token))
    }

    entries(): ReadonlyMap<BindToken, BindProvider> {
        const entries = new Map<BindToken, BindProvider>()
        for (const container of this.lineage().reverse()) {
            for (const [token, provider] of container.registry) entries.set(token, provider)
        }

        return entries
    }

    bindings<V = any>(): Record<string, BindValue<V>> {
        return Object.fromEntries(
            Array.from(this.entries(), ([token, provider]) => [describeToken(token), provider])
        ) as Record<string, BindValue<V>>
    }

    async resolve<T>(token: BindToken<T>, ctx = this.context, autoDiscover = false): Promise<T | undefined> {
        return this.resolveToken(token, ctx, { autoDiscover, stack: [] })
    }

    async resolveOrFail<T>(token: BindToken<T>, ctx = this.context, autoDiscover = false): Promise<T> {
        const resolved = await this.resolve(token, ctx, autoDiscover)
        if (typeof resolved === 'undefined') {
            throw new ContainerResolutionError(`Cannot resolve ${describeToken(token)}`, [token])
        }

        return resolved
    }

    private async resolveToken<T>(token: BindToken<T>, ctx: any, state: ResolutionState): Promise<T | undefined> {
        if ((token as unknown) === Request) return ctx?.clearRequest
        if ((token as unknown) === Response) return ctx?.clearResponse

        if (state.stack.includes(token)) {
            throw new ContainerResolutionError(
                `Circular dependency detected while resolving ${describeToken(token)}`,
                [...state.stack, token],
            )
        }

        const nextState = { ...state, stack: [...state.stack, token] }
        const found = this.findProvider(token)
        if (found) return this.resolveProvider(found.token, found.provider, found.owner, ctx, nextState)

        if (state.autoDiscover && typeof token === 'function') {
            return this.instantiate(token, undefined, ctx, nextState)
        }

        return undefined
    }

    private findProvider<T>(token: BindToken<T>): {
        token: BindToken<T>,
        provider: NormalizedProvider<T>,
        owner: Container
    } | undefined {
        if (this.registry.has(token)) {
            return {
                token,
                provider: this.registry.get(token) as NormalizedProvider<T>,
                owner: this,
            }
        }

        const equivalent = this.findEquivalentToken(token)
        if (equivalent) {
            return {
                token: equivalent as BindToken<T>,
                provider: this.registry.get(equivalent) as NormalizedProvider<T>,
                owner: this,
            }
        }

        return this.parent?.findProvider(token)
    }

    private async resolveProvider<T>(
        token: BindToken<T>,
        provider: NormalizedProvider<T>,
        owner: Container,
        ctx: any,
        state: ResolutionState,
    ): Promise<T | undefined> {
        if ('useExisting' in provider) return this.resolveToken(provider.useExisting, ctx, state)

        const cache = provider.scope === 'singleton'
            ? owner
            : provider.scope === 'request'
                ? this.findRequestScope()
                : undefined

        if (cache?.instances.has(token)) return cache.instances.get(token)
        if (cache?.pending.has(token)) return cache.pending.get(token)

        const create = async (): Promise<T | undefined> => {
            if ('useValue' in provider) return provider.useValue
            if ('useClass' in provider) {
                return this.instantiate(provider.useClass, provider.dependencies, ctx, state)
            }

            return provider.useFactory(ctx)
        }

        if (!cache) return create()

        const promise = create()
        cache.pending.set(token, promise)

        try {
            const resolved = await promise
            if (typeof resolved !== 'undefined') cache.instances.set(token, resolved)

            return resolved
        } finally {
            cache.pending.delete(token)
        }
    }

    private async instantiate<T>(
        Type: BindClass<T>,
        dependencies: BindToken[] | undefined,
        ctx: any,
        state: ResolutionState,
    ): Promise<T> {
        const tokens = dependencies ?? getInjectTokens(Type)
        const args = []

        for (const dependency of tokens) {
            const resolved = await this.resolveToken(dependency, ctx, state)
            if (typeof resolved === 'undefined') {
                throw new ContainerResolutionError(
                    `Cannot resolve ${describeToken(dependency)} required by ${describeToken(Type)}`,
                    [...state.stack, dependency],
                )
            }
            args.push(resolved)
        }

        return new (Type as new (...args: any[]) => T)(...args)
    }

    private findRequestScope(): Container | undefined {
        if (this.requestScope) return this

        return this.parent?.findRequestScope()
    }

    private lineage(): Container[] {
        return [this, ...(this.parent?.lineage() ?? [])]
    }

    private findEquivalentToken<T>(token: BindToken<T>): BindToken | undefined {
        if (typeof token !== 'function') return undefined
        const name = token.name
        if (!name) return undefined

        const tokenParent = Object.getPrototypeOf(token)
        const tokenProps = this.getComparableStaticProps(token)

        for (const registered of this.registry.keys()) {
            if (typeof registered !== 'function' || registered === token || registered.name !== name) continue

            const registeredParent = Object.getPrototypeOf(registered)
            if (tokenParent && registeredParent && tokenParent.name !== registeredParent.name) continue

            const registeredProps = this.getComparableStaticProps(registered)
            if (this.staticPropsMatch(token, registered, tokenProps, registeredProps)) return registered
        }
    }

    private getComparableStaticProps(token: BindClass): string[] {
        return Object.getOwnPropertyNames(token).filter((prop) => {
            return !['length', 'name', 'prototype', 'arguments', 'caller'].includes(prop)
        })
    }

    private staticPropsMatch(
        token: BindClass,
        registered: BindClass,
        tokenProps: string[],
        registeredProps: string[],
    ): boolean {
        if (tokenProps.length !== registeredProps.length) return false

        for (const prop of tokenProps) {
            if (!registeredProps.includes(prop) || Reflect.get(token, prop) !== Reflect.get(registered, prop)) {
                return false
            }
        }

        return true
    }
}

function normalizeProvider<T>(value: BindValue<T>, options?: BindingOptions): NormalizedProvider<T> {
    if (isProvider(value)) return { scope: 'transient', ...value }
    if (isClass(value)) return { useClass: value as BindClass<T>, scope: options?.scope ?? 'transient' }
    if (typeof value === 'function') {
        return { useFactory: value as BindFactory<T>, scope: options?.scope ?? 'transient' }
    }

    return { useValue: value }
}

function isProvider<T>(value: BindValue<T>): value is BindProvider<T> {
    return Boolean(
        value && typeof value === 'object' &&
        ('useValue' in value || 'useClass' in value || 'useFactory' in value || 'useExisting' in value)
    )
}

function getInjectTokens(Type: BindClass): BindToken[] {
    const inject = (Type as BindClass & { inject?: BindToken[] }).inject

    return inject ?? getDesignParamTypes(Type)
}

function describeToken(token: BindToken): string {
    if (token instanceof InjectionToken) return token.toString()
    if (typeof token === 'symbol') return token.description ?? token.toString()

    return token.name || '<anonymous class>'
}

export function Bind(...tokens: BindToken[]): BindDecorator {
    return ((target: object, propertyKeyOrContext?: PropertyKey | ClassMethodDecoratorContext | ClassDecoratorContext) => {
        if (isStandardClassContext(propertyKeyOrContext)) {
            setClassBindingMetadata(target, tokens)
            setStandardMetadata(propertyKeyOrContext.metadata, '__class__', { tokens })

            return
        }

        if (isStandardMethodContext(propertyKeyOrContext)) {
            const method = propertyKeyOrContext.name
            const metadata = { tokens, method }

            setBindingMetadata(target, '__route_handler__', metadata)
            setStandardMetadata(propertyKeyOrContext.metadata, method, metadata)

            return
        }

        if (typeof propertyKeyOrContext === 'undefined') {
            setClassBindingMetadata(target, tokens)

            return
        }

        setBindingMetadata(target, propertyKeyOrContext, { tokens, method: propertyKeyOrContext })
    }) as BindDecorator
}

export function getMetadataKey(): symbol {
    return metadataKey
}

export function getStandardMetadata(
    metadata: object | undefined,
    propertyKey?: PropertyKey
): BindingMetadata | undefined {
    const store = metadata && (metadata as Record<symbol, Record<PropertyKey, BindingMetadata>>)[metadataKey]
    if (!store) return undefined

    return propertyKey ? store[propertyKey] : undefined
}

export function setStandardMetadata(
    metadata: object | undefined,
    propertyKey: PropertyKey,
    value: BindingMetadata
): void {
    if (!metadata) return

    const record = metadata as Record<symbol, Record<PropertyKey, BindingMetadata>>
    record[metadataKey] = record[metadataKey] ?? {}
    record[metadataKey][propertyKey] = value
}

function isStandardMethodContext(value: any): value is ClassMethodDecoratorContext {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.kind === 'method' &&
        typeof value.name !== 'undefined'
    )
}

function isStandardClassContext(value: any): value is ClassDecoratorContext {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.kind === 'class' &&
        typeof value.name !== 'undefined'
    )
}

function setClassBindingMetadata(target: object, tokens: BindToken[]): void {
    setBindingMetadata(target, '__class__', { tokens })

    const prototype = (target as { prototype?: object }).prototype
    if (prototype) {
        setBindingMetadata(prototype, '__class__', { tokens })
    }
}

export function getBindingMetadataFromTargets(
    targets: Array<{ target?: object, propertyKey?: PropertyKey }>
): BindingMetadata | undefined {
    for (const { target, propertyKey } of targets) {
        if (!target) continue

        const metadata = getBindingMetadata(target, propertyKey)
        if (metadata) return metadata

        const standardMetadata = getStandardMetadata(
            (target as Record<PropertyKey, any>)[(Symbol as any).metadata],
            propertyKey
        )
        if (standardMetadata) return standardMetadata
    }
}

export function getBindingMetadata(
    target: object,
    propertyKey?: PropertyKey
): BindingMetadata | undefined {
    if (propertyKey) return bindings.get(target)?.get(propertyKey)

    return bindings.get(target)?.get('__route_handler__')
}

export function setBindingMetadata(
    target: object,
    propertyKey: PropertyKey,
    metadata: BindingMetadata
): void {
    const map = bindings.get(target) ?? new Map<PropertyKey, BindingMetadata>()
    map.set(propertyKey, metadata)
    bindings.set(target, map)
}

export function getDesignParamTypes(target: object, propertyKey?: PropertyKey): BindToken[] {
    const reflect = Reflect as typeof Reflect & {
        getMetadata?: (key: string, target: object, propertyKey?: PropertyKey) => BindToken[] | undefined
    }

    return reflect.getMetadata?.('design:paramtypes', target, propertyKey) ?? []
}

export function isClass(value: any): boolean {
    return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value))
}
