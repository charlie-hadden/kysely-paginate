import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { defaultEncodeCursor, executeWithOffsetCursorPagination } from "../src";
import { createSampleBlogPosts, databases, setupDatabase } from "./db";

databases.forEach(([kind, db]) => {
  describe(kind, () => {
    beforeAll(async () => await setupDatabase(db));

    beforeEach(async () => {
      await db.deleteFrom("blogPosts").execute();
      await db.deleteFrom("authors").execute();
    });

    describe("executeWithOffsetCursorPagination", () => {
      it("handles a simple case with no cursors", async () => {
        const posts = await createSampleBlogPosts(db, 2);

        const query = db
          .selectFrom("blogPosts")
          .select(["id"])
          .orderBy("id", "asc");

        const result = await executeWithOffsetCursorPagination(query, {
          perPage: 2,
          parseCursor: z.object({ offset: z.coerce.number().int() }),
        });

        expect(result.startCursor).toBeTruthy();
        expect(result.endCursor).toBeTruthy();
        expect(result.hasNextPage).toBe(false);
        expect(result.hasPrevPage).toBe(undefined);
        expect(result.rows.map((row) => row.id)).toEqual(
          posts.map((p) => p.id).sort((a, b) => a - b)
        );
      });

      it("supports returning a cursor for each row", async () => {
        await createSampleBlogPosts(db, 1);

        const query = db
          .selectFrom("blogPosts")
          .select(["id"])
          .orderBy("id", "asc");

        const result = await executeWithOffsetCursorPagination(query, {
          perPage: 2,
          cursorPerRow: true,
          parseCursor: z.object({ offset: z.coerce.number().int() }),
        });

        expect(result.rows[0]?.$cursor).toEqual(result.endCursor);
      });

      it("supports returning a cursor for each row with a custom key", async () => {
        await createSampleBlogPosts(db, 1);

        const query = db
          .selectFrom("blogPosts")
          .select(["id"])
          .orderBy("id", "asc");

        const result = await executeWithOffsetCursorPagination(query, {
          perPage: 2,
          cursorPerRow: "foobar",
          parseCursor: z.object({ offset: z.coerce.number().int() }),
        });

        expect(result.rows[0]?.foobar).toEqual(result.endCursor);
      });

      it("works when providing an 'after' cursor", async () => {
        const posts = await createSampleBlogPosts(db, 4);

        const query = db
          .selectFrom("blogPosts")
          .select(["id"])
          .orderBy("id", "asc");

        const firstPage = await executeWithOffsetCursorPagination(query, {
          perPage: 2,
          parseCursor: z.object({ offset: z.coerce.number().int() }),
        });

        expect(firstPage.hasNextPage).toBe(true);
        expect(firstPage.hasPrevPage).toBe(undefined);
        expect(firstPage.rows[0]?.id).toEqual(posts[0]?.id);
        expect(firstPage.rows[1]?.id).toEqual(posts[1]?.id);

        const secondPage = await executeWithOffsetCursorPagination(query, {
          perPage: 2,
          after: firstPage.endCursor,
          parseCursor: z.object({ offset: z.coerce.number().int() }),
        });

        expect(secondPage.hasNextPage).toBe(false);
        expect(secondPage.hasPrevPage).toBe(undefined);
        expect(secondPage.rows[0]?.id).toEqual(posts[2]?.id);
        expect(secondPage.rows[1]?.id).toEqual(posts[3]?.id);
      });

      it.only("works when providing a 'before' cursor", async () => {
        const posts = await createSampleBlogPosts(db, 4);

        const query = db
          .selectFrom("blogPosts")
          .select(["id"])
          .orderBy("id", "asc");

        const firstPage = await executeWithOffsetCursorPagination(query, {
          perPage: 2,
          before: defaultEncodeCursor<any, any, any, any>([["offset", 5]]),
          parseCursor: z.object({ offset: z.coerce.number().int() }),
        });

        expect(firstPage.hasNextPage).toBe(undefined);
        expect(firstPage.hasPrevPage).toBe(true);
        expect(firstPage.rows[0]?.id).toEqual(posts[2]?.id);
        expect(firstPage.rows[1]?.id).toEqual(posts[3]?.id);

        const secondPage = await executeWithOffsetCursorPagination(query, {
          perPage: 2,
          before: firstPage.startCursor,
          parseCursor: z.object({ offset: z.coerce.number().int() }),
        });

        expect(secondPage.hasNextPage).toBe(undefined);
        expect(secondPage.hasPrevPage).toBe(false);
        expect(secondPage.rows[0]?.id).toEqual(posts[0]?.id);
        expect(secondPage.rows[1]?.id).toEqual(posts[1]?.id);
      });

      describe("when providing both a 'before' and 'after' cursor", () => {
        it("works correctly with a single sort", async () => {
          await createSampleBlogPosts(db, 6);

          const query = db.selectFrom("blogPosts").select(["id"]);

          const fullResult = await executeWithOffsetCursorPagination(query, {
            perPage: 6,
            parseCursor: z.object({ offset: z.coerce.number().int() }),
          });

          const firstPage = await executeWithOffsetCursorPagination(query, {
            perPage: 2,
            before: fullResult.endCursor,
            after: fullResult.startCursor,
            parseCursor: z.object({ offset: z.coerce.number().int() }),
          });

          expect(firstPage.hasNextPage).toBe(true);
          expect(firstPage.hasPrevPage).toBe(undefined);
          expect(firstPage.rows[0]?.id).toEqual(fullResult.rows[1]?.id);
          expect(firstPage.rows[1]?.id).toEqual(fullResult.rows[2]?.id);

          const secondPage = await executeWithOffsetCursorPagination(query, {
            perPage: 4,
            before: fullResult.endCursor,
            after: firstPage.endCursor,
            parseCursor: z.object({ offset: z.coerce.number().int() }),
          });

          expect(secondPage.hasNextPage).toBe(false);
          expect(secondPage.hasPrevPage).toBe(undefined);
          expect(secondPage.rows.length).toEqual(2);
          expect(secondPage.rows[0]?.id).toEqual(fullResult.rows[3]?.id);
          expect(secondPage.rows[1]?.id).toEqual(fullResult.rows[4]?.id);
        });
      });
    });
  });
});
