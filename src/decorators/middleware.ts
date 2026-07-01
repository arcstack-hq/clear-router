import type { ClassMiddleware, MiddlewareHandle } from '../types/basic'

/**
 * Any value accepted as a middleware by the router: a plain callback, a class
 * exposing a `handle` method, or an already-instantiated object exposing one.
 */
export type MiddlewareInput = MiddlewareHandle | ClassMiddleware

/**
 * Decorator produced by {@link Middleware}. Works both as a class decorator (to
 * apply the middleware to every action of a controller) and as a method
 * decorator (to apply it to a single action). Supports the legacy
 * (`experimentalDecorators`) and TC39 standard decorator signatures.
 */
export type MiddlewareDecorator = MethodDecorator & ClassDecorator & {
    <This, Value extends (this: This, ...args: any[]) => any>(
        value: Value,
        context: ClassMethodDecoratorContext<This, Value>
    ): void | Value
    <Value extends abstract new (...args: any[]) => any>(
        value: Value,
        context: ClassDecoratorContext<Value>
    ): void | Value
}

const CLASS_KEY = '__class__'
const metadataKey = Symbol.for('clear-router:middleware-metadata')
const store = new WeakMap<object, Map<PropertyKey, MiddlewareInput[]>>()

/**
 * Attach one or more middleware to a controller class or a controller method.
 *
 * @example
 * ```ts
 * @Middleware([auth])
 * class AccountController {}
 *
 * class LoginController {
 *     @Middleware(GuestMiddleware)
 *     create () {}
 * }
 * ```
 *
 * Accepts the middleware variadically or as arrays, and every supported
 * middleware shape: callbacks, middleware classes, or instances exposing a
 * `handle` method.
 *
 * @param middlewares
 * @returns
 */
export function middleware(...middlewares: Array<MiddlewareInput | MiddlewareInput[]>): MiddlewareDecorator {
    const flattened = middlewares.flat() as MiddlewareInput[]

    return ((target: object, propertyKeyOrContext?: PropertyKey | ClassMethodDecoratorContext | ClassDecoratorContext) => {
        if (isStandardClassContext(propertyKeyOrContext)) {
            setClassMiddlewareMetadata(target, flattened)
            setStandardMetadata(propertyKeyOrContext.metadata, CLASS_KEY, flattened)

            return
        }

        if (isStandardMethodContext(propertyKeyOrContext)) {
            setStandardMetadata(propertyKeyOrContext.metadata, propertyKeyOrContext.name, flattened)

            return
        }

        if (typeof propertyKeyOrContext === 'undefined') {
            setClassMiddlewareMetadata(target, flattened)

            return
        }

        setMiddlewareMetadata(target, propertyKeyOrContext, flattened)
    }) as MiddlewareDecorator
}

/**
 * Collect the decorator-declared middleware for a controller route handler,
 * ordered class-level first then method-level. Returns an empty array for
 * non-controller (callback) handlers or handlers without any decorators.
 *
 * @param handler
 * @returns
 */
export function getControllerMiddlewares(handler: any): MiddlewareInput[] {
    if (!Array.isArray(handler) || handler.length !== 2) return []

    const [controller, method] = handler
    if (!controller) return []

    const constructor = typeof controller === 'function' ? controller : controller.constructor
    const prototype = typeof controller === 'function' ? controller.prototype : Object.getPrototypeOf(controller)
    const standardMetadata = constructor?.[(Symbol as any).metadata]

    const classMiddlewares =
        getMiddlewareMetadata(constructor, CLASS_KEY)
        ?? getMiddlewareMetadata(prototype, CLASS_KEY)
        ?? getStandardMetadata(standardMetadata, CLASS_KEY)
        ?? []

    const methodMiddlewares =
        getMiddlewareMetadata(prototype, method)
        ?? getMiddlewareMetadata(constructor, method)
        ?? getStandardMetadata(standardMetadata, method)
        ?? []

    return [...classMiddlewares, ...methodMiddlewares]
}

function setClassMiddlewareMetadata(target: object, middlewares: MiddlewareInput[]): void {
    setMiddlewareMetadata(target, CLASS_KEY, middlewares)

    const prototype = (target as { prototype?: object }).prototype
    if (prototype) {
        setMiddlewareMetadata(prototype, CLASS_KEY, middlewares)
    }
}

function setMiddlewareMetadata(target: object, propertyKey: PropertyKey, middlewares: MiddlewareInput[]): void {
    const map = store.get(target) ?? new Map<PropertyKey, MiddlewareInput[]>()
    const existing = map.get(propertyKey)
    map.set(propertyKey, existing ? [...existing, ...middlewares] : middlewares)
    store.set(target, map)
}

function getMiddlewareMetadata(target: object | undefined, propertyKey: PropertyKey): MiddlewareInput[] | undefined {
    if (!target) return undefined

    return store.get(target)?.get(propertyKey)
}

function setStandardMetadata(metadata: object | undefined, propertyKey: PropertyKey, middlewares: MiddlewareInput[]): void {
    if (!metadata) return

    const record = metadata as Record<symbol, Record<PropertyKey, MiddlewareInput[]>>
    record[metadataKey] = record[metadataKey] ?? {}
    const existing = record[metadataKey][propertyKey]
    record[metadataKey][propertyKey] = existing ? [...existing, ...middlewares] : middlewares
}

function getStandardMetadata(metadata: object | undefined, propertyKey: PropertyKey): MiddlewareInput[] | undefined {
    const record = metadata && (metadata as Record<symbol, Record<PropertyKey, MiddlewareInput[]>>)[metadataKey]

    return record ? record[propertyKey] : undefined
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
