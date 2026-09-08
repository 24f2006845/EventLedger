import type { PaginatedResponse } from "./pagination.types.js";

export const PaginateResults = <T extends { id: string }>(
    data:T[],
    limit: number,
    getCursor: (item: T) => string
): PaginatedResponse<T> => {
    const hasMore = data.length > limit;
    const result = hasMore ? data.slice(0, limit) : data;
    const lastItem = result[result.length - 1];
    const nextCursor = hasMore && lastItem ? getCursor(lastItem) : null;
    return {
        data: result,
        pagination: {
            limit,
            hasMore,
            nextCursor,
        },
    }
}