import {
  OrderByDirectionExpression,
  OrderByExpression,
  ReferenceExpression,
  SelectQueryBuilder,
} from "kysely";

type Fields<DB, TB extends keyof DB, O> = ReadonlyArray<
  Readonly<{
    expression: ReferenceExpression<DB, TB>;
    key: keyof O & string;
    direction: OrderByDirectionExpression;
  }>
>;

// TODO: This probably shouldn't be named field names any more
type FieldNames<DB, TB extends keyof DB, O, T extends Fields<DB, TB, O>> = {
  [TIndex in keyof T]: T[TIndex]["key"];
};

type EncodeCursorValues<
  DB,
  TB extends keyof DB,
  O,
  T extends Fields<DB, TB, O>
> = {
  [TIndex in keyof T]: [T[TIndex]["key"], O[T[TIndex]["key"]]];
};

export type CursorEncoder<
  DB,
  TB extends keyof DB,
  O,
  T extends Fields<DB, TB, O>
> = (values: EncodeCursorValues<DB, TB, O, T>) => string;

type DecodedCursor<T extends Fields<any, any, any>> = {
  [TField in T[number]["key"]]: string;
};

export type CursorDecoder<
  DB,
  TB extends keyof DB,
  O,
  T extends Fields<DB, TB, O>
> = (cursor: string, fields: FieldNames<DB, TB, O, T>) => DecodedCursor<T>;

type ParsedCursorValues<
  DB,
  TB extends keyof DB,
  O,
  T extends Fields<DB, TB, O>
> = {
  [TField in T[number]["key"]]: O[TField];
};

export type CursorParser<
  DB,
  TB extends keyof DB,
  O,
  T extends Fields<DB, TB, O>
> = (cursor: DecodedCursor<T>) => ParsedCursorValues<DB, TB, O, T>;

type CursorPaginationResultRow<
  TRow,
  TCursorKey extends string | boolean | undefined
> = TRow & {
  [K in TCursorKey extends undefined
    ? never
    : TCursorKey extends false
    ? never
    : TCursorKey extends true
    ? "$cursor"
    : TCursorKey]: string;
};

export type CursorPaginationResult<
  TRow,
  TCursorKey extends string | boolean | undefined
> = {
  startCursor: string | undefined;
  endCursor: string | undefined;
  hasNextPage: boolean;
  rows: CursorPaginationResultRow<TRow, TCursorKey>[];
};

export async function executeWithCursorPagination<
  DB,
  TB extends keyof DB,
  O,
  const TFields extends Fields<DB, TB, O>,
  TCursorKey extends string | boolean | undefined = undefined
>(
  qb: SelectQueryBuilder<DB, TB, O>,
  opts: {
    perPage: number;
    after?: string;
    before?: string;
    cursorPerRow?: TCursorKey;
    fields: TFields;
    encodeCursor?: CursorEncoder<DB, TB, O, TFields>;
    decodeCursor?: CursorDecoder<DB, TB, O, TFields>;
    parseCursor?: CursorParser<DB, TB, O, TFields>;
  }
): Promise<CursorPaginationResult<O, TCursorKey>> {
  const encodeCursor = opts.encodeCursor ?? defaultEncodeCursor;
  const decodeCursor = opts.decodeCursor ?? defaultDecodeCursor;

  function generateCursor(row: O): string {
    const cursorFieldValues = opts.fields.map(({ key }) => [
      key,
      row[key],
    ]) as EncodeCursorValues<DB, TB, O, TFields>;

    return encodeCursor(cursorFieldValues);
  }

  const fieldNames = opts.fields.map((field) => field.key) as FieldNames<
    DB,
    TB,
    O,
    TFields
  >;

  if (opts.after) {
    const decoded = decodeCursor(opts.after, fieldNames);
    const cursor = opts.parseCursor ? opts.parseCursor(decoded) : decoded;

    qb = qb.where(({ and, or, cmpr }) => {
      function apply(index: number) {
        const field = opts.fields[index];

        if (!field) {
          throw new Error("Unknown cursor index");
        }

        const value = cursor[field.key];

        const conditions = [
          cmpr(
            field.expression,
            field.direction === "asc" ? ">" : "<",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            value
          ),
        ];

        if (index < opts.fields.length - 1) {
          conditions.push(
            and([
              cmpr(
                field.expression,
                "=",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                value
              ),
              apply(index + 1),
            ])
          );
        }

        return or(conditions);
      }

      return apply(0);
    });
  }

  for (const { expression, direction } of opts.fields) {
    qb = qb.orderBy(expression, direction);
  }

  const rows = await qb.limit(opts.perPage + 1).execute();
  const hasNextPage = rows.length > opts.perPage;

  // If we fetched an extra row to determine if we have a next page, that
  // shouldn't be in the returned results
  if (rows.length > opts.perPage) {
    rows.pop();
  }

  const startRow = rows[0];
  const endRow = rows[rows.length - 1];

  const startCursor = startRow ? generateCursor(startRow) : undefined;
  const endCursor = endRow ? generateCursor(endRow) : undefined;

  return {
    startCursor,
    endCursor,
    hasNextPage,
    // hasPrevPage: false,
    rows: rows.map((row) => {
      if (opts.cursorPerRow) {
        const cursorKey =
          typeof opts.cursorPerRow === "string" ? opts.cursorPerRow : "$cursor";

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        (row as any)[cursorKey] = generateCursor(row);
      }

      return row as CursorPaginationResultRow<O, TCursorKey>;
    }),
  };
}

export function defaultEncodeCursor<
  DB,
  TB extends keyof DB,
  O,
  T extends Fields<DB, TB, O>
>(values: EncodeCursorValues<DB, TB, O, T>) {
  const cursor = new URLSearchParams();

  for (const [column, value] of values) {
    switch (typeof value) {
      case "string":
        cursor.set(column, value);
        break;

      case "number":
        cursor.set(column, String(value));
        break;

      default:
        // FIXME
        throw new Error("Cursor value type not yet handled");
    }
  }

  return Buffer.from(cursor.toString(), "utf8").toString("base64url");
}

export function defaultDecodeCursor<
  DB,
  TB extends keyof DB,
  O,
  T extends Fields<DB, TB, O>
>(cursor: string, fields: FieldNames<DB, TB, O, T>): DecodedCursor<T> {
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

  if (parsed.length !== fields.length) {
    throw new Error("Unexpected number of fields");
  }

  for (let i = 0; i < fields.length; i++) {
    const field = parsed[i];
    const expectedName = fields[i];

    if (!field) {
      throw new Error("Unable to find field");
    }

    if (field[0] !== expectedName) {
      throw new Error("Unexpected field name");
    }
  }

  return Object.fromEntries(parsed) as DecodedCursor<T>;
}
