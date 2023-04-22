import { beforeAll, bench, describe } from "vitest";
import { Kysely } from "kysely";
import {
  defaultEncodeCursor,
  executeWithCursorPagination,
  executeWithOffsetPagination,
} from "../src";
import { DB, createSampleBlogPosts, setupDatabase } from "../test/db";

export function sharedBenchmarks(db: Kysely<DB>) {
  const numRows = 100000;
  const perPage = 100;

  const query = db.selectFrom("blogPosts").selectAll();

  // A cursor isn't actually needed to load the first page, but decoding the
  // cursor has a small overhead that all later pages will also have. Since what
  // we care about here is the pagination depth rather than if we can skip a
  // single cursor decode, we just use this instead.
  const firstPageCursor = defaultEncodeCursor<any, any, any, any>([["id", 0]]);

  const middlePageNumber = numRows / perPage / 2;
  let middlePageCursor: string | undefined;

  const lastPageNumber = numRows / perPage;
  let lastPageCursor: string | undefined;

  beforeAll(async () => {
    const perInsert = 1000;

    await setupDatabase(db);

    for (let i = 0; i < numRows / perInsert; i++) {
      await createSampleBlogPosts(db, perInsert);
    }

    middlePageCursor = defaultEncodeCursor<any, any, any, any>([
      [
        "id",
        await query
          .limit(1)
          .offset(numRows / 2 - perPage - 1)
          .executeTakeFirstOrThrow()
          .then((row) => row.id),
      ],
    ]);

    lastPageCursor = defaultEncodeCursor<any, any, any, any>([
      [
        "id",
        await query
          .limit(1)
          .offset(numRows - perPage - 1)
          .executeTakeFirstOrThrow()
          .then((row) => row.id),
      ],
    ]);
  }, 60_000);

  describe(`loading page 1`, () => {
    bench(`executeWithCursorPagination`, async () => {
      await executeWithCursorPagination(query, {
        perPage,
        after: firstPageCursor,
        fields: [{ expression: "id", direction: "asc" }],
      });
    });

    Object.entries({
      "without deferred join": false,
      "with deferred join": true,
    }).forEach(([description, useDeferredJoin]) => {
      bench(`executeWithOffsetPagination (${description})`, async () => {
        await executeWithOffsetPagination(query.orderBy("id", "asc"), {
          perPage,
          page: 1,
          experimental_deferredJoinPrimaryKey: useDeferredJoin
            ? "blogPosts.id"
            : undefined,
        });
      });
    });
  });

  describe(`loading page ${middlePageNumber}`, () => {
    bench(`executeWithCursorPagination`, async () => {
      await executeWithCursorPagination(query, {
        perPage,
        after: middlePageCursor,
        fields: [{ expression: "id", direction: "asc" }],
      });
    });

    Object.entries({
      "without deferred join": false,
      "with deferred join": true,
    }).forEach(([description, useDeferredJoin]) => {
      bench(`executeWithOffsetPagination (${description})`, async () => {
        await executeWithOffsetPagination(query.orderBy("id", "asc"), {
          perPage,
          page: middlePageNumber,
          experimental_deferredJoinPrimaryKey: useDeferredJoin
            ? "blogPosts.id"
            : undefined,
        });
      });
    });
  });

  describe(`loading page ${lastPageNumber}`, () => {
    bench(`executeWithCursorPagination`, async () => {
      await executeWithCursorPagination(query, {
        perPage,
        after: lastPageCursor,
        fields: [{ expression: "id", direction: "asc" }],
      });
    });

    Object.entries({
      "without deferred join": false,
      "with deferred join": true,
    }).forEach(([description, useDeferredJoin]) => {
      bench(`executeWithOffsetPagination (${description})`, async () => {
        await executeWithOffsetPagination(query.orderBy("id", "asc"), {
          perPage,
          page: lastPageNumber,
          experimental_deferredJoinPrimaryKey: useDeferredJoin
            ? "blogPosts.id"
            : undefined,
        });
      });
    });
  });
}
