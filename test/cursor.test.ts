import { describe, expect, it } from "vitest";
import {
  defaultDecodeCursor,
  defaultEncodeCursor,
  executeWithCursorPagination,
} from "../src";
import { createSampleBlogPosts, db } from "./db";

describe("executeWithCursorPagination", () => {
  it("handles a simple case with no cursors", async () => {
    const posts = await createSampleBlogPosts(2);

    const query = db.selectFrom("blogPosts").select(["id"]);

    const result = await executeWithCursorPagination(query, {
      perPage: 2,
      fields: [["id", "asc"]],
    });

    expect(result.hasNextPage).toBe(false);
    expect(result.rows.map((row) => row.id)).toEqual(
      posts.map((p) => p.id).sort()
    );
  });

  it("works correctly with a single ascending sorts", async () => {
    await createSampleBlogPosts(10);

    const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

    const fullResult = await executeWithCursorPagination(query, {
      perPage: 10,
      fields: [["id", "asc"]],
    });

    let cursor: string | undefined;

    for (let i = 0; i < 10; i += 2) {
      const result = await executeWithCursorPagination(query, {
        perPage: 2,
        after: cursor,
        fields: [["id", "asc"]],
      });

      cursor = result.rows[1]?.$cursor;

      expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
    }
  });

  it("works correctly with multiple ascending sorts", async () => {
    await createSampleBlogPosts(10);

    const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

    const fullResult = await executeWithCursorPagination(query, {
      perPage: 10,
      fields: [
        ["authorId", "asc"],
        ["id", "asc"],
      ],
    });

    let cursor: string | undefined;

    for (let i = 0; i < 10; i += 2) {
      const result = await executeWithCursorPagination(query, {
        perPage: 2,
        after: cursor,
        fields: [
          ["authorId", "asc"],
          ["id", "asc"],
        ],
      });

      cursor = result.rows[1]?.$cursor;

      expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
    }
  });

  it("works correctly with a single descending sorts", async () => {
    await createSampleBlogPosts(10);

    const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

    const fullResult = await executeWithCursorPagination(query, {
      perPage: 10,
      fields: [["id", "desc"]],
    });

    let cursor: string | undefined;

    for (let i = 0; i < 10; i += 2) {
      const result = await executeWithCursorPagination(query, {
        perPage: 2,
        after: cursor,
        fields: [["id", "desc"]],
      });

      cursor = result.rows[1]?.$cursor;

      expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
    }
  });

  it("works correctly with multiple descending sorts", async () => {
    await createSampleBlogPosts(10);

    const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

    const fullResult = await executeWithCursorPagination(query, {
      perPage: 10,
      fields: [
        ["authorId", "desc"],
        ["id", "desc"],
      ],
    });

    let cursor: string | undefined;

    for (let i = 0; i < 10; i += 2) {
      const result = await executeWithCursorPagination(query, {
        perPage: 2,
        after: cursor,
        fields: [
          ["authorId", "desc"],
          ["id", "desc"],
        ],
      });

      cursor = result.rows[1]?.$cursor;

      expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
    }
  });

  it("works correctly with mixed sort directions", async () => {
    await createSampleBlogPosts(10);

    const query = db.selectFrom("blogPosts").select(["id", "authorId"]);

    const fullResult = await executeWithCursorPagination(query, {
      perPage: 10,
      fields: [
        ["authorId", "asc"],
        ["id", "desc"],
      ],
    });

    let cursor: string | undefined;

    for (let i = 0; i < 10; i += 2) {
      const result = await executeWithCursorPagination(query, {
        perPage: 2,
        after: cursor,
        fields: [
          ["authorId", "asc"],
          ["id", "desc"],
        ],
      });

      cursor = result.rows[1]?.$cursor;

      expect(result.rows).toEqual(fullResult.rows.slice(i, i + 2));
    }
  });
});

describe("defaultEncodeCursor", () => {
  it("returns a base64 encoded string", () => {
    const cursor = defaultEncodeCursor([
      ["name", "foo"],
      ["id", 1],
    ]);

    expect(cursor).toEqual("W1sibmFtZSIsImZvbyJdLFsiaWQiLDFdXQ");
  });
});

describe("defaultDecodeCursor", () => {
  it("decodes a valid cursor", () => {
    const decoded = defaultDecodeCursor("W1sibmFtZSIsImZvbyJdLFsiaWQiLDFdXQ", [
      "name",
      "id",
    ]);

    expect(decoded).toEqual([
      ["name", "foo"],
      ["id", 1],
    ]);
  });

  it("throws an error on an unparsable cursor", () => {
    expect(() =>
      defaultDecodeCursor("completely wrong cursor", [])
    ).toThrowError(/unparsable/i);
  });

  it("throws an error if the cursor is not an array", () => {
    const cursor = Buffer.from(JSON.stringify({ foo: "foo" }), "utf8").toString(
      "base64url"
    );

    expect(() => defaultDecodeCursor(cursor, [])).toThrowError(/not an array/i);
  });

  it("throws an error if the cursor contains the wrong number of fields", () => {
    const cursor = Buffer.from(
      JSON.stringify([
        ["foo", 1],
        ["bar", 2],
      ]),
      "utf8"
    ).toString("base64url");

    expect(() => defaultDecodeCursor(cursor, ["foo"])).toThrowError(
      /unexpected number of fields/i
    );
  });

  it("throws an error if a field is not an array", () => {
    const cursor = Buffer.from(
      JSON.stringify([{ foo: "foo" }]),
      "utf8"
    ).toString("base64url");

    expect(() => defaultDecodeCursor(cursor, ["foo"])).toThrowError(
      /malformed value for field/i
    );
  });

  it("throws an error if a field array is the wrong length", () => {
    const cursor = Buffer.from(JSON.stringify([["foo"]]), "utf8").toString(
      "base64url"
    );

    expect(() => defaultDecodeCursor(cursor, ["foo"])).toThrowError(
      /malformed value for field/i
    );
  });

  it("throws an error if a field name doesn't match", () => {
    const cursor = Buffer.from(JSON.stringify([["foo", 1]]), "utf8").toString(
      "base64url"
    );

    expect(() => defaultDecodeCursor(cursor, ["bar"])).toThrowError(
      /unexpected field name/i
    );
  });
});
