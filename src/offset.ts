import { ColumnNode, SelectQueryBuilder, TableNode, sql } from "kysely";

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
  // TODO: This should be configurable
  const primaryKey = "id";

  qb = qb.limit(opts.perPage + 1).offset((opts.page - 1) * opts.perPage);

  if (opts.useDeferredJoin ?? true) {
    const subquery = qb.clearSelect().select(primaryKey);
    const ids = await subquery
      .execute()
      .then((rows) => rows.map((row) => row[primaryKey]));

    qb = qb
      .clearWhere() // TODO: Need to check this is actually what we want
      .where((eb) =>
        ids.length > 0
          ? eb.cmpr(primaryKey, "in", ids)
          : eb.cmpr(sql`1`, "=", 0)
      )
      .clearOffset()
      .clearLimit();
  }

  const rows = await qb.execute();
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
