import { describe, expect, it } from "vitest";
import { executeWithOffsetPagination } from "../src";
import { createSampleBlogPosts, db } from "./db";

describe("executeWithOffsetPagination", () => {
  it("allows returning page 1", async () => {
    const posts = await createSampleBlogPosts(4);

    const query = db
      .selectFrom("blogPosts")
      .select(["id"])
      .orderBy("id", "asc");

    const result = await executeWithOffsetPagination(query, {
      perPage: 2,
      page: 1,
    });

    expect(result.rows.map((r) => r.id)).toEqual(
      posts
        .map((p) => p.id)
        .sort()
        .slice(0, 2)
    );
  });

  it("allows returning later pages", async () => {
    const posts = await createSampleBlogPosts(4);

    const query = db
      .selectFrom("blogPosts")
      .select(["id"])
      .orderBy("id", "asc");

    const result = await executeWithOffsetPagination(query, {
      perPage: 2,
      page: 2,
    });

    expect(result.rows.map((r) => r.id)).toEqual(
      posts
        .map((p) => p.id)
        .sort()
        .slice(2, 4)
    );
  });

  it("raises an error for invalid page numbers", async () => {
    const query = db.selectFrom("blogPosts").select(["id"]);

    await expect(
      executeWithOffsetPagination(query, { perPage: 10, page: 0 })
    ).rejects.toThrowError(/invalid page/i);
  });
});
