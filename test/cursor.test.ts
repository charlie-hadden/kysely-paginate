import { describe, expect, it } from "vitest";
import {
  defaultDecodeCursor,
  defaultEncodeCursor,
  executeWithCursorPagination,
} from "../src";
import { createSampleBlogPosts, db } from "./db";

describe("executeWithCursorPagination", () => {
  it("works in a trivially simple case", async () => {
    const posts = await createSampleBlogPosts(2);

    const query = db.selectFrom("blogPosts").select(["id"]);

    const result = await executeWithCursorPagination(query, {
      perPage: 5,
      fields: [["id", "desc"]],
    });

    expect(result.hasNextPage).toBe(false);
    expect(result.hasPrevPage).toBe(false);
    expect(result.results.length).toEqual(2);

    expect(result.results[0]).toEqual({
      id: posts[1]!.id,
      cursor: defaultEncodeCursor([["id", posts[1]!.id]]),
    });

    expect(result.results[1]).toEqual({
      id: posts[0]!.id,
      cursor: defaultEncodeCursor([["id", posts[0]!.id]]),
    });
  });

  it("allows fetching a subset of data", async () => {
    await createSampleBlogPosts(5);

    const query = db.selectFrom("blogPosts").select(["id"]);

    const result = await executeWithCursorPagination(query, {
      perPage: 2,
      fields: [["id", "desc"]],
    });

    expect(result.hasNextPage).toBe(true);
    expect(result.hasPrevPage).toBe(false);
    expect(result.results.length).toEqual(2);
  });

  it("allows fetching subsequent pages", async () => {
    const expectedFirst = await createSampleBlogPosts(2);
    const expectedSecond = await createSampleBlogPosts(2);
    const expectedThird = await createSampleBlogPosts(2);

    const query = db.selectFrom("blogPosts").select(["id"]);

    const resultFirst = await executeWithCursorPagination(query, {
      perPage: 2,
      fields: [["id", "asc"]],
    });

    expect(resultFirst.hasNextPage).toBe(true);
    expect(resultFirst.hasPrevPage).toBe(false);
    expect(resultFirst.results.map((r) => r.id)).toEqual(
      expectedFirst.map((r) => r.id)
    );

    const resultSecond = await executeWithCursorPagination(query, {
      perPage: 2,
      after: resultFirst.results[1]?.cursor,
      fields: [["id", "asc"]],
    });

    expect(resultSecond.hasNextPage).toBe(true);
    expect(resultSecond.hasPrevPage).toBe(false); // TODO: I guess true? or at least null
    expect(resultSecond.results.map((r) => r.id)).toEqual(
      expectedSecond.map((r) => r.id)
    );

    const resultThird = await executeWithCursorPagination(query, {
      perPage: 2,
      after: resultSecond.results[1]?.cursor,
      fields: [["id", "asc"]],
    });

    expect(resultThird.hasNextPage).toBe(false);
    expect(resultThird.hasPrevPage).toBe(false); // TODO: I guess true? or at least null
    expect(resultThird.results.map((r) => r.id)).toEqual(
      expectedThird.map((r) => r.id)
    );
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
