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
  [TIndex in keyof T]: [T[TIndex][0], unknown];
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
  // FIXME: This seems like a hack we shouldn't need
  const decodeCursor = opts.decodeCursor ?? defaultDecodeCursor<O, TFields>;

  const fieldNames = opts.fields.map((field) => field[0]) as FieldNames<
    O,
    TFields
  >;

  if (opts.after) {
    const cursor = decodeCursor(opts.after, fieldNames);

    qb = qb.where(({ and, or, cmpr }) => {
      function apply(index: number) {
        const cursorColumn = cursor[index];
        const field = opts.fields[index];

        if (!cursorColumn || !field) {
          throw new Error("Unknown cursor index");
        }

        const [column, value] = cursorColumn;
        const direction = field[1];

        const conditions = [
          cmpr(
            column,
            direction === "asc" ? ">" : "<",
            value as any /* FIXME */
          ),
        ];

        if (index < cursor.length - 1) {
          conditions.push(
            and([cmpr(column, "=", value as any /* FIXME */), apply(index + 1)])
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

  return {
    hasNextPage: rows.length > opts.perPage,
    // hasPrevPage: false,
    rows: rows.slice(0, opts.perPage).map((row) => {
      const cursorFieldValues = opts.fields.map(([field]) => [
        field,
        row[field],
      ]) as EncodeCursorValues<O, TFields>;

      return {
        ...row,
        $cursor: encodeCursor(cursorFieldValues),
      };
    }),
  };
}

export function defaultEncodeCursor<O, T extends Fields<O>>(
  values: EncodeCursorValues<O, T>
) {
  return Buffer.from(JSON.stringify(values), "utf8").toString("base64url");
}

export function defaultDecodeCursor<O, T extends Fields<O>>(
  cursor: string,
  fields: FieldNames<O, T>
) {
  let parsed: unknown;

  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("Unparsable cursor");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Not an array");
  }

  if (parsed.length !== fields.length) {
    throw new Error("Unexpected number of fields");
  }

  for (let i = 0; i < fields.length; i++) {
    const field = parsed[i] as unknown;
    const expectedName = fields[i] as string;

    if (!Array.isArray(field) || field.length !== 2) {
      throw new Error("Malformed value for field");
    }

    if (field[0] !== expectedName) {
      throw new Error("Unexpected field name");
    }
  }

  return parsed as DecodedCursor<any>;
}
