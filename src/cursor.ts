import { OrderByDirectionExpression, SelectQueryBuilder } from "kysely";

type Fields<O> = Readonly<
  Readonly<[field: keyof O & string, direction: OrderByDirectionExpression]>[]
>;

type FieldNames<O, T extends Fields<O>> = {
  [TIndex in keyof T]: T[TIndex][0];
};

type EncodeCursorValues<O, T extends Fields<O>> = {
  [TIndex in keyof T]: [T[TIndex][0], O[T[TIndex][0]]];
};

export type CursorEncoder<O, T extends Fields<O>> = (
  values: EncodeCursorValues<O, T>
) => string;

type DecodedCursor<T extends Fields<any>> = {
  [TField in T[number][0]]: string;
};

export type CursorDecoder<O, T extends Fields<O>> = (
  cursor: string,
  fields: FieldNames<O, T>
) => DecodedCursor<T>;

export async function executeWithCursorPagination<
  O,
  const TFields extends Fields<O>
>(
  qb: SelectQueryBuilder<any, any, O>,
  opts: {
    perPage: number;
    after?: string;
    before?: string;
    fields: TFields;
    encodeCursor?: CursorEncoder<O, TFields>;
    decodeCursor?: CursorDecoder<O, TFields>;
  }
) {
  const encodeCursor = opts.encodeCursor ?? defaultEncodeCursor;
  const decodeCursor = opts.decodeCursor ?? defaultDecodeCursor;

  function generateCursor(row: O): string {
    const cursorFieldValues = opts.fields.map(([field]) => [
      field,
      row[field],
    ]) as EncodeCursorValues<O, TFields>;

    return encodeCursor(cursorFieldValues);
  }

  const fieldNames = opts.fields.map((field) => field[0]) as FieldNames<
    O,
    TFields
  >;

  if (opts.after) {
    const cursor = decodeCursor(opts.after, fieldNames);

    qb = qb.where(({ and, or, cmpr }) => {
      function apply(index: number) {
        const field = opts.fields[index];

        if (!field) {
          throw new Error("Unknown cursor index");
        }

        const [column, direction] = field;
        const value = cursor[column];

        const conditions = [
          cmpr(
            column,
            direction === "asc" ? ">" : "<",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            value as any
          ),
        ];

        if (index < opts.fields.length - 1) {
          conditions.push(
            and([
              cmpr(
                column,
                "=",
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                value as any
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

  for (const [field, direction] of opts.fields) {
    qb = qb.orderBy(field, direction);
  }

  const rows = await qb.limit(opts.perPage + 1).execute();
  const slicedRows = rows.slice(0, opts.perPage);

  const startRow = slicedRows[0];
  const endRow = slicedRows[slicedRows.length - 1];

  const startCursor = startRow ? generateCursor(startRow) : undefined;
  const endCursor = endRow ? generateCursor(endRow) : undefined;

  return {
    startCursor,
    endCursor,
    hasNextPage: rows.length > opts.perPage,
    // hasPrevPage: false,
    rows: slicedRows.map((row) => {
      return {
        ...row,
        $cursor: generateCursor(row),
      };
    }),
  };
}

export function defaultEncodeCursor<O, T extends Fields<O>>(
  values: EncodeCursorValues<O, T>
) {
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

export function defaultDecodeCursor<O, T extends Fields<O>>(
  cursor: string,
  fields: FieldNames<O, T>
): DecodedCursor<T> {
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
