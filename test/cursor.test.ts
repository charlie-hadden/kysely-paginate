import { beforeAll, beforeEach, describe, expect, it } from "vitest";
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
          fields: [{ expression: "id", key: "id", direction: "asc" }],
        });

        expect(result.startCursor).toBeTruthy();
        expect(result.endCursor).toBeTruthy();
        expect(result.hasNextPage).toBe(false);
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
          fields: [{ expression: "id", key: "id", direction: "asc" }],
        });

        expect(result.rows[0]?.$cursor).toEqual(result.endCursor);
      });

      it("supports returning a cursor for each row with a custom key", async () => {
        await createSampleBlogPosts(db, 1);

        const query = db.selectFrom("blogPosts").select(["id"]);

        const result = await executeWithCursorPagination(query, {
          perPage: 2,
          cursorPerRow: "foobar",
          fields: [{ expression: "id", key: "id", direction: "asc" }],
        });

        expect(result.rows[0]?.foobar).toEqual(result.endCursor);
      });

      it("works correctly with a single ascending sorts", async () => {
        await createSampleBlogPosts(db, 10);

        const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

        const fullResult = await executeWithCursorPagination(query, {
          perPage: 10,
          fields: [{ expression: "id", key: "id", direction: "asc" }],
        });

        let cursor: string | undefined;

        for (let i = 0; i < 10; i += 2) {
          const result = await executeWithCursorPagination(query, {
            perPage: 2,
            after: cursor,
            fields: [{ expression: "id", key: "id", direction: "asc" }],
          });

          cursor = result.endCursor;

          expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
        }
      });

      it("works correctly with multiple ascending sorts", async () => {
        await createSampleBlogPosts(db, 10);

        const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

        const fullResult = await executeWithCursorPagination(query, {
          perPage: 10,
          fields: [
            { expression: "authorId", key: "authorId", direction: "asc" },
            { expression: "id", key: "id", direction: "asc" },
          ],
        });

        let cursor: string | undefined;

        for (let i = 0; i < 10; i += 2) {
          const result = await executeWithCursorPagination(query, {
            perPage: 2,
            after: cursor,
            fields: [
              { expression: "authorId", key: "authorId", direction: "asc" },
              { expression: "id", key: "id", direction: "asc" },
            ],
          });

          cursor = result.endCursor;

          expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
        }
      });

      it("works correctly with a single descending sorts", async () => {
        await createSampleBlogPosts(db, 10);

        const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

        const fullResult = await executeWithCursorPagination(query, {
          perPage: 10,
          fields: [{ expression: "id", key: "id", direction: "desc" }],
        });

        let cursor: string | undefined;

        for (let i = 0; i < 10; i += 2) {
          const result = await executeWithCursorPagination(query, {
            perPage: 2,
            after: cursor,
            fields: [{ expression: "id", key: "id", direction: "desc" }],
          });

          cursor = result.endCursor;

          expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
        }
      });

      it("works correctly with multiple descending sorts", async () => {
        await createSampleBlogPosts(db, 10);

        const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

        const fullResult = await executeWithCursorPagination(query, {
          perPage: 10,
          fields: [
            { expression: "authorId", key: "authorId", direction: "desc" },
            { expression: "id", key: "id", direction: "desc" },
          ],
        });

        let cursor: string | undefined;

        for (let i = 0; i < 10; i += 2) {
          const result = await executeWithCursorPagination(query, {
            perPage: 2,
            after: cursor,
            fields: [
              { expression: "authorId", key: "authorId", direction: "desc" },
              { expression: "id", key: "id", direction: "desc" },
            ],
          });

          cursor = result.endCursor;

          expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
        }
      });

      it("works correctly with mixed sort directions", async () => {
        await createSampleBlogPosts(db, 10);

        const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

        const fullResult = await executeWithCursorPagination(query, {
          perPage: 10,
          fields: [
            { expression: "authorId", key: "authorId", direction: "asc" },
            { expression: "id", key: "id", direction: "desc" },
          ],
        });

        let cursor: string | undefined;

        for (let i = 0; i < 10; i += 2) {
          const result = await executeWithCursorPagination(query, {
            perPage: 2,
            after: cursor,
            fields: [
              { expression: "authorId", key: "authorId", direction: "asc" },
              { expression: "id", key: "id", direction: "desc" },
            ],
          });

          cursor = result.endCursor;

          expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
        }
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
          fields: [{ expression: "id", key: "id", direction: "asc" }],
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
          fields: [{ expression: "blogPosts.id", key: "id", direction: "asc" }],
        });

        expect(result.hasNextPage).toBe(false);
        expect(result.rows).toEqual(rows);
      });

      it("supports custom cursor encoding", async () => {
        const [post] = await createSampleBlogPosts(db, 1);

        const query = db.selectFrom("blogPosts").select(["id"]);

        const result = await executeWithCursorPagination(query, {
          perPage: 1,
          fields: [{ expression: "id", key: "id", direction: "asc" }],
          encodeCursor: (values) =>
            new URLSearchParams(
              values.map(([field, value]) => [field, String(value)])
            ).toString(),
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
          fields: [{ expression: "id", key: "id", direction: "asc" }],
          decodeCursor: (cursor, fields) => {
            passedCursor = cursor;
            passedFields = fields;

            return { id: "0" };
          },
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
          fields: [{ expression: "id", key: "id", direction: "asc" }],
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
    const cursor = defaultEncodeCursor<
      { id: number; name: string },
      [["name", "desc"], ["id", "desc"]]
    >([
      ["name", "foo"],
      ["id", 1],
    ]);

    expect(cursor).toEqual("bmFtZT1mb28maWQ9MQ");
  });
});

describe("defaultDecodeCursor", () => {
  it("decodes a valid cursor", () => {
    const decoded = defaultDecodeCursor<
      { id: number; name: string },
      [["name", "desc"], ["id", "desc"]]
    >("bmFtZT1mb28maWQ9MQ", ["name", "id"]);

    expect(decoded).toEqual({
      name: "foo",
      id: "1",
    });
  });

  it("throws an error if the cursor contains the wrong number of fields", () => {
    const cursor = Buffer.from("foo=1&bar=2", "utf8").toString("base64url");

    expect(() =>
      defaultDecodeCursor<{ foo: string }, [["foo", "desc"]]>(cursor, ["foo"])
    ).toThrowError(/unexpected number of fields/i);
  });

  it("throws an error if a field name doesn't match", () => {
    const cursor = Buffer.from(JSON.stringify([["bar", 1]]), "utf8").toString(
      "base64url"
    );

    expect(() =>
      defaultDecodeCursor<{ foo: string }, [["foo", "desc"]]>(cursor, ["foo"])
    ).toThrowError(/unexpected field name/i);
  });
});
