import type { ClearRequest } from './ClearRequest'
import type { RequestData } from './types'

export abstract class Controller<X = any> {
    [x: string]: any
    ctx!: X
    body!: RequestData
    query!: RequestData
    params!: RequestData
    clearRequest!: ClearRequest
}