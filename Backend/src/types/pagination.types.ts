export interface PaginationMeta {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}