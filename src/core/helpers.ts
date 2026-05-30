
export const wrap = <T> (value: T | T[] | null | undefined): T[] => {
    if (value === null || value === void 0) return []

    return Array.isArray(value) ? value : [value]
}