import { SelectQueryBuilder, StringReference, sql } from "kysely";

export type OffsetPaginationResult<O> = {
  hasNextPage: boolean | undefined;
  hasPrevPage: boolean | undefined;
  rows: O[];
};

export async function executeWithOffsetPagination<O, DB, TB extends keyof DB>(
  qb: SelectQueryBuilder<DB, TB, O>,
  opts: {
    perPage: number;
    page: number;
    experimental_deferredJoinPrimaryKey?: StringReference<DB, TB>;
  }
): Promise<OffsetPaginationResult<O>> {
  qb = qb.limit(opts.perPage + 1).offset((opts.page - 1) * opts.perPage);

  const deferredJoinPrimaryKey = opts.experimental_deferredJoinPrimaryKey;

  if (deferredJoinPrimaryKey) {
    const primaryKeys = await qb
      .clearSelect()
      .select((eb) => eb.ref(deferredJoinPrimaryKey).as("primaryKey"))
      .execute()
      .then((rows) => rows.map((row) => row.primaryKey));

    qb = qb
      .where((eb) =>
        primaryKeys.length > 0
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            eb.cmpr(deferredJoinPrimaryKey, "in", primaryKeys as any)
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
