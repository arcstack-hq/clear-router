import { Request } from './Request'
import { Response } from './Response'

export type BindToken<T = any> = abstract new (...args: any[]) => T
export type BindFactory<T = any> = (ctx: any) => T | Promise<T>
export type BindValue<T = any> = T | BindFactory<T> | BindToken<T>
export type BindDecorator = MethodDecorator & ClassDecorator & {
    <This, Value extends (this: This, ...args: any[]) => any> (
        value: Value,
        context: ClassMethodDecoratorContext<This, Value>
    ): void | Value
    <Value extends abstract new (...args: any[]) => any> (
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

export class Container {
    private static readonly registry = new Map<BindToken, BindValue>()

    static bind<T> (token: BindToken<T>, value: BindValue<T>): void {
        this.registry.set(token, value)
    }

    static unbind<T> (token: BindToken<T>): void {
        this.registry.delete(token)
    }

    static clear (): void {
        this.registry.clear()
    }

    static has<T> (token: BindToken<T>): boolean {
        return this.registry.has(token) || Boolean(this.findEquivalentToken(token))
    }

    static bindings<V = any> (): Record<string, BindValue<V>> {
        return Object.fromEntries(this.registry.entries())
    }

    static async resolve<T> (token: BindToken<T>, ctx: any, autoDiscover = false): Promise<T | undefined> {
        if ((token as any) === Request) return ctx.clearRequest
        if ((token as any) === Response) return ctx.clearResponse

        const binding = this.getBinding(token)
        if (binding) {
            return this.resolveBinding(binding, ctx, autoDiscover)
        }

        if (autoDiscover && typeof token === 'function') {
            return new (token as new () => T)()
        }

        return undefined
    }

    private static getBinding<T> (token: BindToken<T>): BindValue<T> | undefined {
        if (this.registry.has(token)) {
            return this.registry.get(token) as BindValue<T> | undefined
        }

        const equivalent = this.findEquivalentToken(token)

        return equivalent
            ? this.registry.get(equivalent) as BindValue<T> | undefined
            : undefined
    }

    private static findEquivalentToken<T> (token: BindToken<T>): BindToken | undefined {
        const name = token.name

        if (!name) {
            return undefined
        }

        const tokenParent = Object.getPrototypeOf(token)
        const tokenProps = this.getComparableStaticProps(token)

        for (const registered of this.registry.keys()) {
            if (registered === token) {
                continue
            }

            if (registered.name !== name) {
                continue
            }

            const registeredParent = Object.getPrototypeOf(registered)

            if (tokenParent && registeredParent && tokenParent.name !== registeredParent.name) {
                continue
            }

            const registeredProps = this.getComparableStaticProps(registered)

            if (!this.staticPropsMatch(token, registered, tokenProps, registeredProps)) {
                continue
            }

            return registered
        }

        return undefined
    }

    private static getComparableStaticProps (token: BindToken): string[] {
        return Object.getOwnPropertyNames(token).filter((prop) => {
            return ![
                'length',
                'name',
                'prototype',
                'arguments',
                'caller',
            ].includes(prop)
        })
    }

    private static staticPropsMatch (
        token: BindToken,
        registered: BindToken,
        tokenProps: string[],
        registeredProps: string[],
    ): boolean {
        if (tokenProps.length !== registeredProps.length) {
            return false
        }
        console.log(token, registered)

        for (const prop of tokenProps) {
            if (!registeredProps.includes(prop)) {
                return false
            }

            const tokenValue = Reflect.get(token, prop)
            const registeredValue = Reflect.get(registered, prop)

            if (tokenValue !== registeredValue) {
                return false
            }
        }

        return true
    }

    private static async resolveBinding<T> (
        binding: BindValue<T> | undefined,
        ctx: any,
        autoDiscover: boolean
    ): Promise<T | undefined> {
        if (!binding) return undefined

        if (typeof binding !== 'function') return binding

        if (isClass(binding)) {
            return new (binding as new () => T)()
        }

        const resolved = await (binding as BindFactory<T>)(ctx)
        if (typeof resolved === 'function' && autoDiscover && isClass(resolved)) {
            return new (resolved as new () => T)()
        }

        return resolved
    }
}

export function Bind (...tokens: BindToken[]): BindDecorator {
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

export function getMetadataKey (): symbol {
    return metadataKey
}

export function getStandardMetadata (
    metadata: object | undefined,
    propertyKey?: PropertyKey
): BindingMetadata | undefined {
    const store = metadata && (metadata as Record<symbol, Record<PropertyKey, BindingMetadata>>)[metadataKey]
    if (!store) return undefined

    return propertyKey ? store[propertyKey] : undefined
}

export function setStandardMetadata (
    metadata: object | undefined,
    propertyKey: PropertyKey,
    value: BindingMetadata
): void {
    if (!metadata) return

    const record = metadata as Record<symbol, Record<PropertyKey, BindingMetadata>>
    record[metadataKey] = record[metadataKey] ?? {}
    record[metadataKey][propertyKey] = value
}

function isStandardMethodContext (value: any): value is ClassMethodDecoratorContext {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.kind === 'method' &&
        typeof value.name !== 'undefined'
    )
}

function isStandardClassContext (value: any): value is ClassDecoratorContext {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.kind === 'class' &&
        typeof value.name !== 'undefined'
    )
}

function setClassBindingMetadata (target: object, tokens: BindToken[]): void {
    setBindingMetadata(target, '__class__', { tokens })

    const prototype = (target as { prototype?: object }).prototype
    if (prototype) {
        setBindingMetadata(prototype, '__class__', { tokens })
    }
}

export function getBindingMetadataFromTargets (
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

export function getBindingMetadata (
    target: object,
    propertyKey?: PropertyKey
): BindingMetadata | undefined {
    if (propertyKey) return bindings.get(target)?.get(propertyKey)

    return bindings.get(target)?.get('__route_handler__')
}

export function setBindingMetadata (
    target: object,
    propertyKey: PropertyKey,
    metadata: BindingMetadata
): void {
    const map = bindings.get(target) ?? new Map<PropertyKey, BindingMetadata>()
    map.set(propertyKey, metadata)
    bindings.set(target, map)
}

export function getDesignParamTypes (target: object, propertyKey?: PropertyKey): BindToken[] {
    const reflect = Reflect as typeof Reflect & {
        getMetadata?: (key: string, target: object, propertyKey?: PropertyKey) => BindToken[] | undefined
    }

    return reflect.getMetadata?.('design:paramtypes', target, propertyKey) ?? []
}

export function isClass (value: any): boolean {
    return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value))
}
