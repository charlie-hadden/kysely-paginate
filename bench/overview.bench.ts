import { beforeAll, bench, describe } from "vitest";
import { createSampleBlogPosts, db } from "../test/db";
import {
  defaultEncodeCursor,
  executeWithCursorPagination,
  executeWithOffsetPagination,
} from "../src";

const numRows = 100000;
const query = db.selectFrom("blogPosts").selectAll();
const perPage = 100;

// A cursor isn't actually needed to load the first page, but decoding the
// cursor has a small overhead that all later pages will also have. Since what
// we care about here is the pagination depth rather than if we can skip a
// single cursor decode, we just use this instead.
const firstPageCursor = defaultEncodeCursor<any, any>([["id", 0]]);

const middlePageNumber = numRows / perPage / 2;
let middlePageCursor: string | undefined;

const lastPageNumber = numRows / perPage;
let lastPageCursor: string | undefined;

beforeAll(async () => {
  await db.deleteFrom("blogPosts").execute();

  const perInsert = 1000;

  for (let i = 0; i < numRows / perInsert; i++) {
    await createSampleBlogPosts(perInsert);
  }

  middlePageCursor = defaultEncodeCursor<any, any>([
    [
      "id",
      await query
        .limit(1)
        .offset(numRows / 2 - perPage - 1)
        .executeTakeFirstOrThrow()
        .then((row) => row.id),
    ],
  ]);

  lastPageCursor = defaultEncodeCursor<any, any>([
    [
      "id",
      await query
        .limit(1)
        .offset(numRows - perPage - 1)
        .executeTakeFirstOrThrow()
        .then((row) => row.id),
    ],
  ]);
});

describe("loading page 1", () => {
  bench(`executeWithCursorPagination`, async () => {
    await executeWithCursorPagination(query, {
      perPage,
      after: firstPageCursor,
      fields: [["id", "asc"]],
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
        useDeferredJoin,
      });
    });
  });
});

describe(`loading page ${middlePageNumber}`, () => {
  bench(`executeWithCursorPagination`, async () => {
    await executeWithCursorPagination(query, {
      perPage,
      after: middlePageCursor,
      fields: [["id", "asc"]],
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
        useDeferredJoin,
      });
    });
  });
});

describe(`loading page ${lastPageNumber}`, () => {
  bench(`executeWithCursorPagination`, async () => {
    await executeWithCursorPagination(query, {
      perPage,
      after: lastPageCursor,
      fields: [["id", "asc"]],
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
        useDeferredJoin,
      });
    });
  });
});
