import { RequestData } from "types"

export class ClearRequest {
    [key: string]: any

    /**
     * @param body - Parsed request body
     */
    body!: RequestData

    /**
     * @param query - Parsed query parameters
     */
    query!: RequestData

    /**
     * @param params - Parsed route parameters
     */
    params!: RequestData

    constructor(init?: Partial<ClearRequest>) {
        Object.assign(this, init)
    }
}