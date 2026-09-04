import type { PaginationResponse } from '../types/pagination.types.js';

export const PaginateResults = <T extends {id: string}>(results: T[], limit: number, cursor?: string): PaginationResponse<T> => {
    const hasMore = results.length > limit;
    const response = hasMore ? results.slice(0, -1) : results;
    const nextCursor = (hasMore && response.length > 0)
        ? (response[response.length - 1] )?.id ?? null // Assuming the items have an 'id' property
        : null;

    return {
        result: response,
        nextCursor,
        hasMore,
    };
};