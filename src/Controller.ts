import { ClearRequest } from "./ClearRequest"
import { RequestData } from "types"

export abstract class Controller<X = any> {
    [x: string]: any
    ctx!: X
    body!: RequestData
    query!: RequestData
    params!: RequestData
    clearRequest!: ClearRequest
}