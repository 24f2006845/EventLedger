import type { PaginatedResponse } from "../types/pagination.types.js";

export const PaginateResults = <T extends { id: string }>(
    data:T[],
    limit: number,
): PaginatedResponse<T> => {
    const hasMore = data.length > limit;
    const result = hasMore ? data.slice(0, limit) : data;
    const nextCursor = hasMore ? data[limit - 1]?.id ?? null : null;
    return {
        data: result,
        pagination: {
            hasMore,
            nextCursor,
        },
    }
}