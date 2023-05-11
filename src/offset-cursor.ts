import { SelectQueryBuilder } from "kysely";
import { CursorPaginationResult, CursorPaginationResultRow } from "./cursor";

export async function executeWithOffsetCursorPagination<
  DB,
  TB extends keyof DB,
  O,
  TCursorKey extends string | boolean | undefined = undefined
>(
  qb: SelectQueryBuilder<DB, TB, O>,
  opts: {
    perPage: number;
    after?: string;
    before?: string;
    cursorPerRow?: TCursorKey;
    encodeCursor?: (values: [["offset", number]]) => string;
    decodeCursor?: (cursor: string, fields: ["offset"]) => { offset: string };
    parseCursor:
      | ((cursor: { offset: string }) => { offset: number })
      | { parse: (cursor: { offset: string }) => { offset: number } };
  }
): Promise<CursorPaginationResult<O, TCursorKey>> {
  const encodeCursor = opts.encodeCursor ?? defaultEncodeCursor;
  const decodeCursor = opts.decodeCursor ?? defaultDecodeCursor;

  const parseCursor =
    typeof opts.parseCursor === "function"
      ? opts.parseCursor
      : opts.parseCursor.parse;

  const after = opts.after
    ? parseCursor(decodeCursor(opts.after, ["offset"])).offset
    : undefined;

  const before = opts.before
    ? parseCursor(decodeCursor(opts.before, ["offset"])).offset
    : undefined;

  if (before) {
  }

  qb = qb.limit(opts.perPage + 1);

  if (after) qb = qb.offset(after + 1);

  const reversed = false;

  const rows = await qb.execute();
  const hasNextPage = reversed ? undefined : rows.length > opts.perPage;
  const hasPrevPage = !reversed ? undefined : rows.length > opts.perPage;

  // If we fetched an extra row to determine if we have a next page, that
  // shouldn't be in the returned results
  if (rows.length > opts.perPage) rows.pop();

  const startCursor = encodeCursor([["offset", after || 0]]);
  const endCursor = encodeCursor([["offset", (after || 0) + rows.length - 1]]);

  return {
    startCursor,
    endCursor,
    hasNextPage,
    hasPrevPage,
    rows: rows.map((row, i) => {
      if (opts.cursorPerRow) {
        const cursorKey =
          typeof opts.cursorPerRow === "string" ? opts.cursorPerRow : "$cursor";

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (row as any)[cursorKey] = encodeCursor([["offset", (after || 0) + i]]);
      }

      return row as CursorPaginationResultRow<O, TCursorKey>;
    }),
  };
}

function defaultEncodeCursor([[, offset]]: [["offset", number]]) {
  return Buffer.from(`offset=${offset.toString(10)}`, "utf8").toString(
    "base64url"
  );
}

function defaultDecodeCursor(cursor: string) {
  let parsed;

  try {
    parsed = [
      ...new URLSearchParams(
        Buffer.from(cursor, "base64url").toString("utf8")
      ).entries(),
    ];
  } catch {
    throw new Error("Unparsable cursor");
  }

  if (parsed.length !== 1) {
    throw new Error("Unexpected number of fields");
  }

  const field = parsed[0];
  const offset = field?.[1];

  if (!field || field[0] !== "offset" || !offset) {
    throw new Error("Unable to find offset");
  }

  return { offset };
}
