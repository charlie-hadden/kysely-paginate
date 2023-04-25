# kysely-paginate
Pagination helpers for use with [Kysely](https://github.com/kysely-org/kysely).

> :warning: **This is a work in progress!** This library is still very early in development. Things won't work, things will be missing, and there will be breaking changes.

## Cursor pagination
```ts
const query = db
  .selectFrom("blogPosts")
  .select(["id", "title", "body", "authorId"])
  .where("authorId", "=", 1);

const result = await executeWithCursorPagination(query, {
  perPage: 10,
  fields: [
    { expression: "title", direction: "desc" },
    { expression: "id", direction: "asc" },
  ],
  parseCursor: (cursor) => ({
    title: cursor.title,
    id: parseInt(cursor.id, 10),
  }),
});
```

## Offset pagination
```ts
const query = db
  .selectFrom("blogPosts")
  .select(["id", "title", "body", "authorId"])
  .where("authorId", "=", 1)
  .orderBy("title", "desc")
  .orderBy("id", "asc");

const result = await executeWithOffsetPagination(query, {
  perPage: 10,
  page: 1,
})
```
