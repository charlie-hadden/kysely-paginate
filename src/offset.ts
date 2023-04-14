import { SelectQueryBuilder } from "kysely";

export type OffsetPaginationResult<O> = {
  rows: O[];
};

export async function executeWithOffsetPagination<O>(
  qb: SelectQueryBuilder<any, any, O>,
  opts: {
    perPage: number;
    page: number;
  }
): Promise<OffsetPaginationResult<O>> {
  if (opts.page < 1) {
    throw new Error("Invalid page number");
  }

  const offset = (opts.page - 1) * opts.perPage;

  const rows = await qb.limit(opts.perPage).offset(offset).execute();

  return { rows };
}
