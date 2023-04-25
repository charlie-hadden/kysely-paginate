import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defaultDecodeCursor,
  defaultEncodeCursor,
  executeWithCursorPagination,
} from "../src";
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

    describe("executeWithCursorPagination", () => {
      it("handles a simple case with no cursors", async () => {
        const posts = await createSampleBlogPosts(db, 2);

        const query = db.selectFrom("blogPosts").select(["id"]);

        const result = await executeWithCursorPagination(query, {
          perPage: 2,
          fields: [{ expression: "id", direction: "asc" }],
          parseCursor: z.object({ id: z.coerce.number().int() }),
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

        const query = db.selectFrom("blogPosts").select(["id"]);

        const result = await executeWithCursorPagination(query, {
          perPage: 2,
          cursorPerRow: true,
          fields: [{ expression: "id", direction: "asc" }],
          parseCursor: z.object({ id: z.coerce.number().int() }),
        });

        expect(result.rows[0]?.$cursor).toEqual(result.endCursor);
      });

      it("supports returning a cursor for each row with a custom key", async () => {
        await createSampleBlogPosts(db, 1);

        const query = db.selectFrom("blogPosts").select(["id"]);

        const result = await executeWithCursorPagination(query, {
          perPage: 2,
          cursorPerRow: "foobar",
          fields: [{ expression: "id", direction: "asc" }],
          parseCursor: z.object({ id: z.coerce.number().int() }),
        });

        expect(result.rows[0]?.foobar).toEqual(result.endCursor);
      });

      describe("when providing an 'after' cursor", () => {
        it("works correctly with a single sort", async () => {
          const posts = await createSampleBlogPosts(db, 4);

          const query = db.selectFrom("blogPosts").select(["id"]);

          const firstPage = await executeWithCursorPagination(query, {
            perPage: 2,
            fields: [{ expression: "id", direction: "asc" }],
            parseCursor: z.object({ id: z.coerce.number().int() }),
          });

          expect(firstPage.hasNextPage).toBe(true);
          expect(firstPage.hasPrevPage).toBe(undefined);
          expect(firstPage.rows[0]?.id).toEqual(posts[0]?.id);
          expect(firstPage.rows[1]?.id).toEqual(posts[1]?.id);

          const secondPage = await executeWithCursorPagination(query, {
            perPage: 2,
            after: firstPage.endCursor,
            fields: [{ expression: "id", direction: "asc" }],
            parseCursor: z.object({ id: z.coerce.number().int() }),
          });

          expect(secondPage.hasNextPage).toBe(false);
          expect(secondPage.hasPrevPage).toBe(undefined);
          expect(secondPage.rows[0]?.id).toEqual(posts[2]?.id);
          expect(secondPage.rows[1]?.id).toEqual(posts[3]?.id);
        });

        it("works correctly with multiple sorts", async () => {
          await createSampleBlogPosts(db, 4);

          const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

          const fullResult = await query
            .orderBy("authorId", "asc")
            .orderBy("id", "desc")
            .execute();

          const firstPage = await executeWithCursorPagination(query, {
            perPage: 2,
            fields: [
              { expression: "authorId", direction: "asc" },
              { expression: "id", direction: "desc" },
            ],
            parseCursor: z.object({
              id: z.coerce.number().int(),
              authorId: z.coerce.number().int(),
            }),
          });

          expect(firstPage.hasNextPage).toBe(true);
          expect(firstPage.hasPrevPage).toBe(undefined);
          expect(firstPage.rows[0]?.id).toEqual(fullResult[0]?.id);
          expect(firstPage.rows[1]?.id).toEqual(fullResult[1]?.id);

          const secondPage = await executeWithCursorPagination(query, {
            perPage: 2,
            after: firstPage.endCursor,
            fields: [
              { expression: "authorId", direction: "asc" },
              { expression: "id", direction: "desc" },
            ],
            parseCursor: z.object({
              id: z.coerce.number().int(),
              authorId: z.coerce.number().int(),
            }),
          });

          expect(secondPage.hasNextPage).toBe(false);
          expect(secondPage.hasPrevPage).toBe(undefined);
          expect(secondPage.rows[0]?.id).toEqual(fullResult[2]?.id);
          expect(secondPage.rows[1]?.id).toEqual(fullResult[3]?.id);
        });
      });

      describe("when providing a 'before' cursor", () => {
        it("works correctly with a single sort", async () => {
          const posts = await createSampleBlogPosts(db, 4);

          const query = db.selectFrom("blogPosts").select(["id"]);

          const firstPage = await executeWithCursorPagination(query, {
            perPage: 2,
            before: defaultEncodeCursor<any, any, any, any>([["id", 1000000]]),
            fields: [{ expression: "id", direction: "asc" }],
            parseCursor: z.object({ id: z.coerce.number().int() }),
          });

          expect(firstPage.hasNextPage).toBe(undefined);
          expect(firstPage.hasPrevPage).toBe(true);
          expect(firstPage.rows[0]?.id).toEqual(posts[2]?.id);
          expect(firstPage.rows[1]?.id).toEqual(posts[3]?.id);

          const secondPage = await executeWithCursorPagination(query, {
            perPage: 2,
            before: firstPage.startCursor,
            fields: [{ expression: "id", direction: "asc" }],
            parseCursor: z.object({ id: z.coerce.number().int() }),
          });

          expect(secondPage.hasNextPage).toBe(undefined);
          expect(secondPage.hasPrevPage).toBe(false);
          expect(secondPage.rows[0]?.id).toEqual(posts[0]?.id);
          expect(secondPage.rows[1]?.id).toEqual(posts[1]?.id);
        });

        it("works correctly with multiple sorts", async () => {
          await createSampleBlogPosts(db, 4);

          const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

          const fullResult = await query
            .orderBy("authorId", "asc")
            .orderBy("id", "desc")
            .execute();

          const firstPage = await executeWithCursorPagination(query, {
            perPage: 2,
            before: defaultEncodeCursor<any, any, any, any>([
              ["authorId", 1000000],
              ["id", 1000000],
            ]),
            fields: [
              { expression: "authorId", direction: "asc" },
              { expression: "id", direction: "desc" },
            ],
            parseCursor: z.object({
              id: z.coerce.number().int(),
              authorId: z.coerce.number().int(),
            }),
          });

          expect(firstPage.hasNextPage).toBe(undefined);
          expect(firstPage.hasPrevPage).toBe(true);
          expect(firstPage.rows[0]?.id).toEqual(fullResult[2]?.id);
          expect(firstPage.rows[1]?.id).toEqual(fullResult[3]?.id);

          const secondPage = await executeWithCursorPagination(query, {
            perPage: 2,
            before: firstPage.startCursor,
            fields: [
              { expression: "authorId", direction: "asc" },
              { expression: "id", direction: "desc" },
            ],
            parseCursor: z.object({
              id: z.coerce.number().int(),
              authorId: z.coerce.number().int(),
            }),
          });

          expect(secondPage.hasNextPage).toBe(undefined);
          expect(secondPage.hasPrevPage).toBe(false);
          expect(secondPage.rows[0]?.id).toEqual(fullResult[0]?.id);
          expect(secondPage.rows[1]?.id).toEqual(fullResult[1]?.id);
        });
      });

      describe("when providing both a 'before' and 'after' cursor", () => {
        it("works correctly with a single sort", async () => {
          await createSampleBlogPosts(db, 6);

          const query = db.selectFrom("blogPosts").select(["id"]);

          const fullResult = await executeWithCursorPagination(query, {
            perPage: 6,
            fields: [{ expression: "id", direction: "asc" }],
            parseCursor: z.object({ id: z.coerce.number().int() }),
          });

          const firstPage = await executeWithCursorPagination(query, {
            perPage: 2,
            before: fullResult.endCursor,
            after: fullResult.startCursor,
            fields: [{ expression: "id", direction: "asc" }],
            parseCursor: z.object({ id: z.coerce.number().int() }),
          });

          expect(firstPage.hasNextPage).toBe(true);
          expect(firstPage.hasPrevPage).toBe(undefined);
          expect(firstPage.rows[0]?.id).toEqual(fullResult.rows[1]?.id);
          expect(firstPage.rows[1]?.id).toEqual(fullResult.rows[2]?.id);

          const secondPage = await executeWithCursorPagination(query, {
            perPage: 4,
            before: fullResult.endCursor,
            after: firstPage.endCursor,
            fields: [{ expression: "id", direction: "asc" }],
            parseCursor: z.object({ id: z.coerce.number().int() }),
          });

          expect(secondPage.hasNextPage).toBe(false);
          expect(secondPage.hasPrevPage).toBe(undefined);
          expect(secondPage.rows.length).toEqual(2);
          expect(secondPage.rows[0]?.id).toEqual(fullResult.rows[3]?.id);
          expect(secondPage.rows[1]?.id).toEqual(fullResult.rows[4]?.id);
        });

        it("works correctly with multiple sorts", async () => {
          await createSampleBlogPosts(db, 6);

          const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

          const fullResult = await executeWithCursorPagination(query, {
            perPage: 6,
            fields: [
              { expression: "authorId", direction: "asc" },
              { expression: "id", direction: "desc" },
            ],
            parseCursor: z.object({
              id: z.coerce.number().int(),
              authorId: z.coerce.number().int(),
            }),
          });

          const firstPage = await executeWithCursorPagination(query, {
            perPage: 2,
            before: fullResult.endCursor,
            after: fullResult.startCursor,
            fields: [
              { expression: "authorId", direction: "asc" },
              { expression: "id", direction: "desc" },
            ],
            parseCursor: z.object({
              id: z.coerce.number().int(),
              authorId: z.coerce.number().int(),
            }),
          });

          expect(firstPage.hasNextPage).toBe(true);
          expect(firstPage.hasPrevPage).toBe(undefined);
          expect(firstPage.rows[0]?.id).toEqual(fullResult.rows[1]?.id);
          expect(firstPage.rows[1]?.id).toEqual(fullResult.rows[2]?.id);

          const secondPage = await executeWithCursorPagination(query, {
            perPage: 4,
            before: fullResult.endCursor,
            after: firstPage.endCursor,
            fields: [
              { expression: "authorId", direction: "asc" },
              { expression: "id", direction: "desc" },
            ],
            parseCursor: z.object({
              id: z.coerce.number().int(),
              authorId: z.coerce.number().int(),
            }),
          });

          expect(secondPage.hasNextPage).toBe(false);
          expect(secondPage.hasPrevPage).toBe(undefined);
          expect(secondPage.rows.length).toEqual(2);
          expect(secondPage.rows[0]?.id).toEqual(fullResult.rows[3]?.id);
          expect(secondPage.rows[1]?.id).toEqual(fullResult.rows[4]?.id);
        });
      });

      it("applies where conditions correctly", async () => {
        await createSampleBlogPosts(db, 10);

        const query = db
          .selectFrom("blogPosts")
          .selectAll()
          .where("authorId", "=", 1);

        const posts = await query.orderBy("id", "asc").execute();

        const result = await executeWithCursorPagination(query, {
          perPage: 50,
          after: defaultEncodeCursor<any, any, any, any>([["id", 0]]),
          fields: [{ expression: "id", direction: "asc" }],
          parseCursor: z.object({ id: z.coerce.number().int() }),
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
          ]);

        const rows = await query.orderBy("blogPosts.id", "asc").execute();

        const result = await executeWithCursorPagination(query, {
          perPage: 50,
          after: defaultEncodeCursor<any, any, any, any>([["id", 0]]),
          fields: [{ expression: "blogPosts.id", direction: "asc", key: "id" }],
          parseCursor: z.object({ id: z.coerce.number().int() }),
        });

        expect(result.hasNextPage).toBe(false);
        expect(result.rows).toEqual(rows);
      });

      it("works using other expressions", async () => {
        await createSampleBlogPosts(db, 1);

        const expr = db.fn.coalesce("id", "authorId");

        const query = db
          .selectFrom("blogPosts")
          .selectAll()
          .select(expr.as("field"));

        const posts = await query.orderBy(expr, "asc").execute();

        const result = await executeWithCursorPagination(query, {
          perPage: 50,
          after: defaultEncodeCursor<any, any, any, any>([["field", 0]]),
          fields: [{ expression: expr, direction: "asc", key: "field" }],
          parseCursor: z.object({ field: z.coerce.number().int() }),
        });

        expect(result.hasNextPage).toBe(false);
        expect(result.rows).toEqual(posts);
      });

      it("supports custom cursor encoding", async () => {
        const [post] = await createSampleBlogPosts(db, 1);

        const query = db.selectFrom("blogPosts").select(["id"]);

        const result = await executeWithCursorPagination(query, {
          perPage: 1,
          fields: [{ expression: "id", direction: "asc" }],
          encodeCursor: (values) =>
            new URLSearchParams(
              values.map(([field, value]) => [field, String(value)])
            ).toString(),
          parseCursor: z.object({ id: z.coerce.number().int() }),
        });

        expect(result.endCursor).toEqual(`id=${String(post?.id)}`);
      });

      it("supports custom cursor decoding", async () => {
        await createSampleBlogPosts(db, 1);
        let passedCursor, passedFields;

        const query = db.selectFrom("blogPosts").select(["id"]);

        await executeWithCursorPagination(query, {
          perPage: 1,
          after: "id=0",
          fields: [{ expression: "id", direction: "asc" }],
          decodeCursor: (cursor, fields) => {
            passedCursor = cursor;
            passedFields = fields;

            return { id: "0" };
          },
          parseCursor: z.object({ id: z.coerce.number().int() }),
        });

        expect(passedCursor).toEqual("id=0");
        expect(passedFields).toEqual(["id"]);
      });

      it("supports parsing the cursor", async () => {
        await createSampleBlogPosts(db, 1);
        let decodedCursor;

        const query = db.selectFrom("blogPosts").select(["id"]);

        await executeWithCursorPagination(query, {
          perPage: 1,
          after: "id=0",
          fields: [{ expression: "id", direction: "asc" }],
          decodeCursor: () => ({ id: "0" }),
          parseCursor: (cursor) => {
            decodedCursor = cursor;

            return { id: parseInt(cursor.id, 10) };
          },
        });

        expect(decodedCursor).toEqual({ id: "0" });
      });
    });
  });
});

describe("defaultEncodeCursor", () => {
  it("returns a base64 encoded string", () => {
    const cursor = defaultEncodeCursor<any, any, any, any>([
      ["string", "foo"],
      ["date", new Date("2001-02-30")],
      ["number", 1],
      ["bigint", 1n],
    ]);

    expect(cursor).toEqual(
      "c3RyaW5nPWZvbyZkYXRlPTIwMDEtMDMtMDJUMDAlM0EwMCUzQTAwLjAwMFombnVtYmVyPTEmYmlnaW50PTE"
    );
  });
});

describe("defaultDecodeCursor", () => {
  it("decodes a valid cursor", () => {
    const decoded = defaultDecodeCursor<any, any, any, any>(
      "bmFtZT1mb28maWQ9MQ",
      ["name", "id"]
    );

    expect(decoded).toEqual({
      name: "foo",
      id: "1",
    });
  });

  it("throws an error if the cursor contains the wrong number of fields", () => {
    const cursor = Buffer.from("foo=1&bar=2", "utf8").toString("base64url");

    expect(() =>
      defaultDecodeCursor<any, any, any, any>(cursor, ["foo"])
    ).toThrowError(/unexpected number of fields/i);
  });

  it("throws an error if a field name doesn't match", () => {
    const cursor = Buffer.from(JSON.stringify([["bar", 1]]), "utf8").toString(
      "base64url"
    );

    expect(() =>
      defaultDecodeCursor<any, any, any, any>(cursor, ["foo"])
    ).toThrowError(/unexpected field name/i);
  });
});
