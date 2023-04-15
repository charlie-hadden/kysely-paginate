import { SelectQueryBuilder } from "kysely";

export type OffsetPaginationResult<O> = {
  hasNextPage: boolean | undefined;
  hasPrevPage: boolean | undefined;
  rows: O[];
};

export async function executeWithOffsetPagination<O>(
  qb: SelectQueryBuilder<any, any, O>,
  opts: {
    perPage: number;
    page: number;
    useDeferredJoin?: boolean;
  }
): Promise<OffsetPaginationResult<O>> {
  const offset = (opts.page - 1) * opts.perPage;

  const rows = await qb
    .limit(opts.perPage + 1)
    .offset(offset)
    .execute();

  const hasNextPage = rows.length > 0 ? rows.length > opts.perPage : undefined;
  const hasPrevPage = rows.length > 0 ? opts.page > 1 : undefined;

  // If we fetched an extra row to determine if we have a next page, that
  // shouldn't be in the returned results
  if (rows.length > opts.perPage) {
    rows.pop();
  }

  return {
    hasNextPage,
    hasPrevPage,
    rows,
  };
}
