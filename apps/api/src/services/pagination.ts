export interface PageParams {
  /** 1-based page number. */
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const MAX_PAGE_SIZE = 100;

export function toSkipTake({ page, pageSize }: PageParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPage<T>(items: T[], totalCount: number, params: PageParams): Page<T> {
  return {
    items,
    totalCount,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(totalCount / params.pageSize)),
  };
}
