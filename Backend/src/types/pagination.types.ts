export interface PaginationResponse<T> {
    result : T[];
    nextCursor: string | null;
    hasMore: boolean;
}