import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { executeWithOffsetPagination } from "../src";
import {
  createSampleAuthors,
  createSampleBlogPosts,
  databases,
  setupDatabase,
} from "./db";

databases.forEach(([kind, db]) => {
  describe(kind, () => {
    beforeAll(async () => await setupDatabase(db));

    beforeEach(async () => {
      await db.deleteFrom("blogPosts").execute();
      await db.deleteFrom("authors").execute();
    });

    describe("executeWithOffsetPagination", () => {
      Object.entries({
        "without deferred join": false,
        "with deferred join": true,
      }).forEach(([description, useDeferredJoin]) => {
        describe(description, () => {
          it("allows returning page 1", async () => {
            const posts = await createSampleBlogPosts(db, 4);

            const query = db
              .selectFrom("blogPosts")
              .selectAll()
              .orderBy("id", "asc");

            const result = await executeWithOffsetPagination(query, {
              perPage: 2,
              page: 1,
              experimental_deferredJoinPrimaryKey: useDeferredJoin
                ? "blogPosts.id"
                : undefined,
            });

            expect(result.hasNextPage).toBe(true);
            expect(result.hasPrevPage).toBe(false);
            expect(result.rows.map((r) => r.id)).toEqual(
              posts
                .map((p) => p.id)
                .sort((a, b) => a - b)
                .slice(0, 2)
            );
          });

          it("allows returning later pages", async () => {
            const posts = await createSampleBlogPosts(db, 4);

            const query = db
              .selectFrom("blogPosts")
              .selectAll()
              .orderBy("id", "asc");

            const result = await executeWithOffsetPagination(query, {
              perPage: 2,
              page: 2,
              experimental_deferredJoinPrimaryKey: useDeferredJoin
                ? "blogPosts.id"
                : undefined,
            });

            expect(result.hasNextPage).toBe(false);
            expect(result.hasPrevPage).toBe(true);
            expect(result.rows.map((r) => r.id)).toEqual(
              posts
                .map((p) => p.id)
                .sort((a, b) => a - b)
                .slice(2, 4)
            );
          });

          it("handles paginating past the last page well", async () => {
            await createSampleBlogPosts(db, 4);

            const query = db
              .selectFrom("blogPosts")
              .selectAll()
              .orderBy("id", "asc");

            const result = await executeWithOffsetPagination(query, {
              perPage: 2,
              page: 20,
              experimental_deferredJoinPrimaryKey: useDeferredJoin
                ? "blogPosts.id"
                : undefined,
            });

            expect(result.hasNextPage).toBeUndefined();
            expect(result.hasPrevPage).toBeUndefined();
            expect(result.rows).toEqual([]);
          });

          it("applies where conditions correctly", async () => {
            await createSampleBlogPosts(db, 10);

            const query = db
              .selectFrom("blogPosts")
              .selectAll()
              .where("authorId", "=", 1)
              .orderBy("id", "asc");

            const posts = await query.execute();

            const result = await executeWithOffsetPagination(query, {
              perPage: 50,
              page: 1,
              experimental_deferredJoinPrimaryKey: useDeferredJoin
                ? "blogPosts.id"
                : undefined,
            });

            expect(result.hasNextPage).toBe(false);
            expect(result.rows).toEqual(posts);
          });

          it("works with joins", async () => {
            await createSampleBlogPosts(db, 10);
            await createSampleAuthors(db);

            const query = db
              .selectFrom("blogPosts")
              .innerJoin("authors", "authors.id", "blogPosts.authorId")
              .select([
                "blogPosts.id",
                "blogPosts.title",
                "blogPosts.authorId",
                "authors.name as authorName",
              ])
              .orderBy("blogPosts.id", "asc");

            const rows = await query.execute();

            const result = await executeWithOffsetPagination(query, {
              perPage: 50,
              page: 1,
              experimental_deferredJoinPrimaryKey: useDeferredJoin
                ? "blogPosts.id"
                : undefined,
            });

            expect(result.hasNextPage).toBe(false);
            expect(result.rows).toEqual(rows);
          });
        });
      });

      it("returns the same result regardless of using a deferred join", async () => {
        await createSampleBlogPosts(db, 100);

        const query = db
          .selectFrom("blogPosts")
          .selectAll()
          .orderBy("id", "asc");

        let page = 1,
          hasNextPage: boolean | undefined = true;

        while (hasNextPage) {
          const withoutDeferredJoin = await executeWithOffsetPagination(query, {
            perPage: 5,
            page,
          });

          const withDeferredJoin = await executeWithOffsetPagination(query, {
            perPage: 5,
            page,
            experimental_deferredJoinPrimaryKey: "blogPosts.id",
          });

          expect(withDeferredJoin).toEqual(withoutDeferredJoin);

          page++;
          hasNextPage = withoutDeferredJoin.hasNextPage;
        }
      });
    });
  });
});
