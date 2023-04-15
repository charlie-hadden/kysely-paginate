import { run, bench, group } from "mitata";
import { createSampleBlogPosts, db } from "../test/db";
import {
  defaultEncodeCursor,
  executeWithCursorPagination,
  executeWithOffsetPagination,
} from "../src";

const numRows = 100000;
const perInsert = 1000;

await db.deleteFrom("blogPosts").execute();

for (let i = 0; i < numRows / perInsert; i++) {
  await createSampleBlogPosts(perInsert);
}

const query = db.selectFrom("blogPosts").selectAll();
const perPage = 100;

// A cursor isn't actually needed to load the first page, but decoding the
// cursor has a small overhead that all later pages will also have. Since what
// we care about here is the pagination depth rather than if we can skip a
// single cursor decode, we just use this instead.
const firstPageCursor = defaultEncodeCursor<any, any>([["id", 0]]);

const lastPageNumber = numRows / perPage;
const lastPageCursor = defaultEncodeCursor<any, any>([
  [
    "id",
    await query
      .limit(1)
      .offset(numRows - perPage - 1)
      .executeTakeFirstOrThrow()
      .then((row) => row.id),
  ],
]);

group("loading page 1", () => {
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

group(`loading page ${lastPageNumber}`, () => {
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

await run();
