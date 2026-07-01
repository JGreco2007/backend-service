export interface Pagination {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

/**
 * Parses `page`/`pageSize` query params, clamping pageSize to `maxPageSize`
 * regardless of what the client asks for — so no listing endpoint can be
 * made to return unbounded rows in one call.
 */
export function parsePagination(
  query: unknown,
  opts: { defaultPageSize: number; maxPageSize: number }
): Pagination {
  const q = (query ?? {}) as Record<string, unknown>;

  const rawPage = Number(q.page);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawPageSize = Number(q.pageSize);
  const requestedSize = Number.isFinite(rawPageSize) && rawPageSize >= 1 ? Math.floor(rawPageSize) : opts.defaultPageSize;
  const pageSize = Math.min(requestedSize, opts.maxPageSize);

  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}
