import { describe, expect, it } from "vitest";
import { executeWithOffsetPagination } from "../src";
import { createSampleBlogPosts, db } from "./db";

describe("executeWithOffsetPagination", () => {
  Object.entries({
    "without deferred join": false,
    "with deferred join": true,
  }).forEach(([description, useDeferredJoin]) => {
    describe(description, () => {
      it("allows returning page 1", async () => {
        const posts = await createSampleBlogPosts(4);

        const query = db
          .selectFrom("blogPosts")
          .selectAll()
          .orderBy("id", "asc");

        const result = await executeWithOffsetPagination(query, {
          perPage: 2,
          page: 1,
          useDeferredJoin,
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
        const posts = await createSampleBlogPosts(4);

        const query = db
          .selectFrom("blogPosts")
          .selectAll()
          .orderBy("id", "asc");

        const result = await executeWithOffsetPagination(query, {
          perPage: 2,
          page: 2,
          useDeferredJoin,
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
        await createSampleBlogPosts(4);

        const query = db
          .selectFrom("blogPosts")
          .selectAll()
          .orderBy("id", "asc");

        const result = await executeWithOffsetPagination(query, {
          perPage: 2,
          page: 20,
          useDeferredJoin,
        });

        expect(result.hasNextPage).toBeUndefined();
        expect(result.hasPrevPage).toBeUndefined();
        expect(result.rows).toEqual([]);
      });
    });
  });
});
